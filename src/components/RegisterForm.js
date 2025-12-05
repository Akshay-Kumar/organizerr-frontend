// src/components/RegisterForm.js
import React, { useState } from "react";
import { login, register } from "../api/api";
import "./Auth.css";

export default function RegisterForm({ onRegistered }) {
    const [form, setForm] = useState({ username: "", password: "" });
    const [error, setError] = useState("");

    const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        try {
            await register(form);

            // Auto-login after registration
            const res = await login(form);

            const token = res.data.token || res.data.access_token;
            if (!token) throw new Error("No token received from server");

            onRegistered(token);
            alert("Registration successful! Logging you in...");
        } catch (err) {
            setError(err.response?.data?.detail || "Registration failed");
        }
    };

    return (
        <form className="auth-form" onSubmit={handleSubmit}>
            <input
                name="username"
                placeholder="Username"
                value={form.username}
                onChange={handleChange}
                required
            />

            <input
                name="password"
                type="password"
                placeholder="Password"
                value={form.password}
                onChange={handleChange}
                required
            />

            <button type="submit">Register</button>

            {error && <div className="auth-error">{error}</div>}
        </form>
    );
}
