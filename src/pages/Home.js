// src/pages/Home.js
import React, { useState } from "react";
import TorrentForm from "../components/TorrentForm";
import TorrentList from "../components/TorrentList";
import LoginForm from "../components/LoginForm";
import RegisterForm from "../components/RegisterForm";
import TorrentsDashboard from "../components/TorrentsDashboard";
import ErrorBoundary from "../components/ErrorBoundary";
import "./Home.css";

export default function Home() {
    const [token, setToken] = useState(localStorage.getItem("token"));
    const [refresh, setRefresh] = useState(false);
    const [showRegister, setShowRegister] = useState(false);

    // NEW: view toggle
    const [view, setView] = useState("home"); // "home" | "dashboard"

    const handleLogin = (newToken) => {
        localStorage.setItem("token", newToken);
        setToken(newToken);
    };

    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");

        setToken(null);
    };

    const handleAdded = () => setRefresh((prev) => !prev);

    // ------------------- AUTH -------------------
    if (!token) {
        return (
            <div className="auth-container">
                <h1>Torrent Organizer</h1>

                {showRegister ? (
                    <>
                        <RegisterForm onRegistered={handleLogin} />
                        <p>
                            Already have an account?{" "}
                            <button onClick={() => setShowRegister(false)}>Login</button>
                        </p>
                    </>
                ) : (
                    <>
                        <LoginForm onLoggedIn={handleLogin} />
                        <p>
                            Don't have an account?{" "}
                            <button onClick={() => setShowRegister(true)}>Register</button>
                        </p>
                    </>
                )}
            </div>
        );
    }

    // ------------------- LOGGED IN -------------------
    return (
        <div className="home-container">
            <div className="home-header">
                <h1>Torrent Organizer</h1>

                <div className="home-header-actions">
                    <button
                        className={`nav-btn ${view === "home" ? "active" : ""}`}
                        onClick={() => setView("home")}
                    >
                        Home
                    </button>

                    <button
                        className={`nav-btn ${view === "dashboard" ? "active" : ""}`}
                        onClick={() => setView("dashboard")}
                    >
                        Dashboard
                    </button>

                    <button className="logout-btn" onClick={handleLogout}>
                        Logout
                    </button>
                </div>
            </div>

            {view === "home" ? (
                <>
                    <TorrentForm onAdded={handleAdded} token={token} />
                    <TorrentList key={refresh} token={token} />
                </>
            ) : (
                <ErrorBoundary>
                    <TorrentsDashboard />
                </ErrorBoundary>
            )}
        </div>
    );
}
