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
    const [loaded, setLoaded] = useState(false);

    const wsRef = useRef(null);
    const reconnectTimerRef = useRef(null);
    const attemptRef = useRef(0);
    const stoppedRef = useRef(false);
    const lastUpdateRef = useRef(Date.now());
    const fallbackTriggeredRef = useRef(false);
    const loadedRef = useRef(false);

    // -----------------------------
    // FETCH FUNCTIONS
    // -----------------------------

    const fetchTorrents = async () => {
        try {
            const res = await getTorrents(token);
            const sorted = (res.data || []).slice().sort((a, b) => b.id - a.id);
            setTorrents(prev => {
                const map = new Map(prev.map(t => [t.id, t]));

                sorted.forEach(t => {
                    map.set(t.id, { ...map.get(t.id), ...t });
                });

                return Array.from(map.values()).sort((a, b) => b.id - a.id);
            });
        } catch (err) {
            console.error("fetchTorrents error:", err);
        }
    };

    const fetchFileOperations = async () => {
        try {
            const res = await getFileOperations(token);
            const opsArray = res.data || [];
            const map = {};
            opsArray.forEach(op => {
                if (op.info_hash) {
                    map[normalizeHash(op.info_hash)] = op;
                }
            });
            setFileOperations(map);
        } catch (err) {
            console.error("fetchFileOperations error:", err);
        }
    };

    useEffect(() => {
        if (!token) return;

        stoppedRef.current = false;

        // -----------------------------
        // INITIAL FETCH (CRITICAL)
        // -----------------------------
        fetchTorrents().then(() => {
            setLoaded(true);
            loadedRef.current = true;
        });

        fetchFileOperations();

        // -----------------------------
        // WS HEALTH CHECK
        // -----------------------------
        const healthCheck = setInterval(() => {
            const now = Date.now();

            if (now - lastUpdateRef.current > 30000) {
                if (!fallbackTriggeredRef.current) {
                    console.warn("WS stale → fallback sync");

                    fetchTorrents(); // ✅ ENABLED

                    fallbackTriggeredRef.current = true;
                }
            } else {
                fallbackTriggeredRef.current = false;
            }
        }, 15000);

        // -----------------------------
        // WEBSOCKET
        // -----------------------------
        const connectWS = () => {
            if (stoppedRef.current) return;

            if (wsRef.current) {
                try { wsRef.current.close(); } catch {}
                wsRef.current = null;
            }

            const wsUrl = buildWsUrl(token);
            console.log("Connecting WebSocket:", wsUrl);

            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                lastUpdateRef.current = Date.now();
                attemptRef.current = 0; // ✅ RESET
                console.log("WS Open");
            };

            ws.onmessage = (e) => {
                console.log("WS RAW:", e.data);

                try {
                    const data = JSON.parse(e.data);

                    lastUpdateRef.current = Date.now(); // ✅ moved AFTER parse

                    if (data.type === "connected") {
                        console.log("WS connected");
                    }

                    if (data.type === "torrents_snapshot") {
                        const incoming = (data.torrents || []).slice().sort((a, b) => b.id - a.id);

                        setTorrents(prev => {
                            const map = new Map(prev.map(t => [t.id, t]));
                            incoming.forEach(t => {
                                map.set(t.id, { ...map.get(t.id), ...t });
                            });
                            return Array.from(map.values()).sort((a, b) => b.id - a.id);
                        });

                        setLoaded(true);
                        loadedRef.current = true;
                    }

                    if (data.type === "file_ops_refresh") {
                        fetchFileOperations(); // ✅ simplified
                    }

                    if (data.type === "file_ops_update") {
                        fetchFileOperations(); // simple + reliable
                    }

                } catch (err) {
                    console.error("WS parse error:", err);
                }
            };

            ws.onclose = () => {
                if (stoppedRef.current) return;

                attemptRef.current++;
                const delay = Math.min(5000, 1000 * Math.pow(2, attemptRef.current));

                console.warn(`WebSocket closed. Reconnecting in ${delay / 1000}s`);

                reconnectTimerRef.current = setTimeout(connectWS, delay);
            };

            ws.onerror = (err) => {
                console.error("WebSocket error:", err);
                try { ws.close(); } catch {}
            };
        };

        connectWS();

        // -----------------------------
        // SAFETY TIMEOUT
        // -----------------------------
        const timeout = setTimeout(() => {
            if (!loadedRef.current) {
                console.warn("WS snapshot not received → forcing loaded");
                setLoaded(true);
            }
        }, 5000);

        // -----------------------------
        // CLEANUP
        // -----------------------------
        return () => {
            stoppedRef.current = true;

            clearInterval(healthCheck);
            clearTimeout(timeout);

            if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current);
            }

            if (wsRef.current) {
                try { wsRef.current.close(); } catch {}
            }
        };

    }, [token]);

    // -----------------------------
    // ACTIONS
    // -----------------------------

    const stopTorrentProcess = async (id) => {
        await stopTorrent(id, token);
        fetchTorrents();
    };

    const resumeTorrentProcess = async (id) => {
        await resumeTorrent(id, token);
        fetchTorrents();
    };

    const deleteTorrentProcess = async (id) => {
        await deleteTorrent(id, token);
        fetchTorrents();
    };

    // -----------------------------
    // MERGE FILE OPS
    // -----------------------------

    const mergedTorrents = torrents.map((t) => {
        const hash = normalizeHash(t.info_hash || t.hash || t.infoHash);
        return {
            ...t,
            fileOperation: hash ? fileOperations[hash] || null : null,
        };
    });

    return {
        torrents: mergedTorrents,
        loaded,   // ✅ expose this
        stopTorrentProcess,
        resumeTorrentProcess,
        deleteTorrentProcess,
        refreshFileOperations: fetchFileOperations,
    };
}