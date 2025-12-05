// src/components/TorrentForm.js
import React, { useRef, useState, useEffect } from "react";
import { addTorrent, searchMedia } from "../api/api";
import "./TorrentForm.css";

export default function TorrentForm({ onAdded }) {
    const [torrentUrl, setTorrentUrl] = useState("");
    const [torrentFile, setTorrentFile] = useState(null);
    const [mediaType, setMediaType] = useState("");
    const [correctName, setCorrectName] = useState("");
    const [tags, setTags] = useState("");
    const [season, setSeason] = useState("");
    const [episode, setEpisode] = useState("");
    const [episodeTitle, setEpisodeTitle] = useState("");
    const [year, setYear] = useState("");
    const [poster, setPoster] = useState("");
    const [customMetadata, setCustomMetadata] = useState("{}");
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [selectedResult, setSelectedResult] = useState(null);
    const [loadingResults, setLoadingResults] = useState(false);

    const [activeIndex, setActiveIndex] = useState(-1);
    const searchTimer = useRef(null);
    const resultsRef = useRef(null);
    const fileInputRef = useRef(null);

    const searchSupportedMediaTypes = ["movie", "tv", "episode"];

    // --- Debounced search ---
    useEffect(() => {
        if (!query || query.length < 2 || !mediaType) {
            setResults([]);
            setActiveIndex(-1);
            return;
        }

        setLoadingResults(true);
        if (searchTimer.current) clearTimeout(searchTimer.current);

        searchTimer.current = setTimeout(async () => {
            try {
                const res = await searchMedia(query, mediaType, year || null, season || null, episode || null);
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
    }, [query, mediaType, year, season, episode]);

    // --- Click outside autocomplete ---
    useEffect(() => {
        const onDocClick = (e) => {
            if (resultsRef.current && !resultsRef.current.contains(e.target)) {
                setResults([]);
            }
        };
        document.addEventListener("click", onDocClick);
        return () => document.removeEventListener("click", onDocClick);
    }, []);

    const pickResult = (r) => {
        setSelectedResult(r);
        setCorrectName(r.title || r.name || "");
        if (r.year) setYear(String(r.year));
        if (r.season) setSeason(String(r.season));
        if (r.episode) setEpisode(String(r.episode));
        if (r.episode_title) setEpisodeTitle(r.episode_title);
        if (r.poster) setPoster(r.poster);
        setResults([]);
    };

    const onKeyDownResults = (e) => {
        if (!results.length) return;
        if (e.key === "ArrowDown") setActiveIndex((i) => Math.min(i + 1, results.length - 1));
        else if (e.key === "ArrowUp") setActiveIndex((i) => Math.max(i - 1, 0));
        else if (e.key === "Enter") {
            e.preventDefault();
            if (activeIndex >= 0 && results[activeIndex]) pickResult(results[activeIndex]);
        }
    };

    // --- Submit ---
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!torrentUrl && !torrentFile) return alert("Provide a magnet URL or .torrent file");

        let parsedCustomMetadata;
        try {
            parsedCustomMetadata = JSON.parse(customMetadata || "{}");
        } catch (err) {
            return alert("Custom Metadata must be valid JSON");
        }

        try {
            const formData = new FormData();
            if (torrentUrl) formData.append("source", torrentUrl);
            if (torrentFile) formData.append("file", torrentFile);
            if (mediaType) formData.append("media_type", mediaType);
            if (correctName) formData.append("name", correctName);
            if (tags) formData.append("tags", JSON.stringify(tags.split(",").map(t => t.trim()).filter(Boolean)));
            if (year) formData.append("year", year);
            if (poster) formData.append("poster", poster);
            if ((mediaType === "episode" || mediaType === "tv")) {
                if (season) formData.append("season", Number(season));
                if (episode) formData.append("episode", Number(episode));
                if (episodeTitle) formData.append("episode_title", episodeTitle);
            }
            if (selectedResult?.id) formData.append("tmdb_id", selectedResult.id);
            formData.append("custom_metadata", JSON.stringify(parsedCustomMetadata));

            await addTorrent(formData);

            // Reset
            setTorrentUrl(""); setTorrentFile(null); setMediaType("");
            setCorrectName(""); setTags(""); setSeason(""); setEpisode(""); setEpisodeTitle("");
            setYear(""); setCustomMetadata("{}"); setQuery(""); setPoster(""); setResults([]);
            setSelectedResult(null);
            if (fileInputRef.current) fileInputRef.current.value = "";

            onAdded();
        } catch (err) {
            console.error(err);
            alert("Failed to add torrent");
        }
    };

    return (
        <div className="tf-wrapper">
            <form className="tf-form" onSubmit={handleSubmit} autoComplete="off">
                {/* Magnet / File */}
                <div className="tf-row">
                    <label>Add Torrents</label>

                    {/* Magnet URL field (full width) */}
                    <input
                        className="tf-input"
                        type="text"
                        placeholder="Magnet URL"
                        value={torrentUrl}
                        onChange={(e) => setTorrentUrl(e.target.value)}
                    />

                    {/* File upload moved below magnet field */}
                    <div className="tf-file-wrapper">
                        <label className="tf-file-label">
                            Choose .torrent File
                            <input
                                className="tf-file-input"
                                type="file"
                                accept=".torrent"
                                ref={fileInputRef}
                                onChange={(e) => setTorrentFile(e.target.files[0])}
                            />
                        </label>

                        {torrentFile && (
                            <div className="tf-file-name">
                                Selected: {torrentFile.name}
                            </div>
                        )}
                    </div>
                </div>

                {/* Media type & year */}
                <div className="tf-row">
                    <label>Type & Year</label>
                    <div className="tf-inline">
                        <select className="tf-select" value={mediaType} onChange={(e) => setMediaType(e.target.value)}>
                            <option value="">Select Media Type</option>
                            <option value="movie">Movie</option>
                            <option value="tv">TV Show</option>
                            <option value="episode">TV Episode</option>
                            <option value="music">Music</option>
                            <option value="unsorted">Unsorted</option>
                        </select>
                        <input className="tf-input tf-year" type="number" placeholder="Year" value={year} onChange={(e) => setYear(e.target.value)} />
                    </div>
                </div>

                {/* Autocomplete */}
                <div className="tf-row">
                    <label>Search (Autocomplete)</label>
                    <div className="tf-search-wrap" ref={resultsRef}>
                        <input
                            className="tf-input tf-search"
                            type="search"
                            placeholder={mediaType ? `Search ${mediaType === "movie" ? "movies" : "shows"}...` : "Select media type first"}
                            value={query} onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={onKeyDownResults}
                            disabled={!mediaType || !searchSupportedMediaTypes.includes(mediaType)}
                        />
                        {loadingResults && <div className="tf-loader">Searching…</div>}
                        {results.length > 0 && (
                            <ul className="tf-results">
                                {results.map((r, i) => (
                                    <li key={`${r.id}-${i}`} className={`tf-result ${i === activeIndex ? "active" : ""}`} onMouseEnter={() => setActiveIndex(i)} onClick={() => pickResult(r)}>
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
                </div>

                {/* Correct name */}
                <div className="tf-row">
                    <label>Correct Name</label>
                    <input className="tf-input" type="text" value={correctName} onChange={(e) => setCorrectName(e.target.value)} />
                </div>

                {/* Episode */}
                {(mediaType === "episode" /* || mediaType === "tv" */ ) && (
                    <div className="tf-row tf-episode-row">
                        <input className="tf-input" type="number" placeholder="Season" value={season} onChange={(e) => setSeason(e.target.value)} />
                        <input className="tf-input" type="number" placeholder="Episode" value={episode} onChange={(e) => setEpisode(e.target.value)} />
                        <input className="tf-input" type="text" placeholder="Episode Title" value={episodeTitle} onChange={(e) => setEpisodeTitle(e.target.value)} />
                    </div>
                )}

                {/* Tags */}
                <div className="tf-row">
                    <label>Tags</label>
                    <input className="tf-input" type="text" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Comma separated" />
                </div>

                {/* Custom Metadata */}
                <div className="tf-row">
                    <label>Custom Metadata (JSON)</label>
                    <input className="tf-input" type="text" value={customMetadata} onChange={(e) => setCustomMetadata(e.target.value)} placeholder='{"quality":"1080p"}' />
                </div>

                {/* Submit */}
                <div className="tf-row">
                    <button type="submit" className={`tf-button ${!mediaType ? "tf-button-disabled" : ""}`} disabled={!mediaType}>
                        Add Torrent
                    </button>
                </div>
            </form>
        </div>
    );
}
