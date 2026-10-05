import React, { useEffect, useState } from "react";
import {
  Search,
  CheckCircle,
  XCircle,
  Eye,
  Trash2,
  MapPin,
  Heart,
  ShieldAlert,
  X,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { adminFetch } from "../api/client";

interface UserItem {
  id: string;
  name: string;
  email: string | null;
  phoneNumber: string | null;
  phoneNumberVerified: boolean;
  emailVerified: boolean;
  image: string | null;
  createdAt: string;
  profile?: {
    age?: number | null;
    gender?: string | null;
    location?: string | null;
    avatarUrl?: string | null;
    jobTitle?: string | null;
    isGhostMode?: boolean;
    isIncognito?: boolean;
    lastActive?: string | null;
  } | null;
  photos?: Array<{ id: string; url: string }>;
  _count?: {
    sentLikes: number;
    receivedLikes: number;
    matchesAsUser1: number;
    matchesAsUser2: number;
    reportsReceived: number;
  };
}

interface UserDetail extends UserItem {
  profile?: {
    id: string;
    bio?: string | null;
    age?: number | null;
    gender?: string | null;
    lookingFor?: string[];
    location?: string | null;
    jobTitle?: string | null;
    tags?: string[];
    avatarUrl?: string | null;
    isGhostMode?: boolean;
    isIncognito?: boolean;
    lastActive?: string | null;
  } | null;
  preference?: {
    datingGoal?: string | null;
    personality?: string | null;
    partnerTraits?: string | null;
    dealBreakers?: string | null;
  } | null;
  photos: Array<{ id: string; url: string; order: number }>;
  reportsReceived: Array<{
    id: string;
    category: string;
    details?: string | null;
    createdAt: string;
    reporter: { id: string; name: string; email?: string | null };
  }>;
}

export const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [gender, setGender] = useState("all");
  const [verified, setVerified] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);

  // Modals state
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userDetail, setUserDetail] = useState<UserDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserItem | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (gender !== "all") params.append("gender", gender);
      if (verified !== "all") params.append("verified", verified);
      params.append("page", page.toString());
      params.append("limit", "12");

      const res = await adminFetch<{
        success: boolean;
        users: UserItem[];
        pagination: { total: number; totalPages: number };
      }>(`/api/admin/users?${params.toString()}`);

      if (res.success) {
        setUsers(res.users);
        setTotalUsers(res.pagination.total);
        setTotalPages(res.pagination.totalPages);
      }
    } catch (err) {
      console.error("Failed to load users:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [search, gender, verified, page]);

  const viewUserDetail = async (id: string) => {
    setSelectedUserId(id);
    setLoadingDetail(true);
    try {
      const res = await adminFetch<{ success: boolean; user: UserDetail }>(`/api/admin/users/${id}`);
      if (res.success) {
        setUserDetail(res.user);
      }
    } catch (err) {
      console.error("Failed to load user details:", err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleToggleVerification = async () => {
    if (!userDetail) return;
    setActionLoading(true);
    try {
      const newStatus = !userDetail.phoneNumberVerified;
      const res = await adminFetch(`/api/admin/users/${userDetail.id}`, {
        method: "PATCH",
        body: JSON.stringify({ phoneNumberVerified: newStatus }),
      });
      if (res.success) {
        setUserDetail({ ...userDetail, phoneNumberVerified: newStatus });
        setUsers(users.map((u) => (u.id === userDetail.id ? { ...u, phoneNumberVerified: newStatus } : u)));
      }
    } catch (err) {
      alert("Failed to update user status");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    setActionLoading(true);
    try {
      const res = await adminFetch(`/api/admin/users/${userToDelete.id}`, {
        method: "DELETE",
      });
      if (res.success) {
        setUsers(users.filter((u) => u.id !== userToDelete.id));
        setUserToDelete(null);
        if (selectedUserId === userToDelete.id) {
          setSelectedUserId(null);
          setUserDetail(null);
        }
      }
    } catch (err) {
      alert("Failed to delete user account.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Search and Filters Header */}
      <div className="glass-card" style={{ padding: "18px 22px" }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "14px",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Search Box */}
          <div style={{ position: "relative", flex: "1 1 300px" }}>
            <Search
              size={16}
              style={{
                position: "absolute",
                left: "14px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-muted)",
              }}
            />
            <input
              type="text"
              placeholder="Search by user name, phone, or email..."
              className="form-input"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              style={{ paddingLeft: "40px" }}
            />
          </div>

          {/* Filters Row */}
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            {/* Gender Filter */}
            <select
              className="form-input"
              value={gender}
              onChange={(e) => {
                setGender(e.target.value);
                setPage(1);
              }}
              style={{ width: "auto", minWidth: "130px" }}
            >
              <option value="all">All Genders</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Non-binary">Non-binary</option>
            </select>

            {/* Verification Filter */}
            <select
              className="form-input"
              value={verified}
              onChange={(e) => {
                setVerified(e.target.value);
                setPage(1);
              }}
              style={{ width: "auto", minWidth: "150px" }}
            >
              <option value="all">All Verification</option>
              <option value="true">Verified Phone</option>
              <option value="false">Unverified</option>
            </select>

            <button onClick={fetchUsers} className="btn btn-secondary" title="Reload List">
              <RefreshCw size={14} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
            </button>
          </div>
        </div>

        <div style={{ marginTop: "12px", fontSize: "12px", color: "var(--text-muted)" }}>
          Showing <strong>{users.length}</strong> of <strong>{totalUsers}</strong> registered users
        </div>
      </div>

      {/* Users Table */}
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
                <th style={{ padding: "16px 20px" }}>User</th>
                <th style={{ padding: "16px 14px" }}>Contact</th>
                <th style={{ padding: "16px 14px" }}>Demographics</th>
                <th style={{ padding: "16px 14px" }}>Status</th>
                <th style={{ padding: "16px 14px" }}>Engagement</th>
                <th style={{ padding: "16px 14px" }}>Registered</th>
                <th style={{ padding: "16px 20px", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                    <RefreshCw size={20} style={{ animation: "spin 1s linear infinite", display: "inline-block", marginRight: "8px" }} />
                    Loading users...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                    No users found matching current filters.
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const avatar = user.profile?.avatarUrl || user.photos?.[0]?.url || user.image;
                  const totalMatches = (user._count?.matchesAsUser1 || 0) + (user._count?.matchesAsUser2 || 0);
                  const reportCount = user._count?.reportsReceived || 0;

                  return (
                    <tr
                      key={user.id}
                      style={{
                        borderBottom: "1px solid var(--border-subtle)",
                        transition: "background var(--transition-fast)",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.02)")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                    >
                      {/* User Info */}
                      <td style={{ padding: "14px 20px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <div
                            style={{
                              width: "40px",
                              height: "40px",
                              borderRadius: "50%",
                              backgroundColor: "var(--bg-surface-elevated)",
                              backgroundImage: avatar ? `url(${avatar})` : undefined,
                              backgroundSize: "cover",
                              backgroundPosition: "center",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "var(--flame-pink)",
                              fontWeight: 700,
                              fontSize: "15px",
                              flexShrink: 0,
                              border: "1px solid var(--border-subtle)",
                            }}
                          >
                            {!avatar ? user.name.charAt(0).toUpperCase() : null}
                          </div>
                          <div>
                            <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-pure)" }}>
                              {user.name}
                            </div>
                            <div style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                              {user.id.slice(0, 10)}...
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Contact */}
                      <td style={{ padding: "14px 14px", fontSize: "13px" }}>
                        <div style={{ color: "var(--text-primary)" }}>
                          {user.phoneNumber || "No phone"}
                        </div>
                        <div style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>
                          {user.email || "No email"}
                        </div>
                      </td>

                      {/* Demographics */}
                      <td style={{ padding: "14px 14px", fontSize: "13px" }}>
                        <div style={{ color: "var(--text-primary)" }}>
                          {user.profile?.age ? `${user.profile.age} yrs` : "Age -"} • {user.profile?.gender || "Not set"}
                        </div>
                        {user.profile?.location && (
                          <div style={{ fontSize: "11.5px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "3px" }}>
                            <MapPin size={11} /> {user.profile.location}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ padding: "14px 14px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          {user.phoneNumberVerified ? (
                            <span className="badge badge-success">
                              <CheckCircle size={11} /> Verified
                            </span>
                          ) : (
                            <span className="badge badge-muted">
                              <XCircle size={11} /> Unverified
                            </span>
                          )}
                          {reportCount > 0 && (
                            <span className="badge badge-danger">
                              <ShieldAlert size={11} /> {reportCount} Flagged
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Engagement */}
                      <td style={{ padding: "14px 14px", fontSize: "12.5px" }}>
                        <div style={{ display: "flex", gap: "10px", color: "var(--text-secondary)" }}>
                          <span title="Matches" style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                            <Heart size={12} color="#ff3366" /> {totalMatches}
                          </span>
                          <span title="Likes Sent" style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                            👍 {user._count?.sentLikes || 0}
                          </span>
                        </div>
                      </td>

                      {/* Created At */}
                      <td style={{ padding: "14px 14px", fontSize: "12.5px", color: "var(--text-muted)" }}>
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: "14px 20px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "6px" }}>
                          <button
                            onClick={() => viewUserDetail(user.id)}
                            className="btn btn-secondary"
                            style={{ padding: "6px 10px", fontSize: "12px" }}
                            title="Inspect Profile"
                          >
                            <Eye size={14} />
                            <span>Inspect</span>
                          </button>
                          <button
                            onClick={() => setUserToDelete(user)}
                            className="btn btn-danger"
                            style={{ padding: "6px 10px", fontSize: "12px" }}
                            title="Delete Account"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div
            style={{
              padding: "16px 24px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderTop: "1px solid var(--border-subtle)",
            }}
          >
            <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>
              Page {page} of {totalPages}
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="btn btn-secondary"
                style={{ padding: "6px 14px", fontSize: "13px" }}
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="btn btn-secondary"
                style={{ padding: "6px 14px", fontSize: "13px" }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* User Details Modal */}
      {selectedUserId && (
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
              maxWidth: "680px",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "32px",
              position: "relative",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            <button
              onClick={() => {
                setSelectedUserId(null);
                setUserDetail(null);
              }}
              style={{
                position: "absolute",
                top: "20px",
                right: "20px",
                background: "transparent",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                padding: "6px",
              }}
            >
              <X size={20} />
            </button>

            {loadingDetail || !userDetail ? (
              <div style={{ padding: "60px", textAlign: "center", color: "var(--text-muted)" }}>
                <RefreshCw size={24} style={{ animation: "spin 1s linear infinite", display: "inline-block", marginBottom: "12px" }} />
                <p>Loading full profile and photos...</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
                {/* Header Profile Info */}
                <div style={{ display: "flex", gap: "18px", alignItems: "center" }}>
                  <div
                    style={{
                      width: "72px",
                      height: "72px",
                      borderRadius: "50%",
                      backgroundColor: "var(--bg-surface-elevated)",
                      backgroundImage: userDetail.profile?.avatarUrl || userDetail.photos?.[0]?.url
                        ? `url(${userDetail.profile?.avatarUrl || userDetail.photos?.[0]?.url})`
                        : undefined,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "24px",
                      fontWeight: 800,
                      color: "var(--flame-pink)",
                      flexShrink: 0,
                      border: "2px solid var(--flame-pink)",
                    }}
                  >
                    {!userDetail.profile?.avatarUrl && !userDetail.photos?.[0]?.url
                      ? userDetail.name.charAt(0).toUpperCase()
                      : null}
                  </div>
                  <div>
                    <h3 style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-pure)" }}>
                      {userDetail.name}
                    </h3>
                    <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "2px" }}>
                      {userDetail.phoneNumber || "No phone"} • {userDetail.email || "No email"}
                    </p>
                    <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                      <span className={userDetail.phoneNumberVerified ? "badge badge-success" : "badge badge-muted"}>
                        {userDetail.phoneNumberVerified ? "Phone Verified" : "Unverified"}
                      </span>
                      {userDetail.profile?.isGhostMode && (
                        <span className="badge badge-purple">Ghost Mode Active</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Profile Bio & Details */}
                <div
                  style={{
                    padding: "16px",
                    borderRadius: "var(--radius-md)",
                    backgroundColor: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  <div style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "8px" }}>
                    Profile Details
                  </div>
                  <p style={{ fontSize: "13.5px", color: "var(--text-primary)", fontStyle: userDetail.profile?.bio ? "normal" : "italic", marginBottom: "12px" }}>
                    {userDetail.profile?.bio ? `"${userDetail.profile.bio}"` : "No bio provided"}
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px", fontSize: "12.5px" }}>
                    <div>
                      <span style={{ color: "var(--text-muted)" }}>Job Title: </span>
                      <strong>{userDetail.profile?.jobTitle || "Not set"}</strong>
                    </div>
                    <div>
                      <span style={{ color: "var(--text-muted)" }}>Location: </span>
                      <strong>{userDetail.profile?.location || "Not set"}</strong>
                    </div>
                    <div>
                      <span style={{ color: "var(--text-muted)" }}>Dating Goal: </span>
                      <strong>{userDetail.preference?.datingGoal || "Not set"}</strong>
                    </div>
                  </div>
                </div>

                {/* Photo Gallery */}
                <div>
                  <div style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "10px" }}>
                    Uploaded Photos ({userDetail.photos?.length || 0})
                  </div>
                  {userDetail.photos?.length === 0 ? (
                    <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>No profile photos uploaded.</div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: "10px" }}>
                      {userDetail.photos?.map((photo) => (
                        <a
                          key={photo.id}
                          href={photo.url}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            aspectRatio: "1/1",
                            borderRadius: "var(--radius-sm)",
                            overflow: "hidden",
                            border: "1px solid var(--border-subtle)",
                            display: "block",
                          }}
                        >
                          <img
                            src={photo.url}
                            alt="User upload"
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                {/* Moderation History */}
                {userDetail.reportsReceived?.length > 0 && (
                  <div>
                    <div style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", color: "var(--color-danger)", marginBottom: "8px" }}>
                      Reports against this user ({userDetail.reportsReceived.length})
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {userDetail.reportsReceived.map((rep) => (
                        <div
                          key={rep.id}
                          style={{
                            padding: "10px",
                            borderRadius: "var(--radius-sm)",
                            backgroundColor: "var(--color-danger-bg)",
                            border: "1px solid rgba(239, 68, 68, 0.2)",
                            fontSize: "12px",
                          }}
                        >
                          <strong>{rep.category}:</strong> {rep.details || "No details given"} (by {rep.reporter?.name})
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Direct Action Controls */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingTop: "16px",
                    borderTop: "1px solid var(--border-subtle)",
                  }}
                >
                  <button
                    onClick={handleToggleVerification}
                    disabled={actionLoading}
                    className="btn btn-secondary"
                    style={{ fontSize: "13px" }}
                  >
                    {userDetail.phoneNumberVerified ? "Revoke Verification" : "Mark as Verified"}
                  </button>

                  <button
                    onClick={() => setUserToDelete(userDetail)}
                    className="btn btn-danger"
                    style={{ fontSize: "13px" }}
                  >
                    <Trash2 size={15} />
                    <span>Delete User</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {userToDelete && (
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
              maxWidth: "420px",
              padding: "28px",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.7)",
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
              <h3 style={{ fontSize: "18px", fontWeight: 700 }}>Confirm Account Deletion</h3>
            </div>
            <p style={{ fontSize: "13.5px", color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: "24px" }}>
              Are you sure you want to permanently delete <strong>{userToDelete.name}</strong>?
              This will erase all photos, matches, messages, and profile records from the database.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                onClick={() => setUserToDelete(null)}
                disabled={actionLoading}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={actionLoading}
                className="btn btn-danger"
              >
                {actionLoading ? "Deleting..." : "Permanently Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
