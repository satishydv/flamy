import React from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  ShieldAlert,
  UserCog,
  Sliders,
  LogOut,
  Flame,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface SidebarProps {
  pendingReportsCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ pendingReportsCount = 0 }) => {
  const { admin, logout } = useAuth();

  const navItems = [
    {
      to: "/dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
    },
    {
      to: "/users",
      label: "User Management",
      icon: Users,
    },
    {
      to: "/reports",
      label: "Moderation Queue",
      icon: ShieldAlert,
      badge: pendingReportsCount > 0 ? pendingReportsCount : null,
    },
    {
      to: "/admins",
      label: "Admin Staff",
      icon: UserCog,
    },
    {
      to: "/settings",
      label: "System & API",
      icon: Sliders,
    },
  ];

  return (
    <aside
      style={{
        width: "260px",
        minWidth: "260px",
        backgroundColor: "var(--bg-surface)",
        borderRight: "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      {/* Brand Header */}
      <div
        style={{
          padding: "24px 20px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <div
          style={{
            width: "38px",
            height: "38px",
            borderRadius: "var(--radius-md)",
            background: "var(--flame-gradient)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "var(--flame-glow)",
          }}
        >
          <Flame size={22} color="#ffffff" />
        </div>
        <div>
          <div
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "17px",
              fontWeight: 800,
              letterSpacing: "-0.01em",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            FLAMY
            <span
              style={{
                fontSize: "10px",
                fontWeight: 700,
                padding: "2px 6px",
                borderRadius: "4px",
                backgroundColor: "rgba(255, 51, 102, 0.15)",
                color: "var(--flame-pink)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              OPS
            </span>
          </div>
          <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
            Admin Mission Control
          </p>
        </div>
      </div>

      {/* Navigation List */}
      <nav
        style={{
          padding: "20px 14px",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          flex: 1,
          overflowY: "auto",
        }}
      >
        <div
          style={{
            fontSize: "11px",
            fontWeight: 700,
            textTransform: "uppercase",
            color: "var(--text-muted)",
            letterSpacing: "0.08em",
            padding: "0 10px 8px 10px",
          }}
        >
          General Navigation
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              style={({ isActive }) => ({
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 12px",
                borderRadius: "var(--radius-md)",
                textDecoration: "none",
                fontSize: "13.5px",
                fontWeight: isActive ? 600 : 500,
                color: isActive ? "#ffffff" : "var(--text-secondary)",
                backgroundColor: isActive ? "rgba(255, 51, 102, 0.12)" : "transparent",
                border: isActive
                  ? "1px solid rgba(255, 51, 102, 0.3)"
                  : "1px solid transparent",
                transition: "all var(--transition-fast)",
              })}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <Icon size={18} />
                <span>{item.label}</span>
              </div>
              {item.badge ? (
                <span
                  style={{
                    backgroundColor: "var(--color-danger)",
                    color: "#ffffff",
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "2px 7px",
                    borderRadius: "var(--radius-full)",
                    boxShadow: "0 0 8px rgba(239, 68, 68, 0.4)",
                  }}
                >
                  {item.badge}
                </span>
              ) : null}
            </NavLink>
          );
        })}
      </nav>

      {/* Admin User Footer Profile Card */}
      <div
        style={{
          padding: "16px",
          borderTop: "1px solid var(--border-subtle)",
          backgroundColor: "rgba(10, 12, 18, 0.6)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
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
                flexShrink: 0,
              }}
            >
              {admin?.name?.charAt(0).toUpperCase() || "A"}
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#ffffff",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {admin?.name || "Admin"}
              </div>
              <div
                style={{
                  fontSize: "11px",
                  color: "var(--flame-pink)",
                  textTransform: "capitalize",
                  fontWeight: 600,
                }}
              >
                {admin?.role || "Superadmin"}
              </div>
            </div>
          </div>

          <button
            onClick={() => logout()}
            title="Log Out"
            style={{
              background: "transparent",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-sm)",
              padding: "7px",
              color: "var(--text-muted)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all var(--transition-fast)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--color-danger)";
              e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.3)";
              e.currentTarget.style.backgroundColor = "var(--color-danger-bg)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--text-muted)";
              e.currentTarget.style.borderColor = "var(--border-subtle)";
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
};
