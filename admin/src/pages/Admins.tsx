import React, { useEffect, useState } from "react";
import {
  UserPlus,
  Shield,
  X,
  AlertCircle,
  RefreshCw,
  Power,
} from "lucide-react";
import { adminFetch } from "../api/client";
import { useAuth } from "../context/AuthContext";

interface AdminItem {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
}

export const AdminsPage: React.FC = () => {
  const { admin: currentAdmin } = useAuth();
  const [admins, setAdmins] = useState<AdminItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New Admin Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("admin");
  const [createLoading, setCreateLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchAdmins = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminFetch<{ success: boolean; admins: AdminItem[] }>("/api/admin/admins");
      if (res.success) {
        setAdmins(res.admins);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load admin accounts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      setModalError("Please provide all required fields.");
      return;
    }

    setCreateLoading(true);
    setModalError(null);

    try {
      const res = await adminFetch<{ success: boolean; admin: AdminItem }>("/api/admin/admins", {
        method: "POST",
        body: JSON.stringify({ name, email, password, role }),
      });

      if (res.success) {
        setAdmins([res.admin, ...admins]);
        setShowCreateModal(false);
        setName("");
        setEmail("");
        setPassword("");
        setRole("admin");
      }
    } catch (err: any) {
      setModalError(err.message || "Failed to create admin");
    } finally {
      setCreateLoading(false);
    }
  };

  const toggleStatus = async (adminId: string) => {
    if (adminId === currentAdmin?.id) {
      alert("You cannot deactivate your own admin account.");
      return;
    }

    try {
      const res = await adminFetch<{ success: boolean; admin: AdminItem }>(
        `/api/admin/admins/${adminId}/toggle`,
        { method: "PATCH" }
      );
      if (res.success) {
        setAdmins(
          admins.map((a) => (a.id === adminId ? { ...a, isActive: res.admin.isActive } : a))
        );
      }
    } catch (err: any) {
      alert(err.message || "Failed to update status");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Top Banner & Action */}
      <div className="glass-card" style={{ padding: "22px 26px" }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <div>
            <h3 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-pure)" }}>
              Admin User Directory (Separate Table)
            </h3>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>
              Stored strictly in the independent <code style={{ color: "var(--flame-pink)" }}>admin_user</code> table, completely isolated from mobile app users.
            </p>
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={fetchAdmins} className="btn btn-secondary">
              <RefreshCw size={14} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
              <span>Refresh</span>
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary"
            >
              <UserPlus size={16} />
              <span>Add Admin Account</span>
            </button>
          </div>
        </div>
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
          }}
        >
          {error}
        </div>
      )}

      {/* Admin Users Table */}
      <div className="glass-card" style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid var(--border-subtle)",
                  backgroundColor: "rgba(255, 255, 255, 0.02)",
                  color: "var(--text-muted)",
                  fontSize: "12px",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                <th style={{ padding: "16px 20px" }}>Staff Member</th>
                <th style={{ padding: "16px 16px" }}>Email</th>
                <th style={{ padding: "16px 16px" }}>Role</th>
                <th style={{ padding: "16px 16px" }}>Status</th>
                <th style={{ padding: "16px 16px" }}>Last Login</th>
                <th style={{ padding: "16px 16px" }}>Created</th>
                <th style={{ padding: "16px 20px", textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                    <RefreshCw size={20} style={{ animation: "spin 1s linear infinite", display: "inline-block", marginRight: "8px" }} />
                    Loading admin roster...
                  </td>
                </tr>
              ) : admins.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                    No admin accounts found.
                  </td>
                </tr>
              ) : (
                admins.map((adm) => {
                  const isCurrent = adm.id === currentAdmin?.id;
                  return (
                    <tr
                      key={adm.id}
                      style={{
                        borderBottom: "1px solid var(--border-subtle)",
                        transition: "background var(--transition-fast)",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.02)")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                    >
                      <td style={{ padding: "14px 20px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <div
                            style={{
                              width: "36px",
                              height: "36px",
                              borderRadius: "50%",
                              background: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "#ffffff",
                              fontWeight: 700,
                              fontSize: "14px",
                            }}
                          >
                            {adm.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-pure)", display: "flex", alignItems: "center", gap: "6px" }}>
                              <span>{adm.name}</span>
                              {isCurrent && (
                                <span style={{ fontSize: "11px", color: "var(--flame-pink)", fontWeight: 700 }}>
                                  (You)
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: "14px 16px", fontSize: "13px", color: "var(--text-primary)" }}>
                        {adm.email}
                      </td>

                      <td style={{ padding: "14px 16px" }}>
                        <span className={adm.role === "superadmin" ? "badge badge-purple" : "badge badge-info"}>
                          <Shield size={11} /> {adm.role}
                        </span>
                      </td>

                      <td style={{ padding: "14px 16px" }}>
                        {adm.isActive ? (
                          <span className="badge badge-success">Active</span>
                        ) : (
                          <span className="badge badge-danger">Deactivated</span>
                        )}
                      </td>

                      <td style={{ padding: "14px 16px", fontSize: "12.5px", color: "var(--text-muted)" }}>
                        {adm.lastLogin ? new Date(adm.lastLogin).toLocaleString() : "Never logged in"}
                      </td>

                      <td style={{ padding: "14px 16px", fontSize: "12.5px", color: "var(--text-muted)" }}>
                        {new Date(adm.createdAt).toLocaleDateString()}
                      </td>

                      <td style={{ padding: "14px 20px", textAlign: "right" }}>
                        <button
                          onClick={() => toggleStatus(adm.id)}
                          disabled={isCurrent}
                          className={adm.isActive ? "btn btn-danger" : "btn btn-secondary"}
                          style={{
                            padding: "6px 12px",
                            fontSize: "12px",
                            opacity: isCurrent ? 0.4 : 1,
                            cursor: isCurrent ? "not-allowed" : "pointer",
                          }}
                          title={isCurrent ? "Cannot toggle own account" : "Toggle active state"}
                        >
                          <Power size={13} />
                          <span>{adm.isActive ? "Deactivate" : "Activate"}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Admin Modal */}
      {showCreateModal && (
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
            zIndex: 100,
            padding: "20px",
          }}
        >
          <div
            className="glass-card animate-fade-in"
            style={{
              width: "100%",
              maxWidth: "460px",
              padding: "32px",
              position: "relative",
              border: "1px solid rgba(255, 255, 255, 0.15)",
            }}
          >
            <button
              onClick={() => setShowCreateModal(false)}
              style={{
                position: "absolute",
                top: "20px",
                right: "20px",
                background: "transparent",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
              }}
            >
              <X size={20} />
            </button>

            <h3 style={{ fontSize: "19px", fontWeight: 700, marginBottom: "6px" }}>
              Add New Admin User
            </h3>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "22px" }}>
              Credentials will be encrypted with bcrypt and stored in <code style={{ color: "var(--flame-pink)" }}>admin_user</code>.
            </p>

            {modalError && (
              <div
                style={{
                  marginBottom: "16px",
                  padding: "10px 14px",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "var(--color-danger-bg)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  color: "#f87171",
                  fontSize: "12.5px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <AlertCircle size={15} />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateAdmin}>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>
                  Staff Full Name
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Sarah Connor"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>
                  Email Address
                </label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="sarah@flamy.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>
                  Password
                </label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Minimum 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <div style={{ marginBottom: "24px" }}>
                <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>
                  Role Permission
                </label>
                <select
                  className="form-input"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  <option value="admin">Administrator</option>
                  <option value="moderator">Content Moderator</option>
                  <option value="superadmin">Superadmin</option>
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={createLoading}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="btn btn-primary"
                >
                  {createLoading ? "Creating..." : "Save Admin"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
