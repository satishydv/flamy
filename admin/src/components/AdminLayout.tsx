import React, { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { adminFetch } from "../api/client";

export const AdminLayout: React.FC = () => {
  const location = useLocation();
  const [pendingReports, setPendingReports] = useState<number>(0);

  // Poll or fetch pending reports count for sidebar badge
  useEffect(() => {
    adminFetch<{ success: boolean; stats: { pendingReports: number } }>("/api/admin/stats")
      .then((res) => {
        if (res.success && res.stats) {
          setPendingReports(res.stats.pendingReports || 0);
        }
      })
      .catch(() => {});
  }, [location.pathname]);

  const getPageMeta = () => {
    switch (location.pathname) {
      case "/dashboard":
        return {
          title: "System Overview",
          subtitle: "Real-time engagement, growth analytics, and core KPIs",
        };
      case "/users":
        return {
          title: "User Management Directory",
          subtitle: "Search, inspect, verify, and moderate registered accounts",
        };
      case "/reports":
        return {
          title: "Trust & Safety Moderation Queue",
          subtitle: "Investigate flagged profiles, harassment claims, and user reports",
        };
      case "/admins":
        return {
          title: "Administrative Staff",
          subtitle: "Manage operator access, team roles, and administrative permissions",
        };
      case "/settings":
        return {
          title: "System & API Gateway",
          subtitle: "Backend connectivity, VPS deployment settings, and endpoints",
        };
      default:
        return {
          title: "Admin Console",
          subtitle: "Flamy Operations Management",
        };
    }
  };

  const { title, subtitle } = getPageMeta();

  return (
    <div className="app-container">
      <Sidebar pendingReportsCount={pendingReports} />
      <div className="main-content">
        <Header title={title} subtitle={subtitle} />
        <main className="page-wrapper animate-fade-in">
          <Outlet context={{ setPendingReports }} />
        </main>
      </div>
    </div>
  );
};
