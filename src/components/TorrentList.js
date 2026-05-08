// src/components/TorrentList.js
import React, { useState } from "react";
import useTorrents from "../hooks/useTorrents";
import TorrentItem from "./TorrentItem";
import "./TorrentList.css";
import "./Loading.css"

export default function TorrentList({ token }) {
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [page, setPage] = useState(1);
    const pageSize = 10;
    const {
        torrents,
        stopTorrentProcess,
        resumeTorrentProcess,
        deleteTorrentProcess,
        loaded,

        totalPages,
        totalItems,

    } = useTorrents(token, page, pageSize);

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
        <div className="torrent-list-vertical">
            <div className="pagination-bar">
                <div className="pagination-info">
                    Showing page {page} of {totalPages} ({totalItems} torrents)
                </div>

                <div className="pagination-controls">
                    <button
                        disabled={page <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                        Previous
                    </button>
                        {Array.from(
                            {
                                length: Math.min(5, totalPages)
                            },
                            (_, i) => {

                                let start = Math.max(1, page - 2);

                                if (start + 4 > totalPages) {
                                    start = Math.max(1, totalPages - 4);
                                }

                                return start + i;
                            }
                        ).map((p) => (
                            <button
                                key={p}
                                className={p === page ? "active" : ""}
                                onClick={() => setPage(p)}
                            >
                                {p}
                            </button>
                        ))}

                    <button
                        disabled={page >= totalPages}
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                        Next
                    </button>

                </div>
            </div>
            {torrents.map(t => (
                <TorrentItem
                    key={t.id || t.info_hash}
                    torrent={t}
                    live={t.live || {}} // safe fallback
                    onAction={{
                        stop: () => stopTorrentProcess(t.id),       // use DB id
                        resume: () => resumeTorrentProcess(t.id),   // use DB id
                        remove: () => setDeleteTarget(t.id),        // use DB id
                    }}
                />
            ))}
            {deleteTarget && (
                <div className="modal-overlay">
                    <div className="modal">
                        <h3>Confirm Delete</h3>
                        <p>Are you sure you want to delete this torrent?</p>
                        <div className="modal-actions">
                            <button onClick={() => { deleteTorrentProcess(deleteTarget); setDeleteTarget(null); }}>Yes</button>
                            <button onClick={() => setDeleteTarget(null)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
