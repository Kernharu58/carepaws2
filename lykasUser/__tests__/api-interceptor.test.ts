import type { AxiosResponse, InternalAxiosRequestConfig } from "axios";
import axios, { AxiosError } from "axios";
import * as SecureStore from "expo-secure-store";
import { api, tokenStore } from "../utils/api";

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
function makeAdapter(handler: (config: InternalAxiosRequestConfig) => { status: number; data?: unknown }) {
  return async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
    const result = handler(config);
    const response: AxiosResponse = {
      data: (result.data ?? {}) as never,
      status: result.status,
      statusText: "",
      headers: {},
      config,
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
    jest.mocked(SecureStore.getItemAsync).mockImplementation((key: string) => {
      if (key === "carepaws_refresh_token") return Promise.resolve("valid-refresh-token");
      if (key === "carepaws_access_token") return Promise.resolve("old-access-token");
      return Promise.resolve(null);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("refreshes and retries a 401 on a non-auth-flow endpoint like /api/auth/me", async () => {
    let callCount = 0;
    const adapter = makeAdapter((config) => {
      if (config.url === "/api/auth/me") {
        callCount += 1;
        if (callCount === 1) return { status: 401, data: { success: false, message: "Unauthorized" } };
        return { status: 200, data: { success: true, data: { _id: "u1" } } };
      }
      return { status: 200, data: {} };
    });

    const postSpy = jest.spyOn(axios, "post").mockResolvedValue({
      data: { data: { accessToken: "new-access-token", refreshToken: "new-refresh-token" } },
    });

    const res = await api.get("/api/auth/me", { adapter });

    expect(res.status).toBe(200);
    expect(callCount).toBe(2);
    expect(postSpy).toHaveBeenCalledWith(expect.stringContaining("/api/auth/refresh"), { refreshToken: "valid-refresh-token" });
  });

  it("persists the refreshed tokens via tokenStore.setTokens after a successful refresh", async () => {
    let callCount = 0;
    const adapter = makeAdapter((config) => {
      if (config.url === "/api/auth/me") {
        callCount += 1;
        if (callCount === 1) return { status: 401 };
        return { status: 200, data: {} };
      }
      return { status: 200, data: {} };
    });

    jest.spyOn(axios, "post").mockResolvedValue({
      data: { data: { accessToken: "new-access-token", refreshToken: "new-refresh-token" } },
    });
    const setTokensSpy = jest.spyOn(tokenStore, "setTokens");

    await api.get("/api/auth/me", { adapter });

    expect(setTokensSpy).toHaveBeenCalledWith("new-access-token", "new-refresh-token");
  });

  it("refreshes and retries a 401 on the favorites endpoint (/api/auth/favorites)", async () => {
    let callCount = 0;
    const adapter = makeAdapter((config) => {
      if (config.url === "/api/auth/favorites") {
        callCount += 1;
        if (callCount === 1) return { status: 401 };
        return { status: 200, data: { success: true, data: [] } };
      }
      return { status: 200, data: {} };
    });

    jest.spyOn(axios, "post").mockResolvedValue({
      data: { data: { accessToken: "new-access-token", refreshToken: "new-refresh-token" } },
    });

    const res = await api.get("/api/auth/favorites", { adapter });

    expect(res.status).toBe(200);
    expect(callCount).toBe(2);
  });

  it("does not attempt refresh-and-retry for a 401 on an auth-flow endpoint like /api/auth/login", async () => {
    const adapter = makeAdapter((config) => {
      if (config.url === "/api/auth/login") return { status: 401, data: { success: false, message: "Invalid credentials" } };
      return { status: 200, data: {} };
    });

    const postSpy = jest.spyOn(axios, "post").mockRejectedValue(new Error("refresh should not have been attempted"));

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

    const postSpy = jest.spyOn(axios, "post").mockRejectedValue(new Error("refresh should not have been attempted"));

    await expect(api.post("/api/auth/refresh", { refreshToken: "x" }, { adapter })).rejects.toMatchObject({
      response: { status: 401 },
    });

    expect(postSpy).not.toHaveBeenCalled();
  });
});
