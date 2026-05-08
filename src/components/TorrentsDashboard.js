// src/pages/TorrentsDashboard.js
import React, { useMemo, useState, useEffect } from "react";
import useTorrents from "../hooks/useTorrents";
import "./TorrentsDashboard.css";
import "./Loading.css"

const STAGE_LABELS = {
    copy: "Copying",
    metadata: "Metadata",
    subtitles: "Subtitles",
    artwork: "Artwork",
    validation: "Validating",
    plex: "Plex Scan",
    emby: "Emby Scan",
    completed: "Completed",
    media_info: "Media Info",
};

const STAGE_PRIORITY = {
    media_info: 1,
    metadata: 2,
    copy: 3,
    artwork: 4,
    subtitles: 5,
    validation: 6,
    plex: 7,
    emby: 8,
    completed: 999
};

const getFileIcon = (filename = "") => {

    const ext = filename
        .split(".")
        .pop()
        ?.toLowerCase();

    // Video
    if ([
        "mkv",
        "mp4",
        "avi",
        "mov",
        "wmv",
        "flv",
        "webm",
        "m4v",
    ].includes(ext)) {
        return "🎬";
    }

    // Subtitle
    if ([
        "srt",
        "ass",
        "ssa",
        "sub",
    ].includes(ext)) {
        return "📝";
    }

    // Image
    if ([
        "jpg",
        "jpeg",
        "png",
        "webp",
        "gif",
    ].includes(ext)) {
        return "🖼️";
    }

    // Audio
    if ([
        "mp3",
        "flac",
        "aac",
        "wav",
        "opus",
    ].includes(ext)) {
        return "🎵";
    }

    // Archive
    if ([
        "zip",
        "rar",
        "7z",
        "tar",
        "gz",
    ].includes(ext)) {
        return "📦";
    }

    return "📄";
};

