"use client";

const configuredApiUrl = String(
  process.env.NEXT_PUBLIC_API_URL || ""
)
  .trim()
  .replace(/\/+$/, "");

const DEFAULT_TIMEOUT_MS = Math.max(
  10000,
  Number(
    process.env.NEXT_PUBLIC_API_TIMEOUT_MS ||
      75000
  )
);

const BACKEND_WARM_TTL_MS =
  10 * 60 * 1000;

let warmupPromise = null;
let backendWarmUntil = 0;

function getApiUrl() {
  if (!configuredApiUrl) {
    const error = new Error(
      "NEXT_PUBLIC_API_URL is not configured"
    );

    error.code =
      "API_URL_MISSING";

    throw error;
  }

  return configuredApiUrl;
}

function createApiError(
  response,
  data
) {
  const error = new Error(
    data?.message ||
      `Request failed with status ${response.status}`
  );

  error.status =
    response.status;

  error.code =
    data?.code ||
    "API_REQUEST_FAILED";

  error.data = data || {};

  return error;
}

function normalizeEmailPayload(
  value
) {
  if (
    value &&
    typeof value === "object"
  ) {
    return value;
  }

  return {
    email: String(value || "")
      .trim()
      .toLowerCase(),
  };
}

function createRequestController(
  externalSignal,
  timeoutMs
) {
  const controller =
    new AbortController();

  let timedOut = false;

  const abortFromExternal =
    () => {
      if (
        !controller.signal.aborted
      ) {
        controller.abort(
          externalSignal?.reason
        );
      }
    };

  if (externalSignal) {
    if (externalSignal.aborted) {
      abortFromExternal();
    } else {
      externalSignal.addEventListener(
        "abort",
        abortFromExternal,
        {
          once: true,
        }
      );
    }
  }

  const timer =
    window.setTimeout(
      () => {
        timedOut = true;

        if (
          !controller.signal.aborted
        ) {
          controller.abort();
        }
      },
      Math.max(
        1000,
        Number(
          timeoutMs ||
            DEFAULT_TIMEOUT_MS
        )
      )
    );

  return {
    signal:
      controller.signal,

    didTimeout() {
      return timedOut;
    },

    cleanup() {
      window.clearTimeout(
        timer
      );

      externalSignal
        ?.removeEventListener?.(
          "abort",
          abortFromExternal
        );
    },
  };
}

export async function warmBackend({
  force = false,
} = {}) {
  if (
    typeof window ===
    "undefined"
  ) {
    return false;
  }

  const now = Date.now();

  if (
    !force &&
    backendWarmUntil > now
  ) {
    return true;
  }

  if (warmupPromise) {
    return warmupPromise;
  }

  warmupPromise =
    (async () => {
      const controller =
        new AbortController();

      const timer =
        window.setTimeout(
          () =>
            controller.abort(),
          70000
        );

      try {
        const response =
          await fetch(
            `${getApiUrl()}/cors-test`,
            {
              method: "GET",
              cache: "no-store",
              credentials:
                "omit",
              signal:
                controller.signal,
            }
          );

        if (!response.ok) {
          return false;
        }

        backendWarmUntil =
          Date.now() +
          BACKEND_WARM_TTL_MS;

        return true;
      } catch {
        return false;
      } finally {
        window.clearTimeout(
          timer
        );

        warmupPromise = null;
      }
    })();

  return warmupPromise;
}

