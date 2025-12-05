// src/pages/Home.js
import React, { useState } from "react";
import TorrentForm from "../components/TorrentForm";
import TorrentList from "../components/TorrentList";
import LoginForm from "../components/LoginForm";
import RegisterForm from "../components/RegisterForm";
import "./Home.css";

export default function Home() {
    const [token, setToken] = useState(localStorage.getItem("token"));
    const [refresh, setRefresh] = useState(false);
    const [showRegister, setShowRegister] = useState(false);

    // Update token in state and localStorage
    const handleLogin = (newToken) => {
        localStorage.setItem("token", newToken);
        setToken(newToken);
    };

    const handleLogout = () => {
        localStorage.removeItem("token");
        setToken(null);
    };

    const handleAdded = () => setRefresh(prev => !prev);

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
        return (
        <div className="home-container">
            <div className="home-header">
                <h1>Torrent Organizer</h1>
                <button className="logout-btn" onClick={handleLogout}>Logout</button>
            </div>
            <TorrentForm onAdded={handleAdded} token={token} />
            <TorrentList key={refresh} token={token} />
        </div>
    );

}
