// src/api/api.js
import axios from "axios";

const API_BASE = process.env.REACT_APP_API_URL; // e.g. https://organizerr-backend.beast-x.xyz

if (!API_BASE) {
    // eslint-disable-next-line no-console
    console.error("REACT_APP_API_URL is not set. API calls will fail.");
}

// Single axios client with timeout (prevents hanging requests)
const api = axios.create({
    baseURL: API_BASE,
    timeout: 15000, // 15 seconds
});

// Helper: safely attach token as query param (backend expects ?token=)
function withToken(url, token) {
    if (!token) return url;
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}token=${encodeURIComponent(token)}`;
}

// --- Torrent APIs ---

export const addTorrent = async (token, formData) => {
    return api.post(`/torrents`, formData, {
        headers: {
            "Content-Type": "multipart/form-data",
            "Authorization": `Bearer ${token}`,
        },
    });
};

export const addTorrentsBatch = async (token, formData) => {
    return api.post(`/torrents/batch`, formData, {
        headers: {
            "Content-Type": "multipart/form-data",
            "Authorization": `Bearer ${token}`,
        },
    });
};

export const getTorrents = async (token) => {
    return api.get(`/torrents`, {
        headers: {
            "Authorization": `Bearer ${token}`, // ✅ correct
        },
    });
};

export const updateTorrent = async (id, data, token) => {
    return api.patch(withToken(`/api/torrents/${id}`, token), data);
};

export const stopTorrent = async (id, token) => {
    return api.post(withToken(`/api/torrents/${id}/stop`, token));
};

export const resumeTorrent = async (id, token) => {
    return api.post(withToken(`/api/torrents/${id}/resume`, token));
};

export const deleteTorrent = async (id, token) => {
    return api.delete(withToken(`/api/torrents/${id}`, token));
};

// --- Media search ---
export const searchMedia = async (
    query,
    mediaType = "movie",
    year = null,
    season = null,
    episode = null
) => {
    const params = { query, media_type: mediaType };
    if (year) params.year = year;

    if (mediaType === "episode" || mediaType === "tv") {
        if (season) params.season = season;
        if (episode) params.episode = episode;
    }

    return api.get(`/search_media`, { params });
};

// --- Auth APIs ---
export const register = async (data) => {
    return api.post(`/auth/register`, data);
};

export const login = async (form) => {
    // form: { username, password }
    return api.post(`/auth/login`, new URLSearchParams(form));
};

export const getFileOperations = async (token) => {
    return api.get(`/api/file-operations`);
};

export const getFileOperation = async (token, info_hash) => {
    return api.get(`/api/file-operations/${info_hash}`);
};

export const postFileOperation = async (data) => {
    return api.post(`/api/file-operations`, data);
};