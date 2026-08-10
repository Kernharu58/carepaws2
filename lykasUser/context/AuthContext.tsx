import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, tokenStore, setSessionExpiredHandler } from "../utils/api";

export interface AppUser {
  id: string;
  displayName: string;
  email: string;
  role: "user" | "staff" | "admin" | "super_admin";
  status: "active" | "suspended" | "locked";
  emailVerified: boolean;
  profilePicture: string | null;
  identityVerificationStatus: "unverified" | "pending" | "verified" | "rejected";
  notificationsEnabled: boolean;
}

interface AuthContextValue {
  user: AppUser | null;
  loading: boolean;
  register: (displayName: string, email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    const token = await tokenStore.getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await api.get("/api/auth/me");
      setUser(res.data.data.user);
    } catch {
      await tokenStore.clear();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
    // Wired once so a hard session failure (refresh token also expired)
    // can bounce the app back to the auth flow from anywhere.
    setSessionExpiredHandler(() => setUser(null));
  }, [loadMe]);

  const register = useCallback(async (displayName: string, email: string, password: string) => {
    const res = await api.post("/api/auth/register", { displayName, email, password });
    const { user: newUser, accessToken, refreshToken } = res.data.data;
    await tokenStore.setTokens(accessToken, refreshToken);
    setUser(newUser);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post("/api/auth/login", { email, password });
    const { user: loggedInUser, accessToken, refreshToken } = res.data.data;
    await tokenStore.setTokens(accessToken, refreshToken);
    setUser(loggedInUser);
  }, []);

  const loginWithGoogle = useCallback(async (idToken: string) => {
    const res = await api.post("/api/auth/google", { idToken, platform: "mobile" });
    const { user: loggedInUser, accessToken, refreshToken } = res.data.data;
    await tokenStore.setTokens(accessToken, refreshToken);
    setUser(loggedInUser);
  }, []);

  const logout = useCallback(async () => {
    try {
      const refreshToken = await tokenStore.getRefreshToken();
      await api.post("/api/auth/logout", { refreshToken });
    } catch {
      // Best-effort — clear local state regardless of server outcome.
    }
    await tokenStore.clear();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const res = await api.get("/api/auth/me");
    setUser(res.data.data.user);
  }, []);

  const value = useMemo(
    () => ({ user, loading, register, login, loginWithGoogle, logout, refreshUser }),
    [user, loading, register, login, loginWithGoogle, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
