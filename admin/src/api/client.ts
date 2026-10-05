/**
 * Central API Client for Admin Operations
 */

export const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5001";

export const getAdminToken = (): string | null => {
  return localStorage.getItem("flamy_admin_token");
};

export const setAdminToken = (token: string | null) => {
  if (token) {
    localStorage.setItem("flamy_admin_token", token);
  } else {
    localStorage.removeItem("flamy_admin_token");
  }
};

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  [key: string]: any;
}

export async function adminFetch<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAdminToken();
  const url = `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
    headers["x-admin-token"] = token;
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    const data = await res.json().catch(() => ({
      success: false,
      message: `Failed to parse response (HTTP ${res.status})`,
    }));

    if (res.status === 401) {
      // Unauthorized: clear token if logged in
      if (token && !endpoint.includes("/auth/login")) {
        setAdminToken(null);
        window.location.href = "/login?expired=true";
      }
    }

    if (!res.ok) {
      throw new Error(data.message || `Request failed with status ${res.status}`);
    }

    return data as T;
  } catch (err: any) {
    console.error(`[API ERROR] ${endpoint}:`, err);
    throw err;
  }
}
