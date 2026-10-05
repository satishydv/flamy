import React, { useState } from "react";
import {
  Server,
  Database,
  CheckCircle,
  XCircle,
  RefreshCw,
  Copy,
  FileCode,
} from "lucide-react";
import { API_BASE_URL } from "../api/client";

export const SettingsPage: React.FC = () => {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    status: number;
    latency: number;
    data?: any;
  } | null>(null);

  const [copied, setCopied] = useState(false);

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    const start = performance.now();
    try {
      const res = await fetch(`${API_BASE_URL}/health`);
      const latency = Math.round(performance.now() - start);
      const data = await res.json().catch(() => ({}));
      setTestResult({
        ok: res.ok,
        status: res.status,
        latency,
        data,
      });
    } catch (err: any) {
      const latency = Math.round(performance.now() - start);
      setTestResult({
        ok: false,
        status: 0,
        latency,
        data: { error: err.message },
      });
    } finally {
      setTesting(false);
    }
  };

  const nginxConfigSnippet = `server {
    listen 80;
    server_name admin.yourdomain.com;

    root /var/www/admin/dist;
    index index.html;

    # Single Page App routing fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API calls directly to Express backend
    location /api/ {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}`;

  const copySnippet = () => {
    navigator.clipboard.writeText(nginxConfigSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Backend Gateway Card */}
      <div className="glass-card" style={{ padding: "26px" }}>
        <h3 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "6px" }}>
          Backend Connectivity & API Gateway
        </h3>
        <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "20px" }}>
          Active API target for all admin operations and dashboard statistics.
        </p>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "14px",
            padding: "16px 20px",
            borderRadius: "var(--radius-md)",
            backgroundColor: "rgba(255, 255, 255, 0.02)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
              Connected Backend URL
            </div>
            <div style={{ fontSize: "16px", fontWeight: 600, color: "var(--flame-pink)", marginTop: "4px", fontFamily: "var(--font-mono)" }}>
              {API_BASE_URL}
            </div>
          </div>

          <button
            onClick={testConnection}
            disabled={testing}
            className="btn btn-secondary"
          >
            <RefreshCw size={14} style={{ animation: testing ? "spin 1s linear infinite" : "none" }} />
            <span>{testing ? "Testing..." : "Test Connection"}</span>
          </button>
        </div>

        {testResult && (
          <div
            style={{
              marginTop: "16px",
              padding: "14px 18px",
              borderRadius: "var(--radius-md)",
              backgroundColor: testResult.ok ? "var(--color-success-bg)" : "var(--color-danger-bg)",
              border: `1px solid ${testResult.ok ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
              color: testResult.ok ? "#34d399" : "#f87171",
              fontSize: "13px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              {testResult.ok ? <CheckCircle size={18} /> : <XCircle size={18} />}
              <span>
                {testResult.ok
                  ? `Backend is healthy & responsive (HTTP ${testResult.status})`
                  : `Connection failed: ${testResult.data?.error || `HTTP ${testResult.status}`}`}
              </span>
            </div>
            <span style={{ fontWeight: 700, fontFamily: "var(--font-mono)", fontSize: "12px" }}>
              {testResult.latency} ms
            </span>
          </div>
        )}
      </div>

      {/* Database & Architecture Summary */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "20px",
        }}
      >
        <div className="glass-card" style={{ padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
            <Database size={20} color="var(--flame-pink)" />
            <h4 style={{ fontSize: "16px", fontWeight: 700 }}>Database Isolation</h4>
          </div>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: "14px" }}>
            Admin accounts are housed inside <code style={{ color: "var(--flame-pink)" }}>admin_user</code> and authenticated through <code style={{ color: "var(--flame-pink)" }}>admin_session</code>.
          </p>
          <ul style={{ fontSize: "12.5px", color: "var(--text-muted)", lineHeight: 1.6, paddingLeft: "18px" }}>
            <li>Zero mixing with end-user dating profiles</li>
            <li>Bcrypt 10-round salted password hashing</li>
            <li>Independent session token lifecycle</li>
            <li>No BetterAuth CSRF dependency for admin dashboard</li>
          </ul>
        </div>

        <div className="glass-card" style={{ padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
            <Server size={20} color="var(--flame-orange)" />
            <h4 style={{ fontSize: "16px", fontWeight: 700 }}>Production VPS Deployment</h4>
          </div>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: "14px" }}>
            When you deploy to your 24GB VPS, build the static bundle:
          </p>
          <div
            style={{
              padding: "10px 14px",
              backgroundColor: "rgba(0, 0, 0, 0.4)",
              borderRadius: "var(--radius-sm)",
              fontFamily: "var(--font-mono)",
              fontSize: "12px",
              color: "#38bdf8",
              marginBottom: "12px",
            }}
          >
            npm run build
          </div>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.4 }}>
            Drop the resulting <code>dist/</code> folder into <code>/var/www/admin/dist</code>. Nginx serves it with 0 Node overhead.
          </p>
        </div>
      </div>

      {/* Nginx Sample Config */}
      <div className="glass-card" style={{ padding: "26px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <FileCode size={20} color="var(--color-info)" />
            <h4 style={{ fontSize: "16px", fontWeight: 700 }}>Recommended Nginx Configuration</h4>
          </div>
          <button onClick={copySnippet} className="btn btn-secondary" style={{ fontSize: "12px", padding: "6px 12px" }}>
            <Copy size={13} />
            <span>{copied ? "Copied!" : "Copy Config"}</span>
          </button>
        </div>
        <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "16px" }}>
          Copy this block into your Nginx site configuration (e.g. <code>/etc/nginx/sites-available/admin</code>) on your VPS:
        </p>
        <pre
          style={{
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            padding: "18px",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-subtle)",
            fontFamily: "var(--font-mono)",
            fontSize: "12.5px",
            color: "#e2e8f0",
            overflowX: "auto",
            lineHeight: 1.5,
          }}
        >
          {nginxConfigSnippet}
        </pre>
      </div>
    </div>
  );
};
