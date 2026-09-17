const LOCAL_API_URL =
  "http://127.0.0.1:5050/api";

const REQUEST_TIMEOUT_MS = 30000;

function createApiError(
  message,
  options = {}
) {
  const error = new Error(message);

  error.status =
    options.status || 0;

  error.code =
    options.code ||
    "API_ERROR";

  error.data =
    options.data || null;

  error.url =
    options.url || "";

  return error;
}

export function getApiBaseUrl() {
  const configuredUrl =
    String(
      process.env
        .NEXT_PUBLIC_API_URL || ""
    )
      .trim()
      .replace(/\/+$/, "");

  if (configuredUrl) {
    return configuredUrl.endsWith(
      "/api"
    )
      ? configuredUrl
      : `${configuredUrl}/api`;
  }

  if (
    process.env.NODE_ENV ===
    "development"
  ) {
    return LOCAL_API_URL;
  }

  throw createApiError(
    "The ChapsSmS API URL is not configured for this deployment.",
    {
      code:
        "API_URL_MISSING",
    }
  );
}

export function getStoredToken() {
  if (
    typeof window === "undefined"
  ) {
    return "";
  }

  return (
    localStorage.getItem(
      "chapsms-token"
    ) ||
    sessionStorage.getItem(
      "chapsms-token"
    ) ||
    ""
  );
}

export function clearStoredSession() {
  if (
    typeof window === "undefined"
  ) {
    return;
  }

  [
    localStorage,
    sessionStorage,
  ].forEach((storage) => {
    storage.removeItem(
      "chapsms-token"
    );

    storage.removeItem(
      "chapsms-user"
    );
  });
}

function buildApiUrl(path) {
  const baseUrl =
    getApiBaseUrl();

  const normalizedPath =
    String(path || "").startsWith(
      "/"
    )
      ? String(path)
      : `/${String(path || "")}`;

  return `${baseUrl}${normalizedPath}`;
}

async function parseResponse(
  response
) {
  const contentType =
    response.headers.get(
      "content-type"
    ) || "";

  if (
    contentType.includes(
      "application/json"
    )
  ) {
    return response.json();
  }

  const text =
    await response.text();

  return text
    ? {
        message: text,
      }
    : {};
}

export async function api(
  path,
  options = {}
) {
  const url = buildApiUrl(path);

  const controller =
    new AbortController();

  const timeoutId =
    window.setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS
    );

  const token =
    getStoredToken();

  const headers =
    new Headers(
      options.headers || {}
    );

  const hasBody =
    options.body !== undefined &&
    options.body !== null;

  const bodyIsFormData =
    typeof FormData !==
      "undefined" &&
    options.body instanceof FormData;

  if (
    hasBody &&
    !bodyIsFormData &&
    !headers.has(
      "Content-Type"
    )
  ) {
    headers.set(
      "Content-Type",
      "application/json"
    );
  }

  if (
    !headers.has("Accept")
  ) {
    headers.set(
      "Accept",
      "application/json"
    );
  }

  if (
    token &&
    !headers.has(
      "Authorization"
    )
  ) {
    headers.set(
      "Authorization",
      `Bearer ${token}`
    );
  }

  try {
    const response =
      await fetch(url, {
        ...options,
        headers,
        credentials: "include",
        signal:
          options.signal ||
          controller.signal,
      });

    const data =
      await parseResponse(
        response
      );

    if (!response.ok) {
      throw createApiError(
        data?.message ||
          `Request failed with status ${response.status}`,
        {
          status:
            response.status,
          code:
            data?.code ||
            "API_REQUEST_FAILED",
          data,
          url,
        }
      );
    }

    return data;
  } catch (error) {
    if (
      error?.name ===
      "AbortError"
    ) {
      throw createApiError(
        "The server took too long to respond. Please try again.",
        {
          code:
            "REQUEST_TIMEOUT",
          url,
        }
      );
    }

    if (
      error?.code
    ) {
      throw error;
    }

    throw createApiError(
      "Unable to reach the ChapsSmS server. Please try again shortly.",
      {
        code:
          "NETWORK_ERROR",
        data: {
          apiUrl:
            getApiBaseUrl(),
          originalMessage:
            error?.message || "",
        },
        url,
      }
    );
  } finally {
    window.clearTimeout(
      timeoutId
    );
  }
}
