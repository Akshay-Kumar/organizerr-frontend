// src/components/ProgressBar.js
import React from "react";
import "./ProgressBar.css";

export default function ProgressBar({ progress = 0 }) {
    const pct = Math.max(0, Math.min(100, Math.round(progress)));
    return (
        <div className="pb-wrapper" aria-hidden>
            <div className="pb-track">
                <div className="pb-fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="pb-label">{pct}%</div>
        </div>
    );
}
