import React, { useRef, useState, useEffect } from "react";
import { addTorrentsBatch, searchMedia } from "../api/api";
import "./TorrentForm.css";

export default function TorrentForm({ onAdded }) {
    const [torrentUrl, setTorrentUrl] = useState("");
    const [torrentFiles, setTorrentFiles] = useState([]);
    const [metadataRows, setMetadataRows] = useState([]);
    const [token, setToken] = useState(localStorage.getItem("token"));

    // NEW: magnet metadata row (separate from file rows)
    const [magnetRow, setMagnetRow] = useState({
        mediaType: "",
        correctName: "",
        tags: "",
        season: "",
        episode: "",
        episodeTitle: "",
        year: "",
        poster: "",
        customMetadata: "{}",
        query: "",
        selectedResult: null,
        activeAutocomplete: false,
    });

    const [results, setResults] = useState([]);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [loadingResults, setLoadingResults] = useState(false);

    const searchTimer = useRef(null);
    const resultsRef = useRef(null);
    const fileInputRef = useRef(null);
    const magnetMetaRef = useRef(null);
    const magnetMediaTypeRef = useRef(null);


    const searchSupportedMediaTypes = ["movie", "tv", "episode"];

    // -------- Helpers to detect which row is active for autocomplete --------
    const getActiveAutocompleteContext = () => {
        const fileActiveIndex = metadataRows.findIndex((r) => r.activeAutocomplete);
        if (fileActiveIndex >= 0) {
            return { type: "file", index: fileActiveIndex, row: metadataRows[fileActiveIndex] };
        }
        if (magnetRow.activeAutocomplete) {
            return { type: "magnet", index: -1, row: magnetRow };
        }
        return null;
    };

    // TMDb search autocomplete
    useEffect(() => {
        const ctx = getActiveAutocompleteContext();
        if (!ctx) return;

        const activeRow = ctx.row;
        const { mediaType, year, season, episode } = activeRow;

        if (!activeRow.query || activeRow.query.length < 2 || !mediaType) {
            setResults([]);
            setActiveIndex(-1);
            return;
        }

        setLoadingResults(true);
        if (searchTimer.current) clearTimeout(searchTimer.current);

        searchTimer.current = setTimeout(async () => {
            try {
                const res = await searchMedia(
                    activeRow.query,
                    mediaType,
                    year || null,
                    season || null,
                    episode || null
                );
                setResults(res.data.results || []);
                setActiveIndex(-1);
            } catch (err) {
                console.error("Search failed", err);
                setResults([]);
            } finally {
                setLoadingResults(false);
            }
        }, 300);

        return () => {
            if (searchTimer.current) clearTimeout(searchTimer.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [metadataRows, magnetRow]);

    // Click outside autocomplete
    useEffect(() => {
        const onDocClick = (e) => {
            // If click is inside any autocomplete container, do nothing
            if (e.target.closest(".tf-search-wrap")) return;

            setResults([]);
            setMetadataRows((rows) => rows.map((r) => ({ ...r, activeAutocomplete: false })));
            setMagnetRow((r) => ({ ...r, activeAutocomplete: false }));
        };

        document.addEventListener("click", onDocClick);
        return () => document.removeEventListener("click", onDocClick);
    }, []);

    useEffect(() => {
        // When user pastes/enters a magnet URL, reveal magnet metadata and guide them to it
        const v = (torrentUrl || "").trim();
        if (!v) return;

        // only do this for actual magnet URLs
        if (!v.startsWith("magnet:?")) return;

        // Scroll + focus after the DOM updates
        const t = setTimeout(() => {
            if (magnetMetaRef.current) {
                magnetMetaRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
            }
            if (magnetMediaTypeRef.current) {
                magnetMediaTypeRef.current.focus();
            }
        }, 50);

        return () => clearTimeout(t);
    }, [torrentUrl]);


    const handleRemoveRow = (index) => {
        setMetadataRows((rows) => rows.filter((_, i) => i !== index));
        setTorrentFiles((files) => files.filter((_, i) => i !== index));
    };

    const pickResult = (ctx, r) => {
        const patch = {
            selectedResult: r,
            correctName: r.title || r.name || "",
            year: r.year || "",
            season: r.season || "",
            episode: r.episode || "",
            episodeTitle: r.episode_title || "",
            poster: r.poster || "",
            query: "",
            activeAutocomplete: false,
        };

        if (ctx.type === "file") {
            const rowIndex = ctx.index;
            setMetadataRows((rows) => rows.map((row, i) => (i === rowIndex ? { ...row, ...patch } : row)));
        } else {
            setMagnetRow((row) => ({ ...row, ...patch }));
        }

        setResults([]);
    };

    const onKeyDownResults = (e) => {
        if (!results.length) return;

        if (e.key === "ArrowDown") setActiveIndex((i) => Math.min(i + 1, results.length - 1));
        else if (e.key === "ArrowUp") setActiveIndex((i) => Math.max(i - 1, 0));
        else if (e.key === "Enter") {
            e.preventDefault();
            const ctx = getActiveAutocompleteContext();
            if (ctx && activeIndex >= 0 && results[activeIndex]) {
                pickResult(ctx, results[activeIndex]);
            }
        }
    };

    const handleFilesChange = (e) => {
        const files = Array.from(e.target.files || []);
        setTorrentFiles(files);
        setMetadataRows(
            files.map((file) => ({
                file,
                mediaType: "",
                correctName: "",
                tags: "",
                season: "",
                episode: "",
                episodeTitle: "",
                year: "",
                poster: "",
                customMetadata: "{}",
                query: "",
                selectedResult: null,
                activeAutocomplete: false,
            }))
        );
    };

    const handleRowChange = (index, field, value) => {
        setMetadataRows((rows) => rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
    };

    // NEW: Magnet row change
    const handleMagnetRowChange = (field, value) => {
        setMagnetRow((row) => ({ ...row, [field]: value }));
    };

    const safeParseJson = (s) => {
        try {
            const obj = JSON.parse(s || "{}");
            return obj && typeof obj === "object" ? obj : {};
        } catch {
            return {};
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const hasMagnet = torrentUrl.trim().startsWith("magnet:?");
        if (torrentUrl && !hasMagnet) {
            alert("Magnet URL must start with magnet:?");
            return;
        }

        if (!torrentUrl && torrentFiles.length === 0) {
            alert("Provide a magnet URL or at least one .torrent file");
            return;
        }

        const metaPayload = [];

        // Magnet URL entry (NOW uses magnetRow)
        if (hasMagnet) {
            metaPayload.push({
                source: torrentUrl,
                media_type: magnetRow.mediaType || "",
                name: magnetRow.correctName || "",
                tags: magnetRow.tags || "",
                season: magnetRow.season || "",
                episode: magnetRow.episode || "",
                episode_title: magnetRow.episodeTitle || "",
                year: magnetRow.year || "",
                poster: magnetRow.poster || "",
                custom_metadata: safeParseJson(magnetRow.customMetadata),
            });
        }

        // File entries (only for files)
        metadataRows.forEach((row) => {
            metaPayload.push({
                source: undefined,
                media_type: row.mediaType,
                name: row.correctName,
                tags: row.tags,
                season: row.season,
                episode: row.episode,
                episode_title: row.episodeTitle,
                year: row.year,
                poster: row.poster,
                custom_metadata: safeParseJson(row.customMetadata),
            });
        });

        try {
            const formData = new FormData();
            torrentFiles.forEach((f) => formData.append("files", f));
            formData.append("metadata", JSON.stringify(metaPayload));

            await addTorrentsBatch(token, formData)

            // Reset
            setTorrentUrl("");
            setTorrentFiles([]);
            setMetadataRows([]);
            setMagnetRow({
                mediaType: "",
                correctName: "",
                tags: "",
                season: "",
                episode: "",
                episodeTitle: "",
                year: "",
                poster: "",
                customMetadata: "{}",
                query: "",
                selectedResult: null,
                activeAutocomplete: false,
            });

            setResults([]);
            setActiveIndex(-1);

            if (fileInputRef.current) fileInputRef.current.value = "";
            window.dispatchEvent(
                new Event("torrent-added")
            );

            onAdded();
        } catch (err) {
            console.error(err);
            alert("Failed to add torrents");
        }
    };

    return (
        <div className="tf-wrapper">
            <form className="tf-form" onSubmit={handleSubmit} autoComplete="off">
                <div className="tf-row">
                    <label>Add Torrents</label>

                    <input
                        className="tf-input"
                        type="text"
                        placeholder="Magnet URL"
                        value={torrentUrl}
                        onChange={(e) => setTorrentUrl(e.target.value)}
                    />

                    <div className="tf-file-wrapper">
                        <label className="tf-file-label">
                            Choose .torrent Files
                            <input
                                className="tf-file-input"
                                type="file"
                                accept=".torrent"
                                multiple
                                ref={fileInputRef}
                                onChange={handleFilesChange}
                            />
                        </label>

                        {torrentFiles.length > 0 && (
                            <div className="tf-file-name">{torrentFiles.map((f) => f.name).join(", ")}</div>
                        )}
                    </div>
                </div>

                {/* NEW: Magnet metadata section */}
                {torrentUrl.trim().startsWith("magnet:?") && (
                    <div className="tf-row tf-metadata-row" ref={magnetMetaRef}>
                    <label>Metadata for Magnet URL</label>

                        <div className="tf-inline">
                            <select
                                ref={magnetMediaTypeRef}
                                className="tf-select"
                                value={magnetRow.mediaType}
                                onChange={(e) => handleMagnetRowChange("mediaType", e.target.value)}
                            >
                            <option value="">Select Media Type</option>
                                <option value="movie">Movie</option>
                                <option value="tv">TV Show</option>
                                <option value="episode">TV Episode</option>
                                <option value="music">Music</option>
                                <option value="unsorted">Unsorted</option>
                            </select>

                            <input
                                className="tf-input tf-year"
                                type="number"
                                placeholder="Year"
                                value={magnetRow.year}
                                onChange={(e) => handleMagnetRowChange("year", e.target.value)}
                            />
                        </div>

                        {searchSupportedMediaTypes.includes(magnetRow.mediaType) && (
                            <div className="tf-search-wrap" ref={resultsRef}>
                                <input
                                    className="tf-input tf-search"
                                    type="search"
                                    placeholder={`Search ${magnetRow.mediaType === "movie" ? "movies" : "shows"}...`}
                                    value={magnetRow.query}
                                    onChange={(e) => {
                                        handleMagnetRowChange("query", e.target.value);
                                        setMagnetRow((r) => ({ ...r, activeAutocomplete: true }));
                                        setMetadataRows((rows) => rows.map((r) => ({ ...r, activeAutocomplete: false })));
                                    }}
                                    onKeyDown={onKeyDownResults}
                                />

                                {loadingResults && <div className="tf-loader">Searching…</div>}

                                {results.length > 0 && magnetRow.activeAutocomplete && (
                                    <ul className="tf-results">
                                        {results.map((r, i) => (
                                            <li
                                                key={`${r.id}-${i}`}
                                                className={`tf-result ${i === activeIndex ? "active" : ""}`}
                                                onMouseEnter={() => setActiveIndex(i)}
                                                onClick={() => pickResult({ type: "magnet", index: -1 }, r)}
                                            >
                                                {r.poster ? (
                                                    <img src={r.poster} alt="" className="tf-thumb" />
                                                ) : (
                                                    <div className="tf-thumb tf-thumb-placeholder" />
                                                )}

                                                <div className="tf-result-meta">
                                                    <div className="tf-result-title">{r.title || r.name}</div>
                                                    <div className="tf-result-sub">{r.year || ""}</div>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}

                        <input
                            className="tf-input"
                            type="text"
                            placeholder="Correct Name"
                            value={magnetRow.correctName}
                            onChange={(e) => handleMagnetRowChange("correctName", e.target.value)}
                        />

                        {magnetRow.mediaType === "episode" && (
                            <div className="tf-row tf-episode-row">
                                <input
                                    className="tf-input"
                                    type="number"
                                    placeholder="Season"
                                    value={magnetRow.season}
                                    onChange={(e) => handleMagnetRowChange("season", e.target.value)}
                                />
                                <input
                                    className="tf-input"
                                    type="number"
                                    placeholder="Episode"
                                    value={magnetRow.episode}
                                    onChange={(e) => handleMagnetRowChange("episode", e.target.value)}
                                />
                                <input
                                    className="tf-input"
                                    type="text"
                                    placeholder="Episode Title"
                                    value={magnetRow.episodeTitle}
                                    onChange={(e) => handleMagnetRowChange("episodeTitle", e.target.value)}
                                />
                            </div>
                        )}

                        <input
                            className="tf-input"
                            type="text"
                            placeholder="Tags (comma separated)"
                            value={magnetRow.tags}
                            onChange={(e) => handleMagnetRowChange("tags", e.target.value)}
                        />

                        <input
                            className="tf-input"
                            type="text"
                            placeholder='Custom Metadata (JSON) {"quality":"1080p"}'
                            value={magnetRow.customMetadata}
                            onChange={(e) => handleMagnetRowChange("customMetadata", e.target.value)}
                        />
                    </div>
                )}

                {/* File metadata rows */}
                {metadataRows.map((row, index) => (
                    <div key={index} className="tf-row tf-metadata-row">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <label>Metadata for: {row.file.name}</label>
                            <button
                                type="button"
                                className="tf-button"
                                style={{ backgroundColor: "#d32f2f" }}
                                onClick={() => handleRemoveRow(index)}
                            >
                                Remove
                            </button>
                        </div>

                        <div className="tf-inline">
                            <select
                                className="tf-select"
                                value={row.mediaType}
                                onChange={(e) => handleRowChange(index, "mediaType", e.target.value)}
                            >
                                <option value="">Select Media Type</option>
                                <option value="movie">Movie</option>
                                <option value="tv">TV Show</option>
                                <option value="episode">TV Episode</option>
                                <option value="music">Music</option>
                                <option value="unsorted">Unsorted</option>
                            </select>

                            <input
                                className="tf-input tf-year"
                                type="number"
                                placeholder="Year"
                                value={row.year}
                                onChange={(e) => handleRowChange(index, "year", e.target.value)}
                            />
                        </div>

                        {searchSupportedMediaTypes.includes(row.mediaType) && (
                            <div className="tf-search-wrap" ref={resultsRef}>
                                <input
                                    className="tf-input tf-search"
                                    type="search"
                                    placeholder={`Search ${row.mediaType === "movie" ? "movies" : "shows"}...`}
                                    value={row.query}
                                    onChange={(e) => {
                                        handleRowChange(index, "query", e.target.value);
                                        setMetadataRows((rows) =>
                                            rows.map((r, i) => (i === index ? { ...r, activeAutocomplete: true } : { ...r, activeAutocomplete: false }))
                                        );
                                        setMagnetRow((r) => ({ ...r, activeAutocomplete: false }));
                                    }}
                                    onKeyDown={onKeyDownResults}
                                />

                                {loadingResults && <div className="tf-loader">Searching…</div>}

                                {results.length > 0 && row.activeAutocomplete && (
                                    <ul className="tf-results">
                                        {results.map((r, i) => (
                                            <li
                                                key={`${r.id}-${i}`}
                                                className={`tf-result ${i === activeIndex ? "active" : ""}`}
                                                onMouseEnter={() => setActiveIndex(i)}
                                                onClick={() => pickResult({ type: "file", index }, r)}
                                            >
                                                {r.poster ? <img src={r.poster} alt="" className="tf-thumb" /> : <div className="tf-thumb tf-thumb-placeholder" />}
                                                <div className="tf-result-meta">
                                                    <div className="tf-result-title">{r.title || r.name}</div>
                                                    <div className="tf-result-sub">{r.year || ""}</div>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}

                        <input
                            className="tf-input"
                            type="text"
                            placeholder="Correct Name"
                            value={row.correctName}
                            onChange={(e) => handleRowChange(index, "correctName", e.target.value)}
                        />

                        {row.mediaType === "episode" && (
                            <div className="tf-row tf-episode-row">
                                <input
                                    className="tf-input"
                                    type="number"
                                    placeholder="Season"
                                    value={row.season}
                                    onChange={(e) => handleRowChange(index, "season", e.target.value)}
                                />
                                <input
                                    className="tf-input"
                                    type="number"
                                    placeholder="Episode"
                                    value={row.episode}
                                    onChange={(e) => handleRowChange(index, "episode", e.target.value)}
                                />
                                <input
                                    className="tf-input"
                                    type="text"
                                    placeholder="Episode Title"
                                    value={row.episodeTitle}
                                    onChange={(e) => handleRowChange(index, "episodeTitle", e.target.value)}
                                />
                            </div>
                        )}

                        <input
                            className="tf-input"
                            type="text"
                            placeholder="Tags (comma separated)"
                            value={row.tags}
                            onChange={(e) => handleRowChange(index, "tags", e.target.value)}
                        />

                        <input
                            className="tf-input"
                            type="text"
                            placeholder='Custom Metadata (JSON) {"quality":"1080p"}'
                            value={row.customMetadata}
                            onChange={(e) => handleRowChange(index, "customMetadata", e.target.value)}
                        />
                    </div>
                ))}

                <div className="tf-row">
                    <button type="submit" className="tf-button">
                        Add Torrents
                    </button>
                </div>
            </form>
        </div>
    );
}
