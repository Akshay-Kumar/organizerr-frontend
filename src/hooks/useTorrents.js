import { useEffect, useState, useRef } from "react";
import { getTorrents, stopTorrent, resumeTorrent, deleteTorrent, getFileOperations, getTorrentById } from "../api/api";

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
export default function useTorrents(token, externalPage = null, externalPageSize = null) {
    const [torrents, setTorrents] = useState([]);
    const [internalPage, setInternalPage] = useState(1);
    const [internalPageSize, setInternalPageSize] = useState(
        Number(localStorage.getItem("torrent_page_size")) || 25
    );

    const page =
        externalPage ?? internalPage;

    const pageSize =
        externalPageSize ?? internalPageSize;

    const setPage =
        externalPage !== null
            ? () => {}
            : setInternalPage;

    const setPageSize =
        externalPageSize !== null
            ? () => {}
            : setInternalPageSize;

    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [fileOperations, setFileOperations] = useState({});
    const [loaded, setLoaded] = useState(false);

    const wsRef = useRef(null);
    const reconnectTimerRef = useRef(null);
    const attemptRef = useRef(0);
    const stoppedRef = useRef(false);
    const lastUpdateRef = useRef(Date.now());
    const fallbackTriggeredRef = useRef(false);
    const loadedRef = useRef(false);
    const lastUpdateTs = useRef({});
    const pageRef = useRef(page);

    // -----------------------------
    // FETCH FUNCTIONS
    // -----------------------------

    const fetchTorrents = async () => {
        try {
            console.log(
                "[FETCH] START",
                "page =", page,
                "pageSize =", pageSize
            );
            const res = await getTorrents(token, page, pageSize);
            const payload = res.data || {};

            console.log(
                "[FETCH] RESPONSE",
                {
                    page: payload.page,
                    totalPages: payload.total_pages,
                    items: payload.items?.length,
                    firstTorrent:
                    payload.items?.[0]?.display_name
                }
            );

            setTotalPages(payload.total_pages || 1);
            setTotalItems(payload.total || 0);

            const sorted = (payload.items || []).slice().sort((a, b) => b.id - a.id);
            console.log(
                "[FETCH] SET TORRENTS",
                sorted.map(t => t.display_name)
            );
            setTorrents(sorted);
            /*
            setTorrents(prev => {
                const map = new Map(prev.map(t => [t.id, t]));

                sorted.forEach(t => {
                    map.set(t.id, { ...map.get(t.id), ...t });
                });

                return Array.from(map.values()).sort((a, b) => b.id - a.id);
            });
            */
        } catch (err) {
            console.error("fetchTorrents error:", err);
        }
    };

    const refreshSingleTorrent = async (id) => {
        try {
            const res = await getTorrentById(id, token);
            const updatedTorrent = res.data;

            setTorrents(prev =>
                prev.map(t =>
                    t.id === id
                        ? {
                            ...t,
                            ...updatedTorrent
                        }
                        : t
                )
            );

        } catch (err) {
            console.error("Failed to refresh torrent:", err);
        }
    };

    const fetchFileOperations = async () => {
        try {
            const res = await getFileOperations(token);
            const opsArray = res.data || [];
            const map = {};

            opsArray.forEach(op => {
                if (!op?.info_hash || !op?.file_hash) return;
                const key = normalizeHash(op.info_hash);
                if (!key) return;
                if (!map[key]) map[key] = [];
                map[key].push(op);
            });

            // sort newest first
            Object.keys(map).forEach(k => {
                map[k].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            });

            console.log("📦 FETCHED FILE OPS MAP:");
            Object.keys(map).forEach(k => {
                console.log("HASH:", k, "COUNT:", map[k].length);
            });

            console.log("📡 RAW API RESPONSE:", res.data);

            setFileOperations(map);
        } catch (err) {
            console.error("fetchFileOperations error:", err);
        }
    };

    const handleFileOpUpdate = (op) => {
        if (!op?.info_hash || !op?.file_hash) return;

        const key = normalizeHash(op.info_hash);

        setFileOperations(prev => {
            const existingList = prev[key] || [];
            let updatedList = [...existingList];

            const index = updatedList.findIndex(
                (f) => f.file_hash === op.file_hash
            );

            if (index !== -1) {
                const existing = updatedList[index];

                updatedList[index] = {
                    ...existing,
                    ...op,
                    progress: Math.max(existing.progress || 0, op.progress || 0),
                };
            } else {
                updatedList.push(op);
            }

            // sort latest first
            updatedList.sort((a, b) => {
                const t = new Date(b.timestamp) - new Date(a.timestamp);
                if (t !== 0) return t;
                return (b.progress || 0) - (a.progress || 0);
            });

            return {
                ...prev,
                [key]: updatedList.slice(0, 50)
            };
        });
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

        /* FIX 4 — Prevent memory leak in throttle map (optional but smart) */
        setInterval(() => {
            const now = Date.now();
            Object.keys(lastUpdateTs.current).forEach((k) => {
                if (now - lastUpdateTs.current[k] > 60000) {
                    delete lastUpdateTs.current[k];
                }
            });
        }, 60000);

        // -----------------------------
        // WEBSOCKET
        // -----------------------------
        const connectWS = () => {
            if (stoppedRef.current) return;

            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                return; // ✅ DO NOT reconnect if already open
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

                    // 🔥 THROTTLE START
                    const now = Date.now();
                    if (data.type === "file_ops_update") {
                        if (!data.file_operation) return;

                        const key = `${data.file_operation?.info_hash || "x"}_${data.file_operation?.file_hash || "y"}`;
                        if (!(key in lastUpdateTs.current)) {
                            lastUpdateTs.current[key] = 0;
                        }
                        if (now - lastUpdateTs.current[key] < 100) return;
                        lastUpdateTs.current[key] = now;
                    }
                    // 🔥 THROTTLE END

                    lastUpdateRef.current = Date.now(); // ✅ moved AFTER parse

                    if (data.type === "connected") {
                        console.log("WS connected");
                    }

                    if (data.type === "torrents_snapshot") {
                        console.log(
                            "[WS] SNAPSHOT",
                            {
                                currentPage: pageRef.current,
                                incoming: data.torrents?.length,
                                firstTorrent:
                                data.torrents?.[0]?.display_name
                            }
                        );

                        // TEMP FIX FOR PAGINATION
                        /*
                        if (pageRef.current !== 1) {
                            return;
                        }
                        */
                        const incoming = (data.torrents || []).slice().sort((a, b) => b.id - a.id);
                        /*
                        setTorrents(prev => {
                            const map = new Map(prev.map(t => [t.id, t]));
                            incoming.forEach(t => {
                                map.set(t.id, { ...map.get(t.id), ...t });
                            });
                            return Array.from(map.values()).sort((a, b) => b.id - a.id);
                        });
                        */
                        console.log(
                            "[WS] PATCHING VISIBLE TORRENTS"
                        );
                        /*
                        setTorrents(incoming);
                        */
                        setTorrents(prev => {
                            const updates = new Map(
                                incoming.map(t => [
                                    normalizeHash(t.info_hash || t.hash),
                                    t
                                ])
                            );

                            return prev.map(existing => {
                                const key = normalizeHash(
                                    existing.info_hash || existing.hash
                                );

                                const updated = updates.get(key);

                                if (!updated) {
                                    return existing;
                                }

                                return {
                                    ...existing,
                                    ...updated,
                                    fileOperations:
                                        existing.fileOperations || [],
                                };
                            });
                        });
                        setLoaded(true);
                        loadedRef.current = true;
                    }

                    if (data.type === "file_ops_update") {
                        handleFileOpUpdate(data.file_operation);
                        console.log("FILE OP UPDATE:", data.file_operation);
                    }

                    if (data.type === "file_ops_snapshot") {
                        console.log("📦 FULL SNAPSHOT RECEIVED");

                        const map = {};

                        (data.file_operations || []).forEach(op => {
                            if (!op.info_hash || !op.file_hash) return;

                            const key = normalizeHash(op.info_hash);
                            if (!map[key]) map[key] = [];

                            map[key].push(op);
                        });

                        // sort newest first
                        Object.keys(map).forEach(k => {
                            map[k].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                        });

                        setFileOperations(map);
                    }


                } catch (err) {
                    console.error("WS parse error:", err);
                }
            };

            ws.onclose = (e) => {
                if (stoppedRef.current) return;

                if (attemptRef.current > 10) {
                    console.error("WS stopped reconnecting after 10 attempts");
                    return;
                }

                attemptRef.current++;

                const delay = Math.min(5000, 1000 * Math.pow(2, attemptRef.current));

                console.warn(
                    `WebSocket closed (${e.code}). Reconnecting in ${delay / 1000}s`
                );

                reconnectTimerRef.current = setTimeout(connectWS, delay);
            };

            ws.onerror = (err) => {
                console.error("WebSocket error:", err);
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

    useEffect(() => {
        if (!token) return;

        const interval = setInterval(() => {
            console.log("🔄 Syncing file operations...");
            fetchFileOperations();
        }, 15000); // every 15 seconds

        return () => clearInterval(interval);
    }, [token]);

    useEffect(() => {
        localStorage.setItem(
            "torrent_page_size",
            String(pageSize)
        );
    }, [pageSize]);

    useEffect(() => {
        console.log("FETCHING PAGE:", page, "SIZE:", pageSize);
    }, [page, pageSize]);

    useEffect(() => {
        if (!token) return;

        console.log(
            "[PAGE FETCH EFFECT]",
            "page =", page,
            "pageSize =", pageSize
        );

        fetchTorrents();

    }, [page, pageSize]);

    useEffect(() => {
        pageRef.current = page;
    }, [page]);

    // -----------------------------
    // ACTIONS
    // -----------------------------

    /*
    const stopTorrentProcess = async (id) => {
        await stopTorrent(id, token);
        await fetchTorrents();
    };

    const resumeTorrentProcess = async (id) => {
        await resumeTorrent(id, token);
        await fetchTorrents();
    };
    */
    const stopTorrentProcess = async (id) => {

        // Optimistic update
        setTorrents(prev =>
            prev.map(t =>
                t.id === id
                    ? {
                        ...t,
                        state: "paused",
                        status: "paused",
                        live: {
                            ...t.live,
                            state: "paused"
                        }
                    }
                    : t
            )
        );

        try {
            await stopTorrent(id, token);

            // Optional delayed sync
            setTimeout(() => {
                refreshSingleTorrent(id);
            }, 1500);

        } catch (err) {
            console.error(err);
            // rollback if needed
            refreshSingleTorrent(id);
        }
    };

    const resumeTorrentProcess = async (id) => {

        // Optimistic update
        setTorrents(prev =>
            prev.map(t =>
                t.id === id
                    ? {
                        ...t,
                        state: "resumed",
                        status: "downloading",
                        live: {
                            ...t.live,
                            state: "downloading"
                        }
                    }
                    : t
            )
        );

        try {
            await resumeTorrent(id, token);

            setTimeout(() => {
                refreshSingleTorrent(id);
            }, 1500);

        } catch (err) {
            console.error(err);
            refreshSingleTorrent(id);
        }
    };

    const deleteTorrentProcess = async (id) => {
        await deleteTorrent(id, token);
        await fetchTorrents();
    };

    const refreshTorrents = async () => {
        await fetchTorrents();
    };

    // -----------------------------
    // MERGE FILE OPS
    // -----------------------------

    const mergedTorrents = torrents.map((t) => {
        const hash = normalizeHash(t.info_hash || t.hash || t.infoHash);

        console.log("----");
        console.log("TORRENT:", t.name);
        console.log("HASH:", hash);
        console.log("HAS OPS?", !!fileOperations[hash]);
        console.log("OPS COUNT:", fileOperations[hash]?.length);
        console.log("AVAILABLE OPS KEYS:", Object.keys(fileOperations));

        return {
            ...t,
            fileOperations: hash ? fileOperations[hash] || [] : [],
        };
    });

    return {
        torrents: mergedTorrents,
        loaded,   // ✅ expose this
        page,
        setPage,
        pageSize,
        setPageSize,
        totalPages,
        totalItems,
        refreshTorrents,
        stopTorrentProcess,
        resumeTorrentProcess,
        deleteTorrentProcess,
        refreshFileOperations: fetchFileOperations,
    };
}