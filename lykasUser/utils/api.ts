import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import * as SecureStore from "expo-secure-store";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000";

export interface ApiErrorShape {
  success: false;
  message: string;
  errors?: { field: string; message: string }[];
  requestId?: string;
}

const ACCESS_TOKEN_KEY = "carepaws_access_token";
const REFRESH_TOKEN_KEY = "carepaws_refresh_token";

/**
 * Token storage backed by expo-secure-store (iOS Keychain / Android
 * Keystore) rather than AsyncStorage, which is unencrypted on-device
 * JSON — see §6.5. AsyncStorage is reserved for genuinely non-sensitive
 * UI state elsewhere in the app (onboarding-seen flags, filter prefs).
 */
export const tokenStore = {
  async getAccessToken() {
    return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  },
  async getRefreshToken() {
    return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  },
  async setTokens(accessToken: string, refreshToken: string) {
    await Promise.all([
      SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken),
      SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken),
    ]);
  },
  async clear() {
    await Promise.all([SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY), SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY)]);
  },
};

export const api = axios.create({ baseURL: API_URL, timeout: 20000 });

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await tokenStore.getAccessToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshInFlight: Promise<string | null> | null = null;
let onSessionExpired: (() => void) | null = null;

/** Called once from the root layout so the API client can redirect to login on a hard session failure. */
export function setSessionExpiredHandler(handler: () => void) {
  onSessionExpired = handler;
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await tokenStore.getRefreshToken();
  if (!refreshToken) return null;

  try {
    const res = await axios.post(`${API_URL}/api/auth/refresh`, { refreshToken });
    const { accessToken, refreshToken: newRefreshToken } = res.data.data;
    await tokenStore.setTokens(accessToken, newRefreshToken);
    return accessToken;
  } catch {
    await tokenStore.clear();
    return null;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorShape>) => {
    const original = error.config as InternalAxiosRequestConfig & { _retried?: boolean };

    if (error.response?.status === 401 && original && !original._retried && !original.url?.includes("/auth/")) {
      original._retried = true;

      if (!refreshInFlight) {
        refreshInFlight = refreshAccessToken().finally(() => {
          refreshInFlight = null;
        });
      }

      const newToken = await refreshInFlight;
      if (newToken) {
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }

      onSessionExpired?.();
    }

    return Promise.reject(error);
  }
);

/** Pulls a human-readable message out of the shared error envelope (§8.1). */
export function getApiErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as ApiErrorShape | undefined;
    if (data?.errors?.length) return data.errors.map((e) => e.message).join(", ");
    if (data?.message) return data.message;
    if (err.code === "ECONNABORTED") return "The request timed out — check your connection and try again.";
  }
  return fallback;
}
