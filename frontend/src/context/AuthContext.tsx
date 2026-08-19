import { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { ReactNode } from "react";
import type { UserRole } from "@/api/types";
import { login as loginApi } from "@/api/auth";
import {
  getStoredToken,
  setStoredToken,
  clearStoredToken,
  onUnauthorized,
} from "@/api/client";

interface AuthUser {
  userId: string;
  role: UserRole;
  vendorId: string | null;
  contractorId: string | null;
  name: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const USER_STORAGE_KEY = "vndly_user";

function loadStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

/**
 * True when the JWT is absent, unreadable, or past its `exp`.
 *
 * Checked on boot so a stale token cannot restore a session that the API will
 * reject on the first call — which previously left the user staring at an
 * empty dashboard instead of the login page.
 */
function isTokenExpired(token: string | null): boolean {
  if (!token) return true;
  const payload = token.split(".")[1];
  if (!payload) return true;
  try {
    const claims = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    if (typeof claims.exp !== "number") return false; // no expiry claim: let the API decide
    return claims.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

function clearSession() {
  clearStoredToken();
  localStorage.removeItem(USER_STORAGE_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const token = getStoredToken();
    const storedUser = loadStoredUser();
    if (token && storedUser && !isTokenExpired(token)) {
      setUser(storedUser);
    } else if (token || storedUser) {
      // Half-present or expired session — drop both halves so the app starts
      // cleanly at the login page rather than a dashboard it cannot populate.
      clearSession();
    }
    setIsInitializing(false);
  }, []);

  // A 401 from any request means this session is over. Clearing it in React
  // (rather than a hard window redirect) keeps the router in charge, so the
  // user lands on /login with their attempted page remembered.
  useEffect(() => onUnauthorized(() => {
    clearSession();
    setUser(null);
  }), []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await loginApi(email, password);
    setStoredToken(res.access_token);
    const authUser: AuthUser = {
      userId: res.user_id,
      role: res.role,
      vendorId: res.vendor_id,
      contractorId: res.contractor_id,
      name: res.name,
    };
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(authUser));
    setUser(authUser);
    return authUser;
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: !!user, isInitializing, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
