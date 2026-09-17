"use client";

import { useEffect, useRef, useState } from "react";

const GOOGLE_GSI_SRC =
  "https://accounts.google.com/gsi/client";

function getGoogleClientId() {
  return String(
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ""
  ).trim();
}

function loadGoogleIdentityServices() {
  if (typeof window === "undefined") {
    return Promise.reject(
      new Error(
        "Google sign-in can only run in the browser."
      )
    );
  }

  if (window.google?.accounts?.id) {
    return Promise.resolve(
      window.google
    );
  }

  if (
    window.__chapsSmsGsiScriptPromise
  ) {
    return window
      .__chapsSmsGsiScriptPromise;
  }

  window.__chapsSmsGsiScriptPromise =
    new Promise(
      (resolve, reject) => {
        const existingScript =
          document.querySelector(
            `script[src="${GOOGLE_GSI_SRC}"]`
          );

        const finish = () => {
          if (
            window.google?.accounts?.id
          ) {
            resolve(window.google);
            return;
          }

          reject(
            new Error(
              "Google Identity Services loaded, but the API is unavailable."
            )
          );
        };

        if (existingScript) {
          if (
            window.google?.accounts?.id
          ) {
            resolve(window.google);
            return;
          }

          existingScript.addEventListener(
            "load",
            finish,
            {
              once: true,
            }
          );

          existingScript.addEventListener(
            "error",
            () =>
              reject(
                new Error(
                  "Unable to load Google sign-in."
                )
              ),
            {
              once: true,
            }
          );

          return;
        }

        const script =
          document.createElement(
            "script"
          );

        script.src =
          GOOGLE_GSI_SRC;

        script.async = true;
        script.defer = true;

        script.onload = finish;

        script.onerror = () =>
          reject(
            new Error(
              "Unable to load Google sign-in."
            )
          );

        document.head.appendChild(
          script
        );
      }
    ).catch((error) => {
      delete window
        .__chapsSmsGsiScriptPromise;

      throw error;
    });

  return window
    .__chapsSmsGsiScriptPromise;
}

function normalizeButtonText(
  value
) {
  const allowed = new Set([
    "signin_with",
    "signup_with",
    "continue_with",
    "signin",
  ]);

  const normalized = String(
    value || "continue_with"
  ).trim();

  return allowed.has(normalized)
    ? normalized
    : "continue_with";
}

function getButtonWidth(
  element
) {
  const parent =
    element?.parentElement;

  const measuredWidth =
    parent?.getBoundingClientRect?.()
      .width ||
    element?.getBoundingClientRect?.()
      .width ||
    320;

  /*
   * Google accepts a numeric button width.
   * Keep it inside the supported desktop/mobile range.
   */
  return Math.max(
    200,
    Math.min(
      400,
      Math.floor(measuredWidth)
    )
  );
}

function waitForLayout() {
  return new Promise(
    (resolve) => {
      window.requestAnimationFrame(
        () => resolve()
      );
    }
  );
}

