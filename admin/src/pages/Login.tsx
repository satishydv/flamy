import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Flame, Lock, Mail, Eye, EyeOff, ShieldCheck, ArrowRight, AlertCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if redirected due to expired session
  const searchParams = new URLSearchParams(location.search);
  const isExpired = searchParams.get("expired") === "true";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await login(email, password);
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      setError(err.message || "Invalid admin credentials or server offline.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = () => {
    setEmail("admin@flamy.com");
    setPassword("Admin@123456");
    setError(null);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
        backgroundColor: "var(--bg-deep)",
        padding: "24px",
      }}
    >
      {/* Radiant Background Aura */}
      <div
        style={{
          position: "absolute",
          width: "550px",
          height: "550px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255, 51, 102, 0.16) 0%, rgba(255, 107, 61, 0.08) 45%, transparent 70%)",
          filter: "blur(60px)",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
        }}
      />

      <div
        className="glass-card animate-fade-in"
        style={{
          width: "100%",
          maxWidth: "440px",
          padding: "40px",
          position: "relative",
          zIndex: 10,
          border: "1px solid rgba(255, 255, 255, 0.12)",
          boxShadow: "0 24px 60px rgba(0, 0, 0, 0.7), 0 0 35px rgba(255, 51, 102, 0.1)",
        }}
      >
        {/* Flame Logo Badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "24px",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "18px",
              background: "var(--flame-gradient)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "var(--flame-glow)",
            }}
          >
            <Flame size={32} color="#ffffff" />
          </div>
        </div>

        {/* Title */}
        <div style={{ textAlign: "center", marginBottom: "30px" }}>
          <h2
            style={{
              fontSize: "24px",
              fontWeight: 800,
              color: "var(--text-pure)",
              marginBottom: "8px",
            }}
          >
            Flamy Admin Portal
          </h2>
          <p style={{ fontSize: "13.5px", color: "var(--text-secondary)" }}>
            Sign in with your administrative credentials
          </p>
        </div>

        {/* Expired Session Notice */}
        {isExpired && (
          <div
            style={{
              marginBottom: "20px",
              padding: "12px 14px",
              borderRadius: "var(--radius-md)",
              backgroundColor: "var(--color-warning-bg)",
              border: "1px solid rgba(245, 158, 11, 0.3)",
              color: "#fbbf24",
              fontSize: "13px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <AlertCircle size={16} />
            <span>Your session has expired. Please log in again.</span>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div
            style={{
              marginBottom: "20px",
              padding: "12px 14px",
              borderRadius: "var(--radius-md)",
              backgroundColor: "var(--color-danger-bg)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "#f87171",
              fontSize: "13px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit}>
          {/* Email Field */}
          <div style={{ marginBottom: "18px" }}>
            <label
              style={{
                display: "block",
                fontSize: "12.5px",
                fontWeight: 600,
                color: "var(--text-secondary)",
                marginBottom: "8px",
              }}
            >
              Admin Email
            </label>
            <div style={{ position: "relative" }}>
              <div
                style={{
                  position: "absolute",
                  left: "14px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-muted)",
                  display: "flex",
                }}
              >
                <Mail size={16} />
              </div>
              <input
                type="email"
                className="form-input"
                placeholder="admin@flamy.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ paddingLeft: "42px" }}
                required
              />
            </div>
          </div>

          {/* Password Field */}
          <div style={{ marginBottom: "24px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "8px",
              }}
            >
              <label
                style={{
                  fontSize: "12.5px",
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                }}
              >
                Password
              </label>
            </div>
            <div style={{ position: "relative" }}>
              <div
                style={{
                  position: "absolute",
                  left: "14px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-muted)",
                  display: "flex",
                }}
              >
                <Lock size={16} />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                className="form-input"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingLeft: "42px", paddingRight: "42px" }}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  display: "flex",
                  padding: "4px",
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: "100%", padding: "13px", fontSize: "15px" }}
          >
            {loading ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <span>Access Console</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Quick Fill Demo Helper */}
        <div
          style={{
            marginTop: "24px",
            paddingTop: "20px",
            borderTop: "1px solid var(--border-subtle)",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: "12px",
              color: "var(--text-muted)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <ShieldCheck size={14} color="var(--color-success)" />
              <span>Isolated Admin Table Model</span>
            </div>
            <button
              type="button"
              onClick={handleQuickFill}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--flame-pink)",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                padding: "2px 4px",
                textDecoration: "underline",
              }}
            >
              Fill Default Admin
            </button>
          </div>
          <div
            style={{
              fontSize: "11px",
              color: "var(--text-muted)",
              lineHeight: 1.4,
              backgroundColor: "rgba(255, 255, 255, 0.02)",
              padding: "8px 10px",
              borderRadius: "var(--radius-sm)",
              fontFamily: "var(--font-mono)",
            }}
          >
            admin@flamy.com / Admin@123456
          </div>
        </div>
      </div>
    </div>
  );
};
