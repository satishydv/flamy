import React, { useEffect, useState } from "react";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  UserX,
  Clock,
  RefreshCw,
} from "lucide-react";
import { adminFetch } from "../api/client";

interface ReportItem {
  id: string;
  category: string;
  details?: string | null;
  status: "pending" | "reviewed" | "resolved" | "dismissed";
  createdAt: string;
  reporter: {
    id: string;
    name: string;
    email: string | null;
    image: string | null;
    phoneNumber: string | null;
  };
  reported: {
    id: string;
    name: string;
    email: string | null;
    image: string | null;
    phoneNumber: string | null;
    profile?: {
      avatarUrl?: string | null;
      age?: number | null;
      gender?: string | null;
    } | null;
  };
}

export const ReportsPage: React.FC = () => {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [actionLoading, setActionLoading] = useState(false);

  // Selected report for ban modal
  const [banReport, setBanReport] = useState<ReportItem | null>(null);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (categoryFilter !== "all") params.append("category", categoryFilter);

      const res = await adminFetch<{ success: boolean; reports: ReportItem[] }>(
        `/api/admin/reports?${params.toString()}`
      );
      if (res.success) {
        setReports(res.reports);
      }
    } catch (err) {
      console.error("Failed to load reports:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [statusFilter, categoryFilter]);

  const updateStatus = async (reportId: string, status: string, banUser = false) => {
    setActionLoading(true);
    try {
      const res = await adminFetch(`/api/admin/reports/${reportId}`, {
        method: "PATCH",
        body: JSON.stringify({ status, banUser }),
      });
      if (res.success) {
        setReports(
          reports.map((r) =>
            r.id === reportId ? { ...r, status: status as ReportItem["status"] } : r
          )
        );
        if (banUser) {
          setBanReport(null);
        }
      }
    } catch (err: any) {
      alert(err.message || "Failed to update report status");
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <span className="badge badge-warning">Pending Review</span>;
      case "resolved":
        return <span className="badge badge-success">Resolved</span>;
      case "dismissed":
        return <span className="badge badge-muted">Dismissed</span>;
      case "reviewed":
        return <span className="badge badge-info">Under Review</span>;
      default:
        return <span className="badge badge-muted">{status}</span>;
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Top Filter Bar */}
      <div className="glass-card" style={{ padding: "18px 24px" }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "14px",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Status Tabs */}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {[
              { id: "all", label: "All Reports" },
              { id: "pending", label: "Pending Review" },
              { id: "resolved", label: "Resolved" },
              { id: "dismissed", label: "Dismissed" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={statusFilter === tab.id ? "btn btn-primary" : "btn btn-secondary"}
                style={{ padding: "8px 14px", fontSize: "13px" }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Category Dropdown */}
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <select
              className="form-input"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{ width: "auto", minWidth: "170px" }}
            >
              <option value="all">All Incident Categories</option>
              <option value="Harassment">Harassment</option>
              <option value="Fake Profile">Fake Profile</option>
              <option value="Inappropriate Photos">Inappropriate Photos</option>
              <option value="Spam">Spam / Bots</option>
              <option value="Other">Other</option>
            </select>

            <button onClick={fetchReports} className="btn btn-secondary">
              <RefreshCw size={14} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
            </button>
          </div>
        </div>
      </div>

      {/* Reports List */}
      {loading ? (
        <div style={{ padding: "60px", textAlign: "center", color: "var(--text-muted)" }}>
          <RefreshCw size={24} style={{ animation: "spin 1s linear infinite", display: "inline-block", marginBottom: "12px" }} />
          <p>Loading moderation queue...</p>
        </div>
      ) : reports.length === 0 ? (
        <div
          className="glass-card"
          style={{ padding: "60px 24px", textAlign: "center", color: "var(--text-muted)" }}
        >
          <CheckCircle size={40} color="var(--color-success)" style={{ marginBottom: "12px" }} />
          <h3 style={{ fontSize: "18px", color: "var(--text-pure)", marginBottom: "6px" }}>
            Moderation Queue is Clean
          </h3>
          <p style={{ fontSize: "13.5px" }}>No reports match the selected criteria.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {reports.map((report) => (
            <div
              key={report.id}
              className="glass-card"
              style={{
                padding: "20px 24px",
                borderLeft:
                  report.status === "pending"
                    ? "4px solid var(--flame-pink)"
                    : report.status === "resolved"
                    ? "4px solid var(--color-success)"
                    : "4px solid var(--border-subtle)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: "14px",
                  marginBottom: "16px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span className="badge badge-danger">{report.category}</span>
                  {getStatusBadge(report.status)}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--text-muted)" }}>
                  <Clock size={13} />
                  <span>Reported on {new Date(report.createdAt).toLocaleString()}</span>
                </div>
              </div>

              {/* Side-by-side Parties */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                  gap: "16px",
                  marginBottom: "16px",
                  padding: "14px",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "rgba(255, 255, 255, 0.02)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                {/* Reported User (Subject of complaint) */}
                <div>
                  <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#f87171", marginBottom: "8px" }}>
                    Reported User (Accused)
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div
                      style={{
                        width: "42px",
                        height: "42px",
                        borderRadius: "50%",
                        backgroundColor: "var(--bg-surface-elevated)",
                        backgroundImage: report.reported?.profile?.avatarUrl || report.reported?.image
                          ? `url(${report.reported.profile?.avatarUrl || report.reported.image})`
                          : undefined,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        color: "var(--flame-pink)",
                        flexShrink: 0,
                        border: "1px solid rgba(239, 68, 68, 0.3)",
                      }}
                    >
                      {!report.reported?.profile?.avatarUrl && !report.reported?.image
                        ? report.reported?.name?.charAt(0).toUpperCase() || "U"
                        : null}
                    </div>
                    <div>
                      <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-pure)" }}>
                        {report.reported?.name || "Deleted User"}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                        {report.reported?.phoneNumber || report.reported?.email || "No direct contact"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Reporting User */}
                <div>
                  <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "8px" }}>
                    Filed By (Reporter)
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div
                      style={{
                        width: "42px",
                        height: "42px",
                        borderRadius: "50%",
                        backgroundColor: "var(--bg-surface-elevated)",
                        backgroundImage: report.reporter?.image ? `url(${report.reporter.image})` : undefined,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        color: "var(--text-secondary)",
                        flexShrink: 0,
                        border: "1px solid var(--border-subtle)",
                      }}
                    >
                      {!report.reporter?.image ? report.reporter?.name?.charAt(0).toUpperCase() || "R" : null}
                    </div>
                    <div>
                      <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>
                        {report.reporter?.name || "Anonymous User"}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                        {report.reporter?.phoneNumber || report.reporter?.email || "Mobile User"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Complaint details */}
              {report.details && (
                <div
                  style={{
                    fontSize: "13.5px",
                    color: "var(--text-primary)",
                    padding: "12px 14px",
                    backgroundColor: "rgba(255, 51, 102, 0.04)",
                    borderLeft: "3px solid var(--flame-pink)",
                    borderRadius: "4px",
                    marginBottom: "16px",
                  }}
                >
                  <strong style={{ color: "var(--text-pure)" }}>Explanation: </strong>
                  {report.details}
                </div>
              )}

              {/* Action Buttons */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                  alignItems: "center",
                  borderTop: "1px solid var(--border-subtle)",
                  paddingTop: "14px",
                }}
              >
                {report.status !== "resolved" && (
                  <button
                    onClick={() => updateStatus(report.id, "resolved")}
                    disabled={actionLoading}
                    className="btn btn-secondary"
                    style={{ fontSize: "12.5px", padding: "7px 14px" }}
                  >
                    <CheckCircle size={14} color="var(--color-success)" />
                    <span>Mark Resolved</span>
                  </button>
                )}

                {report.status !== "dismissed" && (
                  <button
                    onClick={() => updateStatus(report.id, "dismissed")}
                    disabled={actionLoading}
                    className="btn btn-ghost"
                    style={{ fontSize: "12.5px", padding: "7px 14px" }}
                  >
                    <XCircle size={14} />
                    <span>Dismiss</span>
                  </button>
                )}

                {report.reported && (
                  <button
                    onClick={() => setBanReport(report)}
                    disabled={actionLoading}
                    className="btn btn-danger"
                    style={{ fontSize: "12.5px", padding: "7px 14px" }}
                  >
                    <UserX size={14} />
                    <span>Ban Accused User</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Ban & Delete Modal */}
      {banReport && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 110,
            padding: "20px",
          }}
        >
          <div
            className="glass-card animate-fade-in"
            style={{
              width: "100%",
              maxWidth: "440px",
              padding: "28px",
              border: "1px solid rgba(239, 68, 68, 0.3)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <div
                style={{
                  padding: "10px",
                  borderRadius: "50%",
                  backgroundColor: "var(--color-danger-bg)",
                  color: "#ef4444",
                }}
              >
                <AlertTriangle size={24} />
              </div>
              <h3 style={{ fontSize: "18px", fontWeight: 700 }}>Ban & Delete Account</h3>
            </div>
            <p style={{ fontSize: "13.5px", color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: "22px" }}>
              Are you sure you want to permanently ban and delete <strong>{banReport.reported?.name}</strong> due to this {banReport.category} report?
              This will mark the report as resolved and wipe the user's data from PostgreSQL.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                onClick={() => setBanReport(null)}
                disabled={actionLoading}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => updateStatus(banReport.id, "resolved", true)}
                disabled={actionLoading}
                className="btn btn-danger"
              >
                {actionLoading ? "Processing..." : "Ban & Resolve"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