export default function GoogleAuthButton({
  onCredential,
  disabled = false,
  text = "continue_with",
  className = "",
}) {
  const buttonContainerRef =
    useRef(null);

  const onCredentialRef =
    useRef(onCredential);

  const [ready, setReady] =
    useState(false);

  const [error, setError] =
    useState("");

  /*
   * Keep the latest login/signup callback without
   * reinitializing the Google SDK every React render.
   */
  useEffect(() => {
    onCredentialRef.current =
      onCredential;

    if (
      typeof window !==
      "undefined"
    ) {
      window
        .__chapsSmsGoogleCredentialHandler =
        onCredential;
    }
  }, [onCredential]);

  useEffect(() => {
    let cancelled = false;

    const clientId =
      getGoogleClientId();

    if (!clientId) {
      setReady(false);

      setError(
        "Google sign-in is not configured. Add NEXT_PUBLIC_GOOGLE_CLIENT_ID to the frontend environment."
      );

      return undefined;
    }

    async function setup() {
      try {
        setError("");
        setReady(false);

        await loadGoogleIdentityServices();

        if (cancelled) {
          return;
        }

        const googleId =
          window.google
            ?.accounts?.id;

        const target =
          buttonContainerRef
            .current;

        if (!googleId) {
          throw new Error(
            "Google Identity Services is unavailable."
          );
        }

        if (!target) {
          return;
        }

        /*
         * IMPORTANT FIX:
         *
         * The previous component opted the button into FedCM:
         *     use_fedcm_for_button: true
         *
         * Your Chrome console was showing FedCM AbortError /
         * NetworkError. For the explicit Google button we use the
         * normal GIS popup flow instead.
         *
         * Google currently documents use_fedcm_for_button as optional
         * and false by default.
         */
        const initializationKey =
          `${clientId}|popup|fedcm-off|v2`;

        if (
          window
            .__chapsSmsGoogleInitializationKey !==
          initializationKey
        ) {
          googleId.initialize({
            client_id:
              clientId,

            callback:
              (response) => {
                const credential =
                  String(
                    response
                      ?.credential ||
                      ""
                  ).trim();

                if (
                  !credential
                ) {
                  console.error(
                    "[ChapsSms Google] Google returned no credential."
                  );

                  return;
                }

                const handler =
                  window
                    .__chapsSmsGoogleCredentialHandler ||
                  onCredentialRef
                    .current;

                if (
                  typeof handler !==
                  "function"
                ) {
                  console.error(
                    "[ChapsSms Google] Credential handler is missing."
                  );

                  return;
                }

                Promise.resolve(
                  handler(
                    credential,
                    response
                  )
                ).catch(
                  (
                    callbackError
                  ) => {
                    console.error(
                      "[ChapsSms Google] Authentication callback failed:",
                      callbackError
                    );
                  }
                );
              },

            ux_mode:
              "popup",

            auto_select:
              false,

            /*
             * Do not use FedCM button UX for now.
             * This avoids the AbortError/NetworkError path
             * shown in your browser console.
             */
            use_fedcm_for_button:
              false,
          });

          window
            .__chapsSmsGoogleInitializationKey =
            initializationKey;
        }

        /*
         * Wait one frame so the login card has its final width.
         */
        await waitForLayout();

        if (
          cancelled ||
          !buttonContainerRef
            .current
        ) {
          return;
        }

        const currentTarget =
          buttonContainerRef
            .current;

        currentTarget.innerHTML =
          "";

        googleId.renderButton(
          currentTarget,
          {
            type: "standard",
            theme: "outline",
            size: "large",
            text:
              normalizeButtonText(
                text
              ),
            shape:
              "rectangular",
            logo_alignment:
              "left",
            width:
              getButtonWidth(
                currentTarget
              ),
          }
        );

        /*
         * IMPORTANT:
         *
         * Do NOT attach a ResizeObserver that clears and
         * recreates Google's iframe. Replacing the iframe
         * while Google is starting authentication can abort
         * the browser's credential request.
         *
         * Render the Google iframe once and leave it alone.
         */
        setReady(true);
      } catch (setupError) {
        if (cancelled) {
          return;
        }

        console.error(
          "[ChapsSms Google] Setup failed:",
          setupError
        );

        setReady(false);

        setError(
          setupError?.message ||
            "Google sign-in could not be loaded. Please refresh and try again."
        );
      }
    }

    setup();

    return () => {
      cancelled = true;
    };
  }, [text]);

  return (
    <div className={className}>
      <div
        className={`relative w-full overflow-hidden rounded-md ${
          disabled
            ? "pointer-events-none opacity-60"
            : ""
        }`}
        aria-disabled={
          disabled
            ? "true"
            : "false"
        }
      >
        {!ready && !error ? (
          <div className="flex h-11 w-full items-center justify-center rounded-md border border-[var(--border)] bg-[var(--background)] px-4 text-sm font-semibold text-[var(--muted-foreground)]">
            Loading Google
            sign-in...
          </div>
        ) : null}

        <div
          ref={
            buttonContainerRef
          }
          className={
            ready
              ? "flex min-h-11 w-full justify-center"
              : "hidden"
          }
        />
      </div>

      {error ? (
        <p
          className="mt-2 text-center text-xs font-medium text-red-600"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}