import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { AxiosRequestConfig, AxiosResponse } from "axios";
import axios, { AxiosError } from "axios";
import { api, tokenStore } from "../../src/services/api";

/**
 * A minimal custom axios adapter so these tests exercise the real
 * request/response interceptor pipeline (including the retry-with-new-token
 * path) without making any real network calls.
 *
 * Real adapters (xhr/http) call axios's internal `settle()` themselves to
 * decide resolve vs. reject based on `validateStatus` — `dispatchRequest`
 * does not do this generically. A bare custom adapter has to replicate that
 * or every response (even 401s) will resolve instead of rejecting.
 */
function makeAdapter(handler: (config: AxiosRequestConfig) => { status: number; data?: unknown }) {
  return async (config: AxiosRequestConfig): Promise<AxiosResponse> => {
    const result = handler(config);
    const response: AxiosResponse = {
      data: (result.data ?? {}) as never,
      status: result.status,
      statusText: "",
      headers: {},
      config: config as AxiosResponse["config"],
      request: {},
    };

    const validateStatus = config.validateStatus;
    if (!validateStatus || validateStatus(response.status)) {
      return response;
    }
    return Promise.reject(
      new AxiosError(
        `Request failed with status code ${response.status}`,
        String(Math.floor(response.status / 100)) === "4" ? AxiosError.ERR_BAD_REQUEST : AxiosError.ERR_BAD_RESPONSE,
        config,
        undefined,
        response
      )
    );
  };
}

describe("api response interceptor — 401 refresh-and-retry", () => {
  beforeEach(() => {
    sessionStorage.clear();
    tokenStore.setTokens("old-access-token", "valid-refresh-token");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("refreshes and retries a 401 on a non-auth-flow endpoint like /api/auth/me", async () => {
    let callCount = 0;
    const adapter = makeAdapter((config) => {
      if (config.url === "/api/auth/me") {
        callCount += 1;
        // First call: stale access token -> 401. Retried call (after refresh): success.
        if (callCount === 1) return { status: 401, data: { success: false, message: "Unauthorized" } };
        return { status: 200, data: { success: true, data: { _id: "u1" } } };
      }
      return { status: 200, data: {} };
    });

    const postSpy = vi.spyOn(axios, "post").mockResolvedValue({
      data: { data: { accessToken: "new-access-token", refreshToken: "new-refresh-token" } },
    });

    const res = await api.get("/api/auth/me", { adapter });

    expect(res.status).toBe(200);
    expect(callCount).toBe(2);
    expect(postSpy).toHaveBeenCalledWith(expect.stringContaining("/api/auth/refresh"), { refreshToken: "valid-refresh-token" });
    expect(tokenStore.getAccessToken()).toBe("new-access-token");
  });

  it("refreshes and retries a 401 on the users list endpoint (/api/auth/users)", async () => {
    let callCount = 0;
    const adapter = makeAdapter((config) => {
      if (config.url === "/api/auth/users") {
        callCount += 1;
        if (callCount === 1) return { status: 401 };
        return { status: 200, data: { success: true, data: [] } };
      }
      return { status: 200, data: {} };
    });

    vi.spyOn(axios, "post").mockResolvedValue({
      data: { data: { accessToken: "new-access-token", refreshToken: "new-refresh-token" } },
    });

    const res = await api.get("/api/auth/users", { adapter });

    expect(res.status).toBe(200);
    expect(callCount).toBe(2);
  });

  it("does not attempt refresh-and-retry for a 401 on an auth-flow endpoint like /api/auth/login", async () => {
    const adapter = makeAdapter((config) => {
      if (config.url === "/api/auth/login") return { status: 401, data: { success: false, message: "Invalid credentials" } };
      return { status: 200, data: {} };
    });

    const postSpy = vi.spyOn(axios, "post").mockRejectedValue(new Error("refresh should not have been attempted"));

    await expect(
      api.post("/api/auth/login", { email: "a@b.com", password: "wrong" }, { adapter })
    ).rejects.toMatchObject({ response: { status: 401 } });

    expect(postSpy).not.toHaveBeenCalled();
  });

  it("does not attempt refresh-and-retry for a 401 on /api/auth/refresh itself", async () => {
    const adapter = makeAdapter((config) => {
      if (config.url === "/api/auth/refresh") return { status: 401, data: { success: false } };
      return { status: 200, data: {} };
    });

    const postSpy = vi.spyOn(axios, "post").mockRejectedValue(new Error("refresh should not have been attempted"));

    await expect(api.post("/api/auth/refresh", { refreshToken: "x" }, { adapter })).rejects.toMatchObject({
      response: { status: 401 },
    });

    expect(postSpy).not.toHaveBeenCalled();
  });
});
