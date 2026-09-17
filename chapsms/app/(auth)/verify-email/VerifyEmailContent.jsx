"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  useRouter,
  useSearchParams,
} from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2,
  Clock3,
  LoaderCircle,
  Mail,
  RotateCw,
  ShieldCheck,
} from "lucide-react";
import toast from "react-hot-toast";

import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import {
  authService,
} from "@/services/auth.service";
import {
  trackCompleteRegistration,
} from "@/lib/tiktokEvents";

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function storageKey(email) {
  return `chapsms-verification:${email}`;
}

function parseDate(value) {
  const date =
    value
      ? new Date(value)
      : null;

  if (
    !date ||
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return date;
}

function secondsUntil(
  value,
  now
) {
  const date =
    parseDate(value);

  if (!date) {
    return 0;
  }

  return Math.max(
    0,
    Math.ceil(
      (date.getTime() -
        now) /
        1000
    )
  );
}

function formatCountdown(
  totalSeconds
) {
  const seconds =
    Math.max(
      0,
      Number(
        totalSeconds || 0
      )
    );

  const minutes =
    Math.floor(
      seconds / 60
    );

  const remainder =
    seconds % 60;

  return `${String(
    minutes
  ).padStart(2, "0")}:${String(
    remainder
  ).padStart(2, "0")}`;
}

function getTimingFromStorage(
  email
) {
  if (
    typeof window ===
      "undefined" ||
    !email
  ) {
    return null;
  }

  try {
    const saved =
      JSON.parse(
        window.sessionStorage.getItem(
          storageKey(email)
        ) || "null"
      );

    if (!saved) {
      return null;
    }

    return {
      expiresAt:
        saved.expiresAt ||
        saved
          .verificationExpiresAt ||
        null,
      resendAvailableAt:
        saved.resendAvailableAt ||
        null,
    };
  } catch {
    return null;
  }
}

function saveTiming(
  email,
  response
) {
  if (
    typeof window ===
      "undefined" ||
    !email
  ) {
    return;
  }

  const value = {
    expiresAt:
      response
        ?.verificationExpiresAt ||
      response?.expiresAt ||
      null,
    resendAvailableAt:
      response
        ?.resendAvailableAt ||
      null,
  };

  window.sessionStorage.setItem(
    storageKey(email),
    JSON.stringify(value)
  );

  return value;
}

export default function VerifyEmailContent() {
  const router =
    useRouter();

  const searchParams =
    useSearchParams();

  const initialEmail =
    normalizeEmail(
      searchParams.get(
        "email"
      )
    );

  const deliveryFailed =
    searchParams.get(
      "delivery"
    ) === "failed";

  const [email, setEmail] =
    useState(initialEmail);

  const [code, setCode] =
    useState("");

  const [timing, setTiming] =
    useState({
      expiresAt: null,
      resendAvailableAt:
        null,
    });

  const [now, setNow] =
    useState(Date.now());

  const [
    verifying,
    setVerifying,
  ] = useState(false);

  const [
    resending,
    setResending,
  ] = useState(false);

  const [error, setError] =
    useState(
      deliveryFailed
        ? "Your account exists, but the first verification email could not be delivered. Use Resend Code when the timer reaches zero."
        : ""
    );

  useEffect(() => {
    const stored =
      getTimingFromStorage(
        initialEmail
      );

    if (stored) {
      setTiming(stored);
    }
  }, [initialEmail]);

  useEffect(() => {
    const interval =
      window.setInterval(
        () =>
          setNow(
            Date.now()
          ),
        1000
      );

    return () =>
      window.clearInterval(
        interval
      );
  }, []);

  const normalizedEmail =
    normalizeEmail(email);

  const codeExpiresIn =
    useMemo(
      () =>
        secondsUntil(
          timing.expiresAt,
          now
        ),
      [
        timing.expiresAt,
        now,
      ]
    );

  const resendAvailableIn =
    useMemo(
      () =>
        secondsUntil(
          timing
            .resendAvailableAt,
          now
        ),
      [
        timing
          .resendAvailableAt,
        now,
      ]
    );

  const codeLooksValid =
    /^\d{6}$/.test(code);

  async function handleVerify(
    event
  ) {
    event.preventDefault();

    if (verifying) {
      return;
    }

    if (!normalizedEmail) {
      setError(
        "Enter your email address"
      );
      return;
    }

    if (!codeLooksValid) {
      setError(
        "Enter the six-digit verification code"
      );
      return;
    }

    try {
      setVerifying(true);
      setError("");

      const response =
        await authService
          .verifyEmail({
            email:
              normalizedEmail,
            code,
          });

      if (
        typeof window !==
        "undefined"
      ) {
        window.sessionStorage
          .removeItem(
            storageKey(
              normalizedEmail
            )
          );
      }

      /*
       * TikTok conversion tracking:
       * Fire CompleteRegistration only AFTER the backend has confirmed
       * that the six-digit email verification code is valid.
       *
       * Do not fire this on the signup form itself, because users who
       * never verify their email should not be counted as completed
       * registrations.
       */
      trackCompleteRegistration();

      toast.success(
        response?.message ||
          "Email verified successfully"
      );

      router.replace(
        "/login"
      );
    } catch (requestError) {
      const message =
        requestError?.message ||
        "Email verification failed";

      setError(message);
      toast.error(message);
    } finally {
      setVerifying(false);
    }
  }

  async function handleResend() {
    if (
      resending ||
      resendAvailableIn > 0
    ) {
      return;
    }

    if (!normalizedEmail) {
      setError(
        "Enter your email address"
      );
      return;
    }

    try {
      setResending(true);
      setError("");

      const response =
        await authService
          .resendVerification(
            normalizedEmail
          );

      const nextTiming =
        saveTiming(
          normalizedEmail,
          response
        );

      setTiming(
        nextTiming || {
          expiresAt:
            new Date(
              Date.now() +
                10 *
                  60 *
                  1000
            ).toISOString(),
          resendAvailableAt:
            new Date(
              Date.now() +
                60 *
                  1000
            ).toISOString(),
        }
      );

      setCode("");

      toast.success(
        response?.message ||
          "A new code was sent"
      );
    } catch (requestError) {
      const data =
        requestError?.data ||
        {};

      if (
        data.resendAvailableAt
      ) {
        const nextTiming = {
          expiresAt:
            data
              .verificationExpiresAt ||
            timing.expiresAt,
          resendAvailableAt:
            data
              .resendAvailableAt,
        };

        setTiming(
          nextTiming
        );

        saveTiming(
          normalizedEmail,
          nextTiming
        );
      }

      const message =
        requestError?.message ||
        "Could not resend the verification code";

      setError(message);
      toast.error(message);
    } finally {
      setResending(false);
    }
  }

  return (
    <Card className="rounded-[26px] p-5 shadow-xl sm:p-8">
      <div className="mb-7 sm:mb-8">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
          <ShieldCheck
            size={24}
          />
        </span>

        <p className="mt-5 text-xs font-black uppercase tracking-[0.18em] text-blue-600">
          Email verification
        </p>

        <h1 className="mt-3 text-3xl font-black tracking-tight text-[var(--foreground)] sm:text-4xl">
          Enter your verification code
        </h1>

        <p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)] sm:text-base">
          We send a six-digit code
          to your email. Each code
          remains valid for 10
          minutes.
        </p>
      </div>

      {error ? (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        >
          {error}
        </div>
      ) : null}

      <form
        onSubmit={
          handleVerify
        }
        className="space-y-5"
      >
        <Input
          label="Email address"
          name="email"
          type="email"
          value={email}
          onChange={(event) => {
            setEmail(
              event.target.value
            );
            setError("");
          }}
          placeholder="you@example.com"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          leftIcon={Mail}
          required
        />

        <div>
          <label
            htmlFor="verification-code"
            className="mb-2 block text-sm font-bold text-[var(--foreground)]"
          >
            Verification code
          </label>

          <input
            id="verification-code"
            name="code"
            type="text"
            value={code}
            onChange={(event) => {
              setCode(
                event.target.value
                  .replace(
                    /\D/g,
                    ""
                  )
                  .slice(0, 6)
              );
              setError("");
            }}
            placeholder="000000"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            className="focus-ring min-h-14 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 text-center text-2xl font-black tracking-[0.35em] text-[var(--foreground)] outline-none transition focus:border-blue-500"
            required
          />
        </div>

        <div className="grid gap-3 min-[420px]:grid-cols-2">
          <div className="rounded-2xl bg-[var(--muted)] p-4">
            <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
              <Clock3 size={16} />
              <span className="text-xs font-bold uppercase tracking-[0.12em]">
                Code expires
              </span>
            </div>

            <p
              className={`mt-2 text-xl font-black ${
                timing.expiresAt &&
                codeExpiresIn === 0
                  ? "text-red-600"
                  : "text-[var(--foreground)]"
              }`}
            >
              {timing.expiresAt
                ? formatCountdown(
                    codeExpiresIn
                  )
                : "10:00"}
            </p>
          </div>

          <div className="rounded-2xl bg-[var(--muted)] p-4">
            <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
              <RotateCw size={16} />
              <span className="text-xs font-bold uppercase tracking-[0.12em]">
                Resend available
              </span>
            </div>

            <p className="mt-2 text-xl font-black text-[var(--foreground)]">
              {formatCountdown(
                resendAvailableIn
              )}
            </p>
          </div>
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={
            verifying ||
            resending ||
            !normalizedEmail ||
            !codeLooksValid
          }
          aria-busy={
            verifying
          }
        >
          {verifying ? (
            <>
              <LoaderCircle
                className="animate-spin"
                size={18}
              />
              Verifying...
            </>
          ) : (
            <>
              <CheckCircle2
                size={18}
              />
              Verify email
            </>
          )}
        </Button>
      </form>

      <button
        type="button"
        onClick={
          handleResend
        }
        disabled={
          resending ||
          resendAvailableIn > 0 ||
          !normalizedEmail
        }
        className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 text-sm font-bold text-[var(--foreground)] transition hover:bg-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {resending ? (
          <LoaderCircle
            className="animate-spin"
            size={17}
          />
        ) : (
          <RotateCw size={17} />
        )}

        {resendAvailableIn > 0
          ? `Resend code in ${formatCountdown(
              resendAvailableIn
            )}`
          : "Resend code"}
      </button>

      <p className="mt-6 text-center text-sm text-[var(--muted-foreground)]">
        Already verified?{" "}

        <Link
          href="/login"
          className="font-bold text-blue-600 hover:text-blue-700"
        >
          Return to login
        </Link>
      </p>
    </Card>
  );
}
