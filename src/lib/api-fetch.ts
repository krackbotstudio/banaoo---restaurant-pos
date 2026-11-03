import { API_URL } from "@/lib/api-url";

/**
 * Global fetch wrapper:
 * Automatically attaches `Authorization: Bearer <token>` to all requests made to API_URL.
 * This guarantees authentication succeeds even when browsers (Chrome, Safari, iOS, Incognito)
 * block cross-origin third-party cookies between frontend and backend domains.
 */
if (typeof window !== "undefined" && !(window as any).__banaooFetchPatched) {
  (window as any).__banaooFetchPatched = true;
  const originalFetch = window.fetch.bind(window);

  window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
    const token = localStorage.getItem("banaoo_auth_token");
    if (!token) {
      return originalFetch(input, init);
    }

    const urlString =
      typeof input === "string"
        ? input
        : input instanceof URL
        ? input.toString()
        : input instanceof Request
        ? input.url
        : "";

    const isBackendCall =
      (API_URL && urlString.startsWith(API_URL)) ||
      urlString.startsWith("/api") ||
      urlString.startsWith("/auth");

    if (isBackendCall) {
      const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : {}));
      if (!headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${token}`);
      }
      return originalFetch(input, { ...init, headers });
    }

    return originalFetch(input, init);
  };
}

