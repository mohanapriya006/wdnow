import { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { ReactNode } from "react";
import type { UserRole } from "@/api/types";
import {
  login as loginApi,
  registerVendor as registerVendorApi,
  registerContractor as registerContractorApi,
} from "@/api/auth";
import type { RegisterVendorPayload, RegisterContractorPayload } from "@/api/auth";
import { getStoredToken, setStoredToken, clearStoredToken } from "@/api/client";

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
  registerVendor: (payload: RegisterVendorPayload) => Promise<AuthUser>;
  registerContractor: (payload: RegisterContractorPayload) => Promise<AuthUser>;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const token = getStoredToken();
    const storedUser = loadStoredUser();
    if (token && storedUser) {
      setUser(storedUser);
    }
    setIsInitializing(false);
  }, []);

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

  const registerVendor = useCallback(async (payload: RegisterVendorPayload) => {
    const res = await registerVendorApi(payload);
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

  const registerContractor = useCallback(async (payload: RegisterContractorPayload) => {
    const res = await registerContractorApi(payload);
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
    clearStoredToken();
    localStorage.removeItem(USER_STORAGE_KEY);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isInitializing,
        login,
        registerVendor,
        registerContractor,
        logout,
      }}
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
