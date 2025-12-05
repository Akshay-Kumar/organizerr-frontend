// src/hooks/useTorrents.js
import { useEffect, useState, useRef } from "react";
import { getTorrents, stopTorrent, resumeTorrent, deleteTorrent } from "../api/api";

export default function useTorrents(token) {
    const [torrents, setTorrents] = useState([]);
    const wsRef = useRef(null);
    const reconnectTimeout = useRef(null);

    const fetchTorrents = async () => {
        try {
            const res = await getTorrents(); // DB torrents only
            const sorted = (res.data || []).sort((a, b) => b.id - a.id);
            setTorrents(sorted);
        } catch (err) {
            console.error("fetchTorrents error:", err);
        }
    };

    useEffect(() => {
        if (!token) return;

        fetchTorrents(); // initial DB fetch

        const connectWS = () => {
            // Determine WS protocol
            const pageProtocol = window.location.protocol === "https:" ? "wss" : "ws";
            const backendHost = process.env.REACT_APP_WS_HOST || window.location.hostname;
            const backendPort = process.env.REACT_APP_WS_PORT || "443";
            const portPart = backendPort ? `:${backendPort}` : "";
            const wsUrl = `${pageProtocol}://${backendHost}${portPart}/ws/torrents?token=${token}`;

            console.log("Connecting WebSocket:", wsUrl);

            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log("WebSocket connected");
            };

            ws.onmessage = (e) => {
                try {
                    const data = JSON.parse(e.data);
                    if (data.type === "torrents_snapshot") {
                        // Sort by db_id (or created_at) descending
                        const sorted = data.torrents.sort((a, b) => b.id - a.id);
                        setTorrents(sorted);
                    }
                } catch (err) {
                    console.error("WS parse error:", err);
                }
            };

            ws.onerror = (err) => {
                console.error("WebSocket error:", err);
                ws.close();
            };

            ws.onclose = () => {
                console.warn("WebSocket closed. Reconnecting in 2s...");
                reconnectTimeout.current = setTimeout(connectWS, 2000);
            };
        };

        connectWS();

        return () => {
            if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
            if (wsRef.current) wsRef.current.close();
        };
    }, [token]);

    const stopTorrentProcess = (id) => stopTorrent(id, token);
    const resumeTorrentProcess = (id) => resumeTorrent(id, token);
    const deleteTorrentProcess = async (id) => {
        await deleteTorrent(id, token);
        fetchTorrents(); // refresh DB after deletion
    };

    return { torrents, stopTorrentProcess, resumeTorrentProcess, deleteTorrentProcess };
}