function formatBytesPerSec(bps) {
    const n = Number(bps || 0);
    if (!Number.isFinite(n) || n <= 0) return "0 B/s";
    const units = ["B/s", "KB/s", "MB/s", "GB/s"];
    let v = n;
    let i = 0;
    while (v >= 1024 && i < units.length - 1) {
        v /= 1024;
        i++;
    }
    return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatEta(seconds) {
    const s = Number(seconds);
    if (!Number.isFinite(s) || s < 0) return "—";
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

function normalizeState(state) {
    const s = String(state || "").toLowerCase().trim();

    if (!s) return "other";

    if (s.includes("error")) return "error";
    if (s === "missing") return "missing";

    // Check paused first so pausedUP / pausedDL do not become seeding/downloading
    if (s.includes("pause")) return "paused";

    if (
        s.includes("downloading") ||
        s.includes("forceddl") ||
        s.includes("metadl") ||
        s.includes("stalleddl") ||
        s.includes("queueddl")
    ) {
        return "downloading";
    }

    if (
        s.includes("uploading") ||
        s.includes("forcedup") ||
        s.includes("stalledup") ||
        s.includes("queuedup") ||
        s === "seeding"
    ) {
        return "seeding";
    }

    return "other";
}

function formatDateTime(value) {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString();
}

function formatProgress(progress) {
    const n = Number(progress || 0);
    if (!Number.isFinite(n)) return "0%";
    return `${Math.max(0, Math.min(100, n)).toFixed(1)}%`;
}

function formatFileSize(bytes) {
    const n = Number(bytes || 0);
    if (!Number.isFinite(n) || n <= 0) return "—";

    const units = ["B", "KB", "MB", "GB", "TB"];
    let v = n;
    let i = 0;

    while (v >= 1024 && i < units.length - 1) {
        v /= 1024;
        i++;
    }

    return `${v.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

function isDownloadComplete(torrent) {
    const progress = Number(torrent?.progress || 0);
    return progress >= 100;
}
/*
function getMoveState(torrent) {
    const latestOpsMap = {};

    (torrent.fileOperations || []).forEach(op => {
        if (!op.file_hash) return;

        if (
            !latestOpsMap[op.file_hash] ||
            new Date(op.timestamp || 0) > new Date(latestOpsMap[op.file_hash].timestamp || 0)
        ) {
            latestOpsMap[op.file_hash] = op;
        }
    });

    const fileOps = Object.values(latestOpsMap);

    if (!fileOps.length) return "processing";

    const allCompleted = fileOps.every(
        op => op.status === "completed" && op.progress === 100
    );

    // ✅ IMPORTANT: check this FIRST
    if (allCompleted) return "moved";

    const anyFailed = fileOps.some(
        op => op.status === "failed"
    );

    if (anyFailed) return "failed";

    if (isDownloadComplete(torrent)) return "waiting";

    return "processing";
}
*/

function getMoveState(torrent) {
    const fileOps = torrent.fileOperations || [];

    if (!fileOps.length) {
        return isDownloadComplete(torrent)
            ? "waiting"
            : "processing";
    }

    // Any failed file = failed torrent
    const anyFailed = fileOps.some(
        op => op.status === "failed"
    );

    if (anyFailed) {
        return "failed";
    }

    // Any active processing file = processing
    const anyProcessing = fileOps.some(
        op =>
            op.status === "processing" &&
            op.stage !== "completed"
    );

    if (anyProcessing) {
        return "processing";
    }

    // All completed
    const allCompleted = fileOps.every(
        op =>
            op.status === "completed" ||
            op.stage === "completed" ||
            op.progress === 100
    );

    if (allCompleted) {
        return "moved";
    }

    // Torrent download completed but organizer not started
    if (isDownloadComplete(torrent)) {
        return "waiting";
    }

    return "processing";
}

function getCurrentStage(fileOps = []) {
    const active = fileOps
        .filter(op => op.status === "processing")
        .sort((a, b) => {
            const pa = STAGE_PRIORITY[a.stage] ?? 0;
            const pb = STAGE_PRIORITY[b.stage] ?? 0;
            return pb - pa;
        });

    return active[0]?.stage || null;
}

/*
function getMoveLabel(moveState) {
    if (moveState === "moved") return "Moved Successfully";
    if (moveState === "failed") return "Move Failed";
    if (moveState === "waiting") return "Waiting for Media-Organizerr";
    return "Downloading / In Progress";
}
*/

function getMoveLabel(moveState, torrent) {
    if (moveState === "moved") {
        return "Moved Successfully";
    }

    if (moveState === "failed") {
        return "Move Failed";
    }

    if (moveState === "waiting") {
        return "Waiting for Media-Organizerr";
    }

    const currentStage = getCurrentStage(
        torrent.fileOperations
    );

    if (currentStage && STAGE_LABELS[currentStage]) {
        return STAGE_LABELS[currentStage];
    }

    return "Processing";
}

function getHashStatus(fileOperation) {
    if (!fileOperation) return "none";
    if (fileOperation.success === true && fileOperation.file_hash) return "verified";
    if (fileOperation.file_hash) return "present";
    return "missing";
}

function getHashLabel(hashStatus) {
    if (hashStatus === "verified") return "Hash Available";
    if (hashStatus === "present") return "Hash Recorded";
    return "No Hash";
}

export default function TorrentsDashboard() {
    const token = localStorage.getItem("token");
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const isAdmin = !!user?.is_admin;
    const {
        torrents,
        stopTorrentProcess,
        resumeTorrentProcess,
        deleteTorrentProcess,
        loaded,

        page,
        setPage,

        pageSize,
        setPageSize,

        totalPages,
        totalItems,

        refreshTorrents
    } = useTorrents(token);

    const [query, setQuery] = useState("");
    const [expanded, setExpanded] = useState({});
    const [expandedFiles, setExpandedFiles] = useState({});

    const toggleFileExpand = (fileHash) => {
        setExpandedFiles(prev => ({
            ...prev,
            [fileHash]: !prev[fileHash]
        }));
    };

    const toggleExpand = (id) => {
        setExpanded(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    useEffect(() => {
        console.log("PAGE CHANGED:", page);
    }, [page]);

    useEffect(() => {
        const handleTorrentAdded = () => {
            setPage(1);
            refreshTorrents();
        };

        window.addEventListener(
            "torrent-added",
            handleTorrentAdded
        );

        return () => {
            window.removeEventListener(
                "torrent-added",
                handleTorrentAdded
            );
        };
    }, [refreshTorrents, setPage]);

    useEffect(() => {
        console.log(
            "[STATE] PAGE CHANGED",
            page
        );
    }, [page]);

    useEffect(() => {
        console.log(
            "[STATE] TORRENTS UPDATED",
            torrents.length,
            torrents.map(t => t.display_name)
        );
    }, [torrents]);

    const filtered = useMemo(() => {
        const q = query.toLowerCase();

        return torrents.filter((t) => {
            return (
                (t.display_name || "").toLowerCase().includes(q) ||
                (t.correct_name || "").toLowerCase().includes(q) ||
                (t.name || "").toLowerCase().includes(q) ||
                (t.episode_title || "").toLowerCase().includes(q)
            );
        });
    }, [torrents, query]);


    if (!loaded) {
        return (
            <div className="skeleton-list">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div className="skeleton-row" key={i}>
                        <div className="skeleton-thumb"></div>

                        <div className="skeleton-content">
                            <div className="skeleton-line title"></div>
                            <div className="skeleton-line"></div>
                            <div className="skeleton-line short"></div>

                            <div className="skeleton-progress">
                                <div className="skeleton-progress-bar"></div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="dashboard">
            <div className="dashboard-header">
                <h2>Torrents Dashboard</h2>
                <input
                    type="text"
                    placeholder="Search torrents..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="search-input"
                />
            </div>

            <div className="torrent-list">
                <div className="pagination-bar">

                    <div className="pagination-left">
                        Showing page {page} of {totalPages}
                        <span className="pagination-total">
                            ({totalItems} torrents)
                        </span>
                    </div>

                    <div className="pagination-center">

                        <button
                            disabled={page <= 1}
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                        >
                            Previous
                        </button>

                        {Array.from(
                            { length: Math.min(totalPages, 5) },
                            (_, i) => {
                                let pageNum;

                                if (totalPages <= 5) {
                                    pageNum = i + 1;
                                } else if (page <= 3) {
                                    pageNum = i + 1;
                                } else if (page >= totalPages - 2) {
                                    pageNum = totalPages - 4 + i;
                                } else {
                                    pageNum = page - 2 + i;
                                }

                                return (
                                    <button
                                        key={pageNum}
                                        className={
                                            page === pageNum
                                                ? "active-page"
                                                : ""
                                        }
                                        onClick={() => {
                                            console.log(
                                                "[UI] GO TO PAGE",
                                                pageNum
                                            );

                                            setPage(pageNum);
                                        }}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            }
                        )}

                        <button
                            disabled={page >= totalPages}
                            onClick={() =>
                                setPage(p => Math.min(totalPages, p + 1))
                            }
                        >
                            Next
                        </button>
                    </div>

                    <div className="pagination-right">

                        {isAdmin && (
                            <select
                                value={pageSize}
                                onChange={(e) => {
                                    setPage(1);
                                    setPageSize(Number(e.target.value));
                                }}
                            >
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                        )}

                    </div>
                </div>
                {filtered.map((t) => {
                    const state = normalizeState(t.state);
                    const fileOp = (t.fileOperations || [])
                        .slice()
                        .sort((a, b) => (new Date(b.timestamp || 0) - new Date(a.timestamp || 0)))[0] || null;
                    const moveState = getMoveState(t, fileOp);
                    /*
                    const dedupedOps = Object.values(
                        (t.fileOperations || []).reduce((acc, op) => {
                            if (!op.file_hash) return acc;

                            const existing = acc[op.file_hash];

                            const getTime = (ts) => new Date(ts || 0).getTime();

                            if (!existing || getTime(op.timestamp) > getTime(existing.timestamp)) {
                                acc[op.file_hash] = op;
                            }

                            return acc;
                        }, {})
                    );
                    */
                    const dedupedOps = Object.values(
                        (t.fileOperations || []).reduce((acc, op) => {
                            if (!op.file_hash) return acc;

                            const existing = acc[op.file_hash];

                            const currentPriority =
                                STAGE_PRIORITY[op.stage] ?? 500;

                            const existingPriority =
                                STAGE_PRIORITY[existing?.stage] ?? 500;

                            // Prefer active stages over completed
                            if (
                                !existing ||
                                currentPriority > existingPriority ||
                                (
                                    currentPriority === existingPriority &&
                                    new Date(op.timestamp || 0) >
                                    new Date(existing.timestamp || 0)
                                )
                            ) {
                                acc[op.file_hash] = op;
                            }

                            return acc;
                        }, {})
                    );
                    const hashStatus = getHashStatus(fileOp);

                    return (
                        <div key={t.id} className="torrent-card">
                            <div className="torrent-left">
                                {t.poster ? (
                                    <img src={t.poster} alt="" className="poster" />
                                ) : (
                                    <div className="poster-placeholder">No Poster</div>
                                )}
                            </div>

                            <div className="torrent-middle">
                                <div className="torrent-title">
                                    <span className="torrent-name">
                                        {t.display_name || t.correct_name || t.name}
                                    </span>

                                    {/* 🆕 FILE COUNT */}
                                    {t.fileOperations?.length > 0 && (
                                        <span
                                            className="file-count clickable"
                                            onClick={() => toggleExpand(t.id)}
                                        >
                                            {t.fileOperations.length === 1
                                                ? "1 file"
                                                : `${t.fileOperations.length} files`}
                                            {expanded[t.id] ? "▲" : "▼"}
                                        </span>
                                    )}

                                    <span className={`badge ${state}`}>
                                        {state}
                                    </span>
                                </div>

                                <div className="progress-bar">
                                    <div
                                        className="progress-fill"
                                        style={{
                                            width: `${Math.max(
                                                0,
                                                Math.min(100, Number(t.progress || 0))
                                            )}%`,
                                        }}
                                    />
                                </div>

                                <div className="torrent-meta">
                                    <span>{formatProgress(t.progress)}</span>
                                    <span>⬇ {formatBytesPerSec(t.dlspeed)}</span>
                                    <span>⬆ {formatBytesPerSec(t.upspeed)}</span>
                                    <span>ETA: {formatEta(t.eta)}</span>
                                </div>

                                <div className="torrent-move-section">
                                    {(expanded[t.id] || t.fileOperations?.length === 1) && (
                                        <div className="file-ops-list">
                                            {dedupedOps.slice(0, 20).map(op => (
                                                <div key={op.file_hash} className="file-op-container">
                                                    <div className="file-op-row">

                                                        <div className="file-op-left">
                                                            <span className="file-name" title={op.source}>
                                                                <span className="file-icon">
                                                                    {getFileIcon(op.source)}
                                                                </span>
                                                                {op.source?.split(/[\\/]/).pop() || "Unknown file"}
                                                            </span>

                                                            <span className={`file-stage ${op.status || ""}`}>
                                                                {STAGE_LABELS[op.stage] || "Processing"}
                                                            </span>
                                                        </div>

                                                        <div className="file-progress-row">
                                                            <div className="file-progress-bar">
                                                                <div
                                                                    className="file-progress-fill"
                                                                    style={{
                                                                        width: `${op.progress || 0}%`
                                                                    }}
                                                                />
                                                            </div>

                                                            <div className="file-op-right">
                                                                <span className="file-progress-text">
                                                                    {Math.round(op.progress || 0)}%
                                                                </span>

                                                                <span className={`status ${
                                                                    op.status === "completed"
                                                                        ? "success"
                                                                        : op.status === "failed"
                                                                            ? "failed"
                                                                            : "processing"
                                                                }`}>
                                                                    {op.status === "completed"
                                                                        ? "✔"
                                                                        : op.status === "failed"
                                                                            ? "✖"
                                                                            : "⏳"}
                                                                </span>

                                                                <span className="file-size">
                                                                    {formatFileSize(op.file_size)}
                                                                </span>

                                                                <span className="file-time">
                                                                    {op.timestamp
                                                                        ? formatDateTime(op.timestamp)
                                                                        : "—"}
                                                                </span>

                                                                <button
                                                                    className="file-expand-btn"
                                                                    onClick={() => toggleFileExpand(op.file_hash)}
                                                                >
                                                                    {expandedFiles[op.file_hash] ? "−" : "+"}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* ✅ ADD THIS BLOCK */}
                                                    {expandedFiles[op.file_hash] && (
                                                        <div className="file-extra-details">

                                                            <div className="move-row">
                                                                <span className="move-label">Source</span>
                                                                <span
                                                                    className="move-path"
                                                                    title={op.source || "—"}
                                                                >
                                                                    {op.source || "—"}
                                                                </span>
                                                            </div>

                                                            <div className="move-row">
                                                                <span className="move-label">Destination</span>
                                                                <span
                                                                    className="move-path"
                                                                    title={op.destination || "—"}
                                                                >
                                                                    {op.destination || "—"}
                                                                </span>
                                                            </div>

                                                            <div className="move-row">
                                                                <span className="move-label">Backup</span>
                                                                <span
                                                                    className="move-path"
                                                                    title={op.backup || "—"}
                                                                >
                                                                    {op.backup || "—"}
                                                                </span>
                                                            </div>

                                                            <div className="move-row">
                                                                <span className="move-label">Hash</span>
                                                                <span
                                                                    className="move-path hash-text"
                                                                    title={op.file_hash || "—"}
                                                                >
                                                                    {op.file_hash || "—"}
                                                                </span>
                                                            </div>

                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <div className="torrent-move-header">
                                        <span className={`move-badge ${moveState}`}>
                                            {getMoveLabel(moveState, t)}
                                        </span>

                                        <div className="torrent-move-badges">
                                            <span className={`hash-badge ${hashStatus}`}>
                                                {getHashLabel(hashStatus)}
                                            </span>
                                            <span className="move-time">
                                                {fileOp?.timestamp
                                                    ? formatDateTime(fileOp.timestamp)
                                                    : "—"}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="torrent-move-summary">
                                        <div className="summary-item">
                                            <span className="summary-label">Size</span>
                                            <span className="summary-value">
                                                {formatFileSize(fileOp?.file_size)}
                                            </span>
                                        </div>

                                        <div className="summary-item">
                                            <span className="summary-label">Operation</span>
                                            <span className="summary-value">
                                                {fileOp?.operation || "—"}
                                            </span>
                                        </div>

                                        <div className="summary-item">
                                            <span className="summary-label">Hash</span>
                                            <span
                                                className="summary-value hash-text"
                                                title={fileOp?.file_hash || "—"}
                                            >
                                                {fileOp?.file_hash || "—"}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="torrent-move-details">
                                        <div className="move-row">
                                            <span className="move-label">Source</span>
                                            <span
                                                className="move-path"
                                                title={fileOp?.source || "—"}
                                            >
                                                {fileOp?.source || "—"}
                                            </span>
                                        </div>

                                        <div className="move-row">
                                            <span className="move-label">Destination</span>
                                            <span
                                                className="move-path"
                                                title={fileOp?.destination || "—"}
                                            >
                                                {fileOp?.destination || "—"}
                                            </span>
                                        </div>

                                        <div className="move-row">
                                            <span className="move-label">Backup</span>
                                            <span
                                                className="move-path"
                                                title={fileOp?.backup || "—"}
                                            >
                                                {fileOp?.backup || "—"}
                                            </span>
                                        </div>

                                        <div className="move-row">
                                            <span className="move-label">Info Hash</span>
                                            <span
                                                className="move-path hash-text"
                                                title={t.info_hash || t.hash || "—"}
                                            >
                                                {t.info_hash || t.hash || "—"}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="torrent-actions">
                                <button onClick={() => stopTorrentProcess(t.id)}>
                                    Stop
                                </button>
                                <button onClick={() => resumeTorrentProcess(t.id)}>
                                    Resume
                                </button>
                                <button
                                    className="delete-btn"
                                    onClick={() => deleteTorrentProcess(t.id)}
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    );
                })}

                {filtered.length === 0 && (
                    <div className="empty-state">No torrents found.</div>
                )}
            </div>
        </div>
    );
}