async function request(
  path,
  {
    method = "GET",
    body,
    token,
    signal,
    timeoutMs =
      DEFAULT_TIMEOUT_MS,
  } = {}
) {
  const headers = {
    Accept:
      "application/json",
  };

  if (body !== undefined) {
    headers[
      "Content-Type"
    ] = "application/json";
  }

  if (token) {
    headers.Authorization =
      `Bearer ${token}`;
  }

  const requestController =
    createRequestController(
      signal,
      timeoutMs
    );

  let response;

  try {
    response = await fetch(
      `${getApiUrl()}${path}`,
      {
        method,
        headers,

        body:
          body === undefined
            ? undefined
            : JSON.stringify(
                body
              ),

        cache: "no-store",

        credentials:
          "include",

        signal:
          requestController
            .signal,
      }
    );
  } catch (cause) {
    const timedOut =
      requestController
        .didTimeout();

    const error = new Error(
      timedOut
        ? "ChapsSms is taking longer than expected to respond. Please try again."
        : "Unable to reach the ChapsSms server. Check your connection and try again."
    );

    error.code =
      timedOut
        ? "REQUEST_TIMEOUT"
        : "NETWORK_ERROR";

    error.cause = cause;

    throw error;
  } finally {
    requestController.cleanup();
  }

  const contentType =
    response.headers.get(
      "content-type"
    ) || "";

  const data =
    contentType.includes(
      "application/json"
    )
      ? await response
          .json()
          .catch(
            () => ({})
          )
      : {
          message:
            await response.text(),
        };

  if (!response.ok) {
    throw createApiError(
      response,
      data
    );
  }

  backendWarmUntil =
    Date.now() +
    BACKEND_WARM_TTL_MS;

  return data;
}

/*
 * Start warming on genuine visitor traffic as soon as this client module loads.
 */
if (
  typeof window !==
  "undefined" &&
  !window
    .__chapsSmsBackendWarmupStarted
) {
  window
    .__chapsSmsBackendWarmupStarted =
    true;

  Promise.resolve()
    .then(
      () => warmBackend()
    )
    .catch(() => false);
}

/*
 * NAMED EXPORTS
 * These are required by pages such as:
 *
 * import { forgotPassword } from "@/services/auth.service";
 * import { resetPassword } from "@/services/auth.service";
 */

export function register(
  payload
) {
  return request(
    "/auth/register",
    {
      method: "POST",
      body: payload,
      timeoutMs: 90000,
    }
  );
}

export function login(
  payload
) {
  return request(
    "/auth/login",
    {
      method: "POST",
      body: payload,
      timeoutMs: 75000,
    }
  );
}

export function googleAuth(
  credential
) {
  return request(
    "/auth/google",
    {
      method: "POST",
      body: {
        credential,
      },
      timeoutMs: 75000,
    }
  );
}

/*
 * Compatibility alias for code calling authService.google().
 */
export const google =
  googleAuth;

export function verifyEmail(
  payload
) {
  return request(
    "/auth/verify-email",
    {
      method: "POST",
      body: payload,
    }
  );
}

export function resendVerification(
  emailOrPayload
) {
  return request(
    "/auth/resend-verification",
    {
      method: "POST",
      body:
        normalizeEmailPayload(
          emailOrPayload
        ),
      timeoutMs: 90000,
    }
  );
}

export const resendVerificationCode =
  resendVerification;

export const resendCode =
  resendVerification;

export function forgotPassword(
  emailOrPayload
) {
  return request(
    "/auth/forgot-password",
    {
      method: "POST",
      body:
        normalizeEmailPayload(
          emailOrPayload
        ),
      timeoutMs: 90000,
    }
  );
}

export function resetPassword(
  payload
) {
  return request(
    "/auth/reset-password",
    {
      method: "POST",
      body: payload,
    }
  );
}

export function changePassword(
  payload,
  token
) {
  return request(
    "/auth/change-password",
    {
      method: "POST",
      body: payload,
      token,
    }
  );
}

export function getMe(
  token
) {
  return request(
    "/auth/me",
    {
      token,
    }
  );
}

export const authService = {
  warmBackend,
  register,
  login,
  google: googleAuth,
  googleAuth,
  verifyEmail,
  resendVerification,
  resendVerificationCode,
  resendCode,
  forgotPassword,
  resetPassword,
  changePassword,
  getMe,
};

export default authService;
