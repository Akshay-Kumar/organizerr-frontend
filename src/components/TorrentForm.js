import React, { useRef, useState, useEffect } from "react";
import { addTorrentsBatch, searchMedia } from "../api/api";
import "./TorrentForm.css";

export default function TorrentForm({ onAdded }) {
    const [torrentUrl, setTorrentUrl] = useState("");
    const [torrentFiles, setTorrentFiles] = useState([]);
    const [metadataRows, setMetadataRows] = useState([]);
    const [results, setResults] = useState([]);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [loadingResults, setLoadingResults] = useState(false);

    const searchTimer = useRef(null);
    const resultsRef = useRef(null);
    const fileInputRef = useRef(null);

    const searchSupportedMediaTypes = ["movie", "tv", "episode"];

    // TMDb search autocomplete
    useEffect(() => {
        const activeRow = metadataRows.find(r => r.activeAutocomplete);
        if (!activeRow) return;
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
                const res = await searchMedia(activeRow.query, mediaType, year || null, season || null, episode || null);
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
    }, [metadataRows]);

    // Click outside autocomplete
    useEffect(() => {
        const onDocClick = (e) => {
            if (resultsRef.current && !resultsRef.current.contains(e.target)) {
                setResults([]);
                setMetadataRows(rows => rows.map(r => ({ ...r, activeAutocomplete: false })));
            }
        };
        document.addEventListener("click", onDocClick);
        return () => document.removeEventListener("click", onDocClick);
    }, []);

    const handleRemoveRow = (index) => {
        setMetadataRows(rows => rows.filter((_, i) => i !== index));
        setTorrentFiles(files => files.filter((_, i) => i !== index));
    };

    const pickResult = (rowIndex, r) => {
        setMetadataRows(rows => rows.map((row, i) => i === rowIndex ? {
            ...row,
            selectedResult: r,
            correctName: r.title || r.name || "",
            year: r.year || "",
            season: r.season || "",
            episode: r.episode || "",
            episodeTitle: r.episode_title || "",
            poster: r.poster || "",
            query: "",
            activeAutocomplete: false
        } : row));
        setResults([]);
    };

    const onKeyDownResults = (e) => {
        if (!results.length) return;
        if (e.key === "ArrowDown") setActiveIndex(i => Math.min(i + 1, results.length - 1));
        else if (e.key === "ArrowUp") setActiveIndex(i => Math.max(i - 1, 0));
        else if (e.key === "Enter") {
            e.preventDefault();
            const rowIndex = metadataRows.findIndex(r => r.activeAutocomplete);
            if (rowIndex >= 0 && activeIndex >= 0 && results[activeIndex]) {
                pickResult(rowIndex, results[activeIndex]);
            }
        }
    };

    const handleFilesChange = (e) => {
        const files = Array.from(e.target.files);
        setTorrentFiles(files);
        setMetadataRows(files.map(file => ({
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
            activeAutocomplete: false
        })));
    };

    const handleRowChange = (index, field, value) => {
        setMetadataRows(rows => rows.map((row, i) => i === index ? { ...row, [field]: value } : row));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!torrentUrl && torrentFiles.length === 0) return alert("Provide a magnet URL or at least one .torrent file");

        const metaPayload = [];

        // Magnet URL entry
        if (torrentUrl) {
            metaPayload.push({
                source: torrentUrl,
                media_type: metadataRows[0]?.mediaType || "",
                name: metadataRows[0]?.correctName || "",
                tags: metadataRows[0]?.tags || "",
                season: metadataRows[0]?.season || "",
                episode: metadataRows[0]?.episode || "",
                episode_title: metadataRows[0]?.episodeTitle || "",
                year: metadataRows[0]?.year || "",
                poster: metadataRows[0]?.poster || "",
                custom_metadata: metadataRows[0]?.customMetadata ? JSON.parse(metadataRows[0].customMetadata) : {}
            });
        }

        // File entries
        metadataRows.forEach(row => {
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
                custom_metadata: row.customMetadata ? JSON.parse(row.customMetadata) : {}
            });
        });

        try {
            const formData = new FormData();
            torrentFiles.forEach(f => formData.append("files", f));
            formData.append("metadata", JSON.stringify(metaPayload));

            await addTorrentsBatch(formData);

            // Reset
            setTorrentUrl("");
            setTorrentFiles([]);
            setMetadataRows([]);
            if (fileInputRef.current) fileInputRef.current.value = "";
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
                        onChange={e => setTorrentUrl(e.target.value)}
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
                            <div className="tf-file-name">
                                {torrentFiles.map(f => f.name).join(", ")}
                            </div>
                        )}
                    </div>
                </div>

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
                                onChange={e => handleRowChange(index, "mediaType", e.target.value)}
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
                                onChange={e => handleRowChange(index, "year", e.target.value)}
                            />
                        </div>

                        {searchSupportedMediaTypes.includes(row.mediaType) && (
                            <div className="tf-search-wrap" ref={resultsRef}>
                                <input
                                    className="tf-input tf-search"
                                    type="search"
                                    placeholder={`Search ${row.mediaType === "movie" ? "movies" : "shows"}...`}
                                    value={row.query}
                                    onChange={e => {
                                        handleRowChange(index, "query", e.target.value);
                                        setMetadataRows(rows => rows.map((r,i) => i===index ? { ...r, activeAutocomplete: true } : r));
                                    }}
                                    onKeyDown={onKeyDownResults}
                                />
                                {loadingResults && <div className="tf-loader">Searching…</div>}
                                {results.length > 0 && row.activeAutocomplete && (
                                    <ul className="tf-results">
                                        {results.map((r, i) => (
                                            <li key={`${r.id}-${i}`} className={`tf-result ${i === activeIndex ? "active" : ""}`}
                                                onMouseEnter={() => setActiveIndex(i)}
                                                onClick={() => pickResult(index, r)}
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
                            onChange={e => handleRowChange(index, "correctName", e.target.value)}
                        />

                        {row.mediaType === "episode" && (
                            <div className="tf-row tf-episode-row">
                                <input
                                    className="tf-input"
                                    type="number"
                                    placeholder="Season"
                                    value={row.season}
                                    onChange={e => handleRowChange(index, "season", e.target.value)}
                                />
                                <input
                                    className="tf-input"
                                    type="number"
                                    placeholder="Episode"
                                    value={row.episode}
                                    onChange={e => handleRowChange(index, "episode", e.target.value)}
                                />
                                <input
                                    className="tf-input"
                                    type="text"
                                    placeholder="Episode Title"
                                    value={row.episodeTitle}
                                    onChange={e => handleRowChange(index, "episodeTitle", e.target.value)}
                                />
                            </div>
                        )}

                        <input
                            className="tf-input"
                            type="text"
                            placeholder="Tags (comma separated)"
                            value={row.tags}
                            onChange={e => handleRowChange(index, "tags", e.target.value)}
                        />

                        <input
                            className="tf-input"
                            type="text"
                            placeholder='Custom Metadata (JSON) {"quality":"1080p"}'
                            value={row.customMetadata}
                            onChange={e => handleRowChange(index, "customMetadata", e.target.value)}
                        />
                    </div>
                ))}

                <div className="tf-row">
                    <button type="submit" className="tf-button">Add Torrents</button>
                </div>
            </form>
        </div>
    );
}
