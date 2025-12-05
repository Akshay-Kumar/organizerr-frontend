// src/api/api.js
import axios from "axios";

const API_BASE = process.env.REACT_APP_API_URL; // Backend URL

// --- Torrent APIs ---

// Add torrent (magnet URL or .torrent file)
export const addTorrent = async (formData) => {
    return axios.post(`${API_BASE}/torrents`, formData, {
        headers: {
            "Content-Type": "multipart/form-data",
        },
    });
};

// Get all torrents
export const getTorrents = async () => {
    return axios.get(`${API_BASE}/torrents`);
};

// Update torrent by ID
export const updateTorrent = async (id, data, token) => {
    return axios.patch(`${API_BASE}/api/torrents/${id}?token=${token}`, data);
};

// Stop torrent by DB ID
export const stopTorrent = async (id, token) => {
    return axios.post(`${API_BASE}/api/torrents/${id}/stop?token=${token}`);
};

// Resume torrent by DB ID
export const resumeTorrent = async (id, token) => {
    return axios.post(`${API_BASE}/api/torrents/${id}/resume?token=${token}`);
};

// Delete torrent by DB ID
export const deleteTorrent = async (id, token) => {
    return axios.delete(`${API_BASE}/api/torrents/${id}?token=${token}`);
};

// --- Media search ---
export const searchMedia = async (query, mediaType = "movie", year = null, season = null, episode = null) => {
    const params = { query, media_type: mediaType };
    if (year) params.year = year;
    if ((mediaType === "episode" || mediaType === "tv")) {
        if (season) params.season = season;
        if (episode) params.episode = episode;
    }
    return axios.get(`${API_BASE}/search_media`, { params });
};

// --- Auth APIs ---
export const register = async (data) => {
    return axios.post(`${API_BASE}/auth/register`, data);
};

export const login = async (form) => {
    // form should be { username, password }
    return axios.post(`${API_BASE}/auth/login`, new URLSearchParams(form));
};
