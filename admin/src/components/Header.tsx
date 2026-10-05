import React, { useState, useEffect } from "react";
import { Database, RefreshCw } from "lucide-react";
import { API_BASE_URL } from "../api/client";

interface HeaderProps {
  title?: string;
  subtitle?: string;
}

export const Header: React.FC<HeaderProps> = ({
  title = "Dashboard",
  subtitle = "Real-time metrics and operations",
}) => {
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [checking, setChecking] = useState<boolean>(false);

  const checkHealth = async () => {
    setChecking(true);
    try {
      const res = await fetch(`${API_BASE_URL}/health`, { method: "GET" });
      if (res.ok) {
        setBackendOnline(true);
      } else {
        setBackendOnline(false);
      }
    } catch {
      setBackendOnline(false);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, []);

  return (
    <header
      style={{
        height: "72px",
        padding: "0 36px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "1px solid var(--border-subtle)",
        backgroundColor: "rgba(13, 15, 23, 0.8)",
        backdropFilter: "blur(12px)",
        position: "sticky",
        top: 0,
        zIndex: 40,
      }}
    >
      <div>
        <h1
          style={{
            fontSize: "20px",
            fontWeight: 700,
            color: "var(--text-pure)",
            lineHeight: 1.2,
          }}
        >
          {title}
        </h1>
        <p style={{ fontSize: "12.5px", color: "var(--text-muted)", marginTop: "2px" }}>
          {subtitle}
        </p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        {/* API / Backend Status Pill */}
        <div
          onClick={checkHealth}
          title={`Click to recheck health: ${API_BASE_URL}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "6px 12px",
            borderRadius: "var(--radius-full)",
            backgroundColor: "var(--bg-surface-elevated)",
            border: "1px solid var(--border-subtle)",
            fontSize: "12px",
            fontWeight: 600,
            cursor: "pointer",
            transition: "all var(--transition-fast)",
          }}
        >
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor:
                backendOnline === true
                  ? "var(--color-success)"
                  : backendOnline === false
                  ? "var(--color-danger)"
                  : "var(--color-warning)",
              boxShadow:
                backendOnline === true
                  ? "0 0 10px rgba(16, 185, 129, 0.6)"
                  : "0 0 10px rgba(239, 68, 68, 0.6)",
            }}
          />
          <span style={{ color: "var(--text-secondary)" }}>
            {checking
              ? "Checking..."
              : backendOnline === true
              ? "Backend Active"
              : backendOnline === false
              ? "Backend Disconnected"
              : "Connecting..."}
          </span>
          <RefreshCw
            size={12}
            color="var(--text-muted)"
            style={{
              animation: checking ? "spin 1s linear infinite" : "none",
            }}
          />
        </div>

        {/* Database Node Info */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "6px 12px",
            borderRadius: "var(--radius-full)",
            backgroundColor: "rgba(255, 255, 255, 0.04)",
            border: "1px solid var(--border-subtle)",
            fontSize: "12px",
            color: "var(--text-muted)",
          }}
        >
          <Database size={13} color="var(--flame-pink)" />
          <span>PostgreSQL :5001</span>
        </div>
      </div>
    </header>
  );
};
