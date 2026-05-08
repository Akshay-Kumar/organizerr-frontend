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

export const getTorrents = (
    token,
    page = 1,
    pageSize = 25
) => {
    return api.get(`/torrents?page=${page}&page_size=${pageSize}`, {
        headers: {
            "Authorization": `Bearer ${token}`, // ✅ correct
        },
    });
};

export const getTorrentById = async (id, token) => {
    return api.get(`/torrents/${id}`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
};

export const getMe = (token) => {
    return api.get(`/me`, {
        headers: {
            "Authorization": `Bearer ${token}`, // ✅ correct
        },
    });
};

export const updateTorrent = async (id, data, token) => {
    return api.patch(`/api/torrents/${id}`, data, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
};

export const stopTorrent = async (id, token) => {
    return api.post(`/api/torrents/${id}/stop`, {}, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
};

export const resumeTorrent = async (id, token) => {
    return api.post(`/api/torrents/${id}/resume`, {}, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
};

export const deleteTorrent = async (id, token) => {
    return api.delete(`/api/torrents/${id}`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
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
    return api.get(`/api/file-operations`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
};

export const getFileOperationsByHash = async (token, info_hash) => {
    return api.get(`/api/file-operations/${info_hash}`);
};

export const postFileOperation = async (data) => {
    return api.post(`/api/file-operations`, data);
};
