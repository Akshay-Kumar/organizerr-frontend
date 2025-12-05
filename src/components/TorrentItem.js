import React, { useState } from "react";
import ProgressBar from "./ProgressBar";
import "./TorrentItem.css";

export default function TorrentItem({ torrent, live = {}, onAction = {} }) {
    const [showInfo, setShowInfo] = useState(false);

    const progress = live.progress ?? torrent.progress ?? 0;
    const state = live.state ?? torrent.state ?? "idle";
    const dlspeed = live.dlspeed ?? torrent.dlspeed ?? 0;
    const eta = live.eta ?? torrent.eta ?? null;

    const fmtSpeed = (b) => {
        if (!b && b !== 0) return "0 B/s";
        const kb = 1024;
        if (b >= kb * kb) return `${(b / (kb * kb)).toFixed(1)} MB/s`;
        if (b >= kb) return `${(b / kb).toFixed(1)} KB/s`;
        return `${b} B/s`;
    };

    const fmtEta = (s) => {
        if (s == null) return "—";
        if (s < 60) return `${s}s`;
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m}m${sec ? `${sec}s` : ""}`;
    };

    const openModal = () => setShowInfo(true);
    const closeModal = () => setShowInfo(false);

    return (
        <div className={`ti-row ${showInfo ? "modal-open" : ""}`}>
            {/* Poster */}
            <div className="ti-poster-wrapper" onClick={openModal} title="Click to view details">
                {torrent.poster ? (
                    <img
                        src={torrent.poster}
                        alt={torrent.correct_name || torrent.name}
                        className="ti-poster"
                    />
                ) : (
                    <span>{torrent.correct_name || torrent.name}</span>
                )}
            </div>

            {/* Torrent Info */}
            <div className="ti-info">
                <div className="ti-title">{torrent.correct_name || torrent.name}</div>
                <div className="ti-progress-row">
                    <ProgressBar progress={progress} />
                    <div className="ti-progress-meta">
                        <span>{progress}%</span>
                        <span>• {state}</span>
                        <span>• {fmtSpeed(dlspeed)}</span>
                        <span>• ETA: {fmtEta(eta)}</span>
                    </div>

                    <div className="ti-actions">
                        {onAction.resume && <button onClick={() => onAction.resume(torrent.id)}>Resume</button>}
                        {onAction.stop && <button onClick={() => onAction.stop(torrent.id)}>Stop</button>}
                        {onAction.remove && <button onClick={() => onAction.remove(torrent.id)}>Delete</button>}
                        <button onClick={openModal}>More Info</button>
                    </div>
                </div>
            </div>

            {/* Modal */}
            {showInfo && (
                <div className="ti-modal active" onClick={closeModal}>
                    <div className="ti-modal-content" onClick={(e) => e.stopPropagation()}>
                        <button className="ti-modal-close" onClick={closeModal}>×</button>
                        <h3>{torrent.correct_name || torrent.name}</h3>
                        <pre>{JSON.stringify(torrent, null, 2)}</pre>
                    </div>
                </div>
            )}
        </div>
    );
}
