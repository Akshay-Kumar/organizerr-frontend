// src/pages/TorrentsDashboard.js
import React, { useMemo, useState } from "react";
import useTorrents from "../hooks/useTorrents";
import "./TorrentsDashboard.css";

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

function getMoveState(torrent, fileOperation) {
    if (fileOperation?.success === true) return "moved";
    if (fileOperation?.success === false) return "failed";

    if (isDownloadComplete(torrent)) {
        return "waiting";
    }

    return "processing";
}

function getMoveLabel(moveState) {
    if (moveState === "moved") return "Moved Successfully";
    if (moveState === "failed") return "Move Failed";
    if (moveState === "waiting") return "Waiting for Organizer";
    return "Downloading / In Progress";
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
    const { torrents, stopTorrentProcess, resumeTorrentProcess, deleteTorrentProcess } =
        useTorrents(token);

    const [query, setQuery] = useState("");

    const filtered = useMemo(() => {
        return torrents.filter((t) =>
            (t.name || "").toLowerCase().includes(query.toLowerCase())
        );
    }, [torrents, query]);

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
                {filtered.map((t) => {
                    const state = normalizeState(t.state);
                    const fileOp = t.fileOperation;
                    const moveState = getMoveState(t, fileOp);
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
                                    <span className="torrent-name">{t.name}</span>
                                    <span className={`badge ${state}`}>{state}</span>
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
                                    <div className="torrent-move-header">
                                        <span className={`move-badge ${moveState}`}>
                                            {getMoveLabel(moveState)}
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