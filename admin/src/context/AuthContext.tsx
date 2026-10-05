import React, { createContext, useContext, useState, useEffect } from "react";
import { adminFetch, getAdminToken, setAdminToken } from "../api/client";

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  avatar?: string | null;
  lastLogin?: string | null;
  createdAt?: string;
}

interface AuthContextType {
  admin: AdminUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [token, setTokenState] = useState<string | null>(getAdminToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshMe = async () => {
    const currentToken = getAdminToken();
    if (!currentToken) {
      setAdmin(null);
      setIsLoading(false);
      return;
    }

    try {
      const res = await adminFetch<{ success: boolean; admin: AdminUser }>("/api/admin/auth/me");
      if (res.success && res.admin) {
        setAdmin(res.admin);
      } else {
        setAdmin(null);
        setAdminToken(null);
        setTokenState(null);
      }
    } catch {
      setAdmin(null);
      setAdminToken(null);
      setTokenState(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshMe();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await adminFetch<{
      success: boolean;
      token: string;
      admin: AdminUser;
      message?: string;
    }>("/api/admin/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    if (res.success && res.token) {
      setAdminToken(res.token);
      setTokenState(res.token);
      setAdmin(res.admin);
    } else {
      throw new Error(res.message || "Login failed");
    }
  };

  const logout = async () => {
    try {
      await adminFetch("/api/admin/auth/logout", { method: "POST" });
    } catch {
      // Ignore network errors during logout
    } finally {
      setAdminToken(null);
      setTokenState(null);
      setAdmin(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        admin,
        token,
        isAuthenticated: !!admin && !!token,
        isLoading,
        login,
        logout,
        refreshMe,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
