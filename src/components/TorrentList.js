// src/components/TorrentList.js
import React, { useState } from "react";
import useTorrents from "../hooks/useTorrents";
import TorrentItem from "./TorrentItem";
import "./TorrentList.css";

export default function TorrentList({ token }) {
    const { torrents, stopTorrentProcess, resumeTorrentProcess, deleteTorrentProcess } = useTorrents(token);
    const [deleteTarget, setDeleteTarget] = useState(null);

    return (
        <div className="torrent-list-vertical">
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
