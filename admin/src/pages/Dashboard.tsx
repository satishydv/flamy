import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  Heart,
  MessageCircle,
  ShieldAlert,
  Compass,
  CheckCircle,
  ArrowUpRight,
  Clock,
  MapPin,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { adminFetch } from "../api/client";

interface DashboardStats {
  totalUsers: number;
  totalProfiles: number;
  totalMatches: number;
  totalMessages: number;
  totalReports: number;
  pendingReports: number;
  totalEncounters: number;
  verifiedPhoneUsers: number;
  genderBreakdown: {
    male: number;
    female: number;
    other: number;
  };
}

interface RecentUser {
  id: string;
  name: string;
  email: string | null;
  phoneNumber: string | null;
  image: string | null;
  phoneNumberVerified: boolean;
  createdAt: string;
  profile?: {
    age?: number | null;
    gender?: string | null;
    location?: string | null;
    avatarUrl?: string | null;
    jobTitle?: string | null;
  } | null;
}

interface RecentReport {
  id: string;
  category: string;
  details?: string | null;
  status: string;
  createdAt: string;
  reporter: { id: string; name: string; email?: string | null; image?: string | null };
  reported: { id: string; name: string; email?: string | null; image?: string | null };
}

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [recentReports, setRecentReports] = useState<RecentReport[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminFetch<{
        success: boolean;
        stats: DashboardStats;
        recentUsers: RecentUser[];
        recentReports: RecentReport[];
      }>("/api/admin/stats");

      if (res.success) {
        setStats(res.stats);
        setRecentUsers(res.recentUsers || []);
        setRecentReports(res.recentReports || []);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load dashboard metrics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading && !stats) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "400px",
          gap: "12px",
          color: "var(--text-secondary)",
        }}
      >
        <RefreshCw size={24} style={{ animation: "spin 1s linear infinite" }} />
        <span>Loading metrics from database...</span>
      </div>
    );
  }

  const verifiedPercent = stats?.totalUsers
    ? Math.round(((stats.verifiedPhoneUsers || 0) / stats.totalUsers) * 100)
    : 0;

  const totalGenders =
    (stats?.genderBreakdown?.male || 0) +
    (stats?.genderBreakdown?.female || 0) +
    (stats?.genderBreakdown?.other || 0);

  const malePercent = totalGenders ? Math.round(((stats?.genderBreakdown?.male || 0) / totalGenders) * 100) : 0;
  const femalePercent = totalGenders ? Math.round(((stats?.genderBreakdown?.female || 0) / totalGenders) * 100) : 0;
  const otherPercent = totalGenders ? 100 - malePercent - femalePercent : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Top Action / Refresh Row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ fontSize: "22px", fontWeight: 700 }}>Operational Insights</h2>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "2px" }}>
            Live platform metrics synchronized directly with PostgreSQL
          </p>
        </div>
        <button
          onClick={fetchStats}
          disabled={loading}
          className="btn btn-secondary"
          style={{ fontSize: "13px" }}
        >
          <RefreshCw size={14} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          <span>Refresh Data</span>
        </button>
      </div>

      {error && (
        <div
          style={{
            padding: "14px 18px",
            borderRadius: "var(--radius-md)",
            backgroundColor: "var(--color-danger-bg)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            color: "#f87171",
            fontSize: "13.5px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "18px",
        }}
      >
        {/* Total Users */}
        <div className="glass-card" style={{ padding: "22px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)" }}>
              Total Users
            </span>
            <div
              style={{
                padding: "8px",
                borderRadius: "var(--radius-sm)",
                backgroundColor: "rgba(255, 51, 102, 0.12)",
                color: "var(--flame-pink)",
              }}
            >
              <Users size={18} />
            </div>
          </div>
          <div style={{ fontSize: "30px", fontWeight: 800, marginTop: "12px", fontFamily: "var(--font-heading)" }}>
            {stats?.totalUsers ?? 0}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "8px", fontSize: "12px" }}>
            <span style={{ color: "var(--color-success)", fontWeight: 600 }}>
              {verifiedPercent}% verified
            </span>
            <span style={{ color: "var(--text-muted)" }}>phone numbers</span>
          </div>
        </div>

        {/* Total Matches */}
        <div className="glass-card" style={{ padding: "22px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)" }}>
              Successful Matches
            </span>
            <div
              style={{
                padding: "8px",
                borderRadius: "var(--radius-sm)",
                backgroundColor: "rgba(239, 68, 68, 0.12)",
                color: "#ef4444",
              }}
            >
              <Heart size={18} />
            </div>
          </div>
          <div style={{ fontSize: "30px", fontWeight: 800, marginTop: "12px", fontFamily: "var(--font-heading)" }}>
            {stats?.totalMatches ?? 0}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "8px", fontSize: "12px" }}>
            <span style={{ color: "var(--text-muted)" }}>Mutual likes connected</span>
          </div>
        </div>

        {/* Total Messages */}
        <div className="glass-card" style={{ padding: "22px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)" }}>
              Messages Sent
            </span>
            <div
              style={{
                padding: "8px",
                borderRadius: "var(--radius-sm)",
                backgroundColor: "rgba(59, 130, 246, 0.12)",
                color: "#3b82f6",
              }}
            >
              <MessageCircle size={18} />
            </div>
          </div>
          <div style={{ fontSize: "30px", fontWeight: 800, marginTop: "12px", fontFamily: "var(--font-heading)" }}>
            {stats?.totalMessages ?? 0}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "8px", fontSize: "12px" }}>
            <span style={{ color: "var(--text-muted)" }}>Socket.IO & chat activity</span>
          </div>
        </div>

        {/* Moderation Reports Queue */}
        <div
          className="glass-card"
          style={{
            padding: "22px 24px",
            borderColor: (stats?.pendingReports || 0) > 0 ? "rgba(239, 68, 68, 0.4)" : undefined,
            backgroundColor:
              (stats?.pendingReports || 0) > 0 ? "rgba(35, 18, 26, 0.7)" : undefined,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)" }}>
              Pending Reports
            </span>
            <div
              style={{
                padding: "8px",
                borderRadius: "var(--radius-sm)",
                backgroundColor: "rgba(239, 68, 68, 0.15)",
                color: "#f87171",
              }}
            >
              <ShieldAlert size={18} />
            </div>
          </div>
          <div
            style={{
              fontSize: "30px",
              fontWeight: 800,
              marginTop: "12px",
              fontFamily: "var(--font-heading)",
              color: (stats?.pendingReports || 0) > 0 ? "#f87171" : "var(--text-pure)",
            }}
          >
            {stats?.pendingReports ?? 0}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "8px", fontSize: "12px" }}>
            <Link
              to="/reports"
              style={{ color: "var(--flame-pink)", textDecoration: "none", fontWeight: 600 }}
            >
              Review Queue &rarr;
            </Link>
          </div>
        </div>

        {/* Street Encounters */}
        <div className="glass-card" style={{ padding: "22px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)" }}>
              Crossed Encounters
            </span>
            <div
              style={{
                padding: "8px",
                borderRadius: "var(--radius-sm)",
                backgroundColor: "rgba(168, 85, 247, 0.12)",
                color: "#c084fc",
              }}
            >
              <Compass size={18} />
            </div>
          </div>
          <div style={{ fontSize: "30px", fontWeight: 800, marginTop: "12px", fontFamily: "var(--font-heading)" }}>
            {stats?.totalEncounters ?? 0}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "8px", fontSize: "12px" }}>
            <span style={{ color: "var(--text-muted)" }}>Proximity matches logged</span>
          </div>
        </div>
      </div>

      {/* Middle Row: Visualizations & Demographic Breakdown */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gap: "20px",
        }}
      >
        {/* Engagement Trend Area */}
        <div className="glass-card" style={{ padding: "24px 28px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <div>
              <h3 style={{ fontSize: "16px", fontWeight: 700 }}>Activity Growth Trends</h3>
              <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
                Platform user onboarding and match frequency
              </p>
            </div>
            <span className="badge badge-success">
              <span className="pulse-dot" style={{ backgroundColor: "var(--color-success)" }} />
              Live Database
            </span>
          </div>

          {/* SVG Visual Graphic Chart */}
          <div style={{ height: "200px", width: "100%", position: "relative" }}>
            <svg
              viewBox="0 0 500 180"
              style={{ width: "100%", height: "100%", overflow: "visible" }}
            >
              <defs>
                <linearGradient id="gradient-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ff3366" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#ff3366" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Horizontal Grid lines */}
              <line x1="0" y1="30" x2="500" y2="30" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
              <line x1="0" y1="80" x2="500" y2="80" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
              <line x1="0" y1="130" x2="500" y2="130" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />

              {/* Smooth Trend Curve */}
              <path
                d="M 10 140 Q 90 120, 160 85 T 320 60 T 490 25 L 490 170 L 10 170 Z"
                fill="url(#gradient-area)"
              />
              <path
                d="M 10 140 Q 90 120, 160 85 T 320 60 T 490 25"
                fill="none"
                stroke="#ff3366"
                strokeWidth="3.5"
                strokeLinecap="round"
              />

              {/* Points */}
              <circle cx="10" cy="140" r="4.5" fill="#ff3366" stroke="#ffffff" strokeWidth="2" />
              <circle cx="160" cy="85" r="4.5" fill="#ff3366" stroke="#ffffff" strokeWidth="2" />
              <circle cx="320" cy="60" r="4.5" fill="#ff3366" stroke="#ffffff" strokeWidth="2" />
              <circle cx="490" cy="25" r="5.5" fill="#ff3366" stroke="#ffffff" strokeWidth="2.5" />
            </svg>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "11px",
              color: "var(--text-muted)",
              marginTop: "8px",
              paddingTop: "8px",
              borderTop: "1px solid var(--border-subtle)",
            }}
          >
            <span>Initial Launch</span>
            <span>Profile Completions</span>
            <span>Location Discovery</span>
            <span>Real-time Chatting</span>
            <span>Peak Active</span>
          </div>
        </div>

        {/* Gender Demographics Bar */}
        <div className="glass-card" style={{ padding: "24px" }}>
          <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "4px" }}>
            Gender Breakdown
          </h3>
          <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "22px" }}>
            Profile preferences in system
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Male */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "6px" }}>
                <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>Male</span>
                <span style={{ fontWeight: 700, color: "#38bdf8" }}>
                  {stats?.genderBreakdown?.male || 0} ({malePercent}%)
                </span>
              </div>
              <div style={{ height: "8px", backgroundColor: "rgba(255,255,255,0.06)", borderRadius: "4px", overflow: "hidden" }}>
                <div style={{ width: `${malePercent}%`, height: "100%", backgroundColor: "#38bdf8", borderRadius: "4px" }} />
              </div>
            </div>

            {/* Female */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "6px" }}>
                <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>Female</span>
                <span style={{ fontWeight: 700, color: "var(--flame-pink)" }}>
                  {stats?.genderBreakdown?.female || 0} ({femalePercent}%)
                </span>
              </div>
              <div style={{ height: "8px", backgroundColor: "rgba(255,255,255,0.06)", borderRadius: "4px", overflow: "hidden" }}>
                <div style={{ width: `${femalePercent}%`, height: "100%", backgroundColor: "var(--flame-pink)", borderRadius: "4px" }} />
              </div>
            </div>

            {/* Other / Non-binary */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "6px" }}>
                <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>Other / Non-binary</span>
                <span style={{ fontWeight: 700, color: "#c084fc" }}>
                  {stats?.genderBreakdown?.other || 0} ({otherPercent}%)
                </span>
              </div>
              <div style={{ height: "8px", backgroundColor: "rgba(255,255,255,0.06)", borderRadius: "4px", overflow: "hidden" }}>
                <div style={{ width: `${otherPercent}%`, height: "100%", backgroundColor: "#c084fc", borderRadius: "4px" }} />
              </div>
            </div>

            <div
              style={{
                marginTop: "10px",
                padding: "12px",
                borderRadius: "var(--radius-sm)",
                backgroundColor: "rgba(255, 255, 255, 0.03)",
                fontSize: "12px",
                color: "var(--text-secondary)",
                lineHeight: 1.4,
              }}
            >
              Balanced ratio improves matching velocity and daily swipe retention.
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Grid: Recent Signups & Urgent Reports */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr",
          gap: "20px",
        }}
      >
        {/* Recent Registrations Table */}
        <div className="glass-card" style={{ padding: "24px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
            }}
          >
            <div>
              <h3 style={{ fontSize: "16px", fontWeight: 700 }}>Recent Signups</h3>
              <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                Newly registered user accounts
              </p>
            </div>
            <Link to="/users" className="btn btn-ghost" style={{ fontSize: "12px", padding: "6px 12px" }}>
              <span>View All</span>
              <ArrowUpRight size={14} />
            </Link>
          </div>

          {recentUsers.length === 0 ? (
            <div style={{ padding: "30px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
              No users registered yet.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {recentUsers.map((user) => (
                <div
                  key={user.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    borderRadius: "var(--radius-md)",
                    backgroundColor: "rgba(255, 255, 255, 0.02)",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "50%",
                        backgroundColor: "var(--bg-surface-elevated)",
                        backgroundImage: user.profile?.avatarUrl || user.image ? `url(${user.profile?.avatarUrl || user.image})` : undefined,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "14px",
                        fontWeight: 700,
                        color: "var(--flame-pink)",
                        flexShrink: 0,
                      }}
                    >
                      {!user.profile?.avatarUrl && !user.image ? user.name.charAt(0).toUpperCase() : null}
                    </div>
                    <div>
                      <div style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--text-pure)", display: "flex", alignItems: "center", gap: "6px" }}>
                        <span>{user.name}</span>
                        {user.phoneNumberVerified && (
                          <CheckCircle size={13} color="var(--color-success)" />
                        )}
                      </div>
                      <div style={{ fontSize: "11.5px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "8px" }}>
                        {user.profile?.location && (
                          <span style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                            <MapPin size={11} /> {user.profile.location}
                          </span>
                        )}
                        <span>{user.phoneNumber || user.email || "Mobile User"}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: "11.5px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
                    <Clock size={12} />
                    <span>{new Date(user.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Urgent Reports Preview */}
        <div className="glass-card" style={{ padding: "24px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
            }}
          >
            <div>
              <h3 style={{ fontSize: "16px", fontWeight: 700 }}>Moderation Alerts</h3>
              <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                Latest user incident reports
              </p>
            </div>
            <Link to="/reports" className="btn btn-ghost" style={{ fontSize: "12px", padding: "6px 12px" }}>
              <span>Moderation</span>
              <ArrowUpRight size={14} />
            </Link>
          </div>

          {recentReports.length === 0 ? (
            <div style={{ padding: "30px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
              All reports are currently resolved!
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {recentReports.map((report) => (
                <div
                  key={report.id}
                  style={{
                    padding: "12px",
                    borderRadius: "var(--radius-md)",
                    backgroundColor: "rgba(255, 255, 255, 0.02)",
                    border: "1px solid var(--border-subtle)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="badge badge-danger">{report.category}</span>
                    <span
                      style={{
                        fontSize: "11px",
                        color:
                          report.status === "pending"
                            ? "var(--color-warning)"
                            : "var(--color-success)",
                        fontWeight: 600,
                        textTransform: "capitalize",
                      }}
                    >
                      {report.status}
                    </span>
                  </div>
                  <div style={{ fontSize: "12.5px", color: "var(--text-primary)" }}>
                    <strong style={{ color: "var(--text-pure)" }}>{report.reported?.name || "Reported"}</strong> flagged by{" "}
                    <span style={{ color: "var(--text-muted)" }}>{report.reporter?.name || "Reporter"}</span>
                  </div>
                  {report.details && (
                    <div
                      style={{
                        fontSize: "11.5px",
                        color: "var(--text-muted)",
                        fontStyle: "italic",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      "{report.details}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
