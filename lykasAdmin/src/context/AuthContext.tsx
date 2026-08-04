import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, tokenStore, getApiErrorMessage } from "../services/api";
import type { AdminUser, UserRole } from "../types/auth";

interface AuthContextValue {
  user: AdminUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (...roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Staff-facing roles only — a plain "user" account has no business
// holding an admin-panel session at all.
const STAFF_ROLES: UserRole[] = ["staff", "admin", "super_admin"];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    if (!tokenStore.getAccessToken()) {
      setLoading(false);
      return;
    }
    try {
      const res = await api.get("/api/auth/me");
      const fetchedUser: AdminUser = res.data.data.user;
      if (!STAFF_ROLES.includes(fetchedUser.role)) {
        tokenStore.clear();
        setUser(null);
      } else {
        setUser(fetchedUser);
      }
    } catch {
      tokenStore.clear();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post("/api/auth/login", { email, password });
    const { user: loggedInUser, accessToken, refreshToken } = res.data.data;

    if (!STAFF_ROLES.includes(loggedInUser.role)) {
      throw new Error("This account does not have admin panel access.");
    }

    tokenStore.setTokens(accessToken, refreshToken);
    setUser(loggedInUser);
  }, []);

  const loginWithGoogle = useCallback(async (idToken: string) => {
    const res = await api.post("/api/auth/google", { idToken, platform: "web" });
    const { user: loggedInUser, accessToken, refreshToken } = res.data.data;

    if (!STAFF_ROLES.includes(loggedInUser.role)) {
      throw new Error("This account does not have admin panel access.");
    }

    tokenStore.setTokens(accessToken, refreshToken);
    setUser(loggedInUser);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/api/auth/logout", { refreshToken: tokenStore.getRefreshToken() });
    } catch {
      // Best-effort — clear local state regardless of whether the
      // server-side blacklist call succeeded.
    }
    tokenStore.clear();
    setUser(null);
  }, []);

  const hasRole = useCallback(
    (...roles: UserRole[]) => {
      if (!user) return false;
      if (user.role === "super_admin") return true;
      return roles.includes(user.role);
    },
    [user]
  );

  const value = useMemo(() => ({ user, loading, login, loginWithGoogle, logout, hasRole }), [user, loading, login, loginWithGoogle, logout, hasRole]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

export { getApiErrorMessage };
