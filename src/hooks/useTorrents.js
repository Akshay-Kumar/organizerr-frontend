// src/hooks/useTorrents.js
import { useEffect, useState, useRef } from "react";
import { getTorrents, stopTorrent, resumeTorrent, deleteTorrent, getFileOperations } from "../api/api";

function normalizeHash(hash) {
    return String(hash || "").trim().toLowerCase();
}

function buildWsUrl(token) {
    const wsHost = process.env.REACT_APP_WS_HOST;
    const wsPort = process.env.REACT_APP_WS_PORT;
    const apiBase = process.env.REACT_APP_API_URL;

    // Prefer explicit WS host/port if provided
    if (wsHost) {
        const portStr = wsPort ? String(wsPort) : "";
        const proto =
            portStr === "443"
                ? "wss"
                : portStr === "80"
                    ? "ws"
                    : (window.location.protocol === "https:" ? "wss" : "ws");

        const portPart =
            portStr && portStr !== "80" && portStr !== "443" ? `:${portStr}` : "";

        return `${proto}://${wsHost}${portPart}/ws/torrents?token=${encodeURIComponent(token)}`;
    }

    // Else derive from API base
    if (apiBase) {
        const u = new URL(apiBase);
        const wsProto = u.protocol === "https:" ? "wss:" : "ws:";
        return `${wsProto}//${u.host}/ws/torrents?token=${encodeURIComponent(token)}`;
    }

    // Fallback: same host as the current page
    const pageProto = window.location.protocol === "https:" ? "wss" : "ws";
    return `${pageProto}://${window.location.host}/ws/torrents?token=${encodeURIComponent(token)}`;
}

export default function useTorrents(token) {
    const [torrents, setTorrents] = useState([]);
    const [fileOperations, setFileOperations] = useState({});

    const wsRef = useRef(null);
    const reconnectTimerRef = useRef(null);
    const attemptRef = useRef(0);
    const stoppedRef = useRef(false);

    const fetchTorrents = async () => {
        try {
            const res = await getTorrents(); // DB torrents only
            const sorted = (res.data || []).slice().sort((a, b) => b.id - a.id);
            setTorrents(sorted);
        } catch (err) {
            console.error("fetchTorrents error:", err);
        }
    };

    const fetchFileOperations = async () => {
        try {
            const res = await getFileOperations(token);
            setFileOperations(res.data?.operations || {});
        } catch (err) {
            console.error("fetchFileOperations error:", err);
        }
    };

    useEffect(() => {
        if (!token) return;

        stoppedRef.current = false;

        // Initial loads
        fetchTorrents();
        fetchFileOperations();

        // Poll file operations periodically
        const fileOpsInterval = setInterval(() => {
            fetchFileOperations();
        }, 10000); // every 10 seconds

        const connectWS = () => {
            if (stoppedRef.current) return;

            // Cleanup existing socket before reconnecting
            if (wsRef.current) {
                try {
                    wsRef.current.close();
                } catch {}
                wsRef.current = null;
            }

            const wsUrl = buildWsUrl(token);
            console.log("Connecting WebSocket:", wsUrl);

            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                attemptRef.current = 0; // reset backoff after success
                console.log("WebSocket connected");
            };

            ws.onmessage = (e) => {
                try {
                    const data = JSON.parse(e.data);

                    if (data.type === "torrents_snapshot") {
                        const sorted = (data.torrents || [])
                            .slice()
                            .sort((a, b) => b.id - a.id);

                        setTorrents(sorted);
                    }

                    // ignore {"type":"ping"}
                } catch (err) {
                    console.error("WS parse error:", err);
                }
            };

            ws.onerror = (err) => {
                console.error("WebSocket error:", err);
                // onclose will handle reconnect
                try {
                    ws.close();
                } catch {}
            };

            ws.onclose = () => {
                if (stoppedRef.current) return;

                // Exponential backoff: 1s, 2s, 4s, 8s... max 30s
                attemptRef.current += 1;
                const delay = Math.min(
                    30000,
                    1000 * Math.pow(2, attemptRef.current - 1)
                );

                console.warn(
                    `WebSocket closed. Reconnecting in ${Math.round(
                        delay / 1000
                    )}s... (attempt ${attemptRef.current})`
                );

                reconnectTimerRef.current = setTimeout(connectWS, delay);
            };
        };

        connectWS();

        return () => {
            stoppedRef.current = true;

            if (fileOpsInterval) {
                clearInterval(fileOpsInterval);
            }

            if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current);
                reconnectTimerRef.current = null;
            }

            if (wsRef.current) {
                try {
                    wsRef.current.close();
                } catch {}
                wsRef.current = null;
            }
        };
    }, [token]);

    const stopTorrentProcess = (id) => stopTorrent(id, token);
    const resumeTorrentProcess = (id) => resumeTorrent(id, token);

    const deleteTorrentProcess = async (id) => {
        await deleteTorrent(id, token);
        fetchTorrents(); // refresh DB after deletion
    };

    const mergedTorrents = torrents.map((t) => {
        const infoHash = normalizeHash(t.info_hash || t.hash);
        return {
            ...t,
            fileOperation: infoHash ? fileOperations[infoHash] || null : null,
        };
    });

    return {
        torrents: mergedTorrents,
        stopTorrentProcess,
        resumeTorrentProcess,
        deleteTorrentProcess,
        refreshFileOperations: fetchFileOperations,
    };
}
