"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import Link from "next/link";

import {
  Mail,
} from "lucide-react";

import toast from "react-hot-toast";

import {
  useAuth,
} from "@/context/AuthContext";

import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import PasswordField from "@/components/auth/PasswordField";
import GoogleAuthButton from "@/components/auth/GoogleAuthButton";

import {
  normalizeEmail,
  validateLoginField,
  validateLoginForm,
} from "@/lib/formValidation";

function getSafeNextPath(value) {
  const path =
    String(value || "").trim();

  if (
    !path.startsWith("/") ||
    path.startsWith("//")
  ) {
    return "";
  }

  return path;
}

function getRequestedPath() {
  if (
    typeof window ===
    "undefined"
  ) {
    return "";
  }

  return getSafeNextPath(
    new URLSearchParams(
      window.location.search
    ).get("next")
  );
}

function getDestination(user) {
  if (user?.role === "admin") {
    return "/admin";
  }

  /*
   * Normal customers should land on the dashboard.
   * A safe ?next=/... value still takes priority when present.
   */
  return (
    getRequestedPath() ||
    "/dashboard"
  );
}

export default function LoginPage() {
  const router = useRouter();

  const {
    login,
    googleLogin,
  } = useAuth();

  const [form, setForm] =
    useState({
      email: "",
      password: "",
      rememberMe: true,
    });

  const [touched, setTouched] =
    useState({});

  const [errors, setErrors] =
    useState({});

  const [
    submitError,
    setSubmitError,
  ] = useState("");

  const [loading, setLoading] =
    useState(false);

  const [
    googleLoading,
    setGoogleLoading,
  ] = useState(false);

  useEffect(() => {
    router.prefetch("/dashboard");
    router.prefetch("/admin");
  }, [router]);

  const currentErrors =
    useMemo(
      () =>
        validateLoginForm(form),
      [form]
    );

  const canSubmit =
    Object.keys(
      currentErrors
    ).length === 0 &&
    !loading &&
    !googleLoading;

  function updateField(event) {
    const {
      name,
      value,
      type,
      checked,
    } = event.target;

    const nextValue =
      type === "checkbox"
        ? checked
        : value;

    setForm((current) => ({
      ...current,
      [name]: nextValue,
    }));

    setSubmitError("");

    if (touched[name]) {
      const message =
        validateLoginField(
          name,
          nextValue
        );

      setErrors((current) => ({
        ...current,
        [name]: message,
      }));
    }
  }

  function handleBlur(event) {
    const {
      name,
      value,
    } = event.target;

    const message =
      validateLoginField(
        name,
        value
      );

    setTouched((current) => ({
      ...current,
      [name]: true,
    }));

    setErrors((current) => ({
      ...current,
      [name]: message,
    }));
  }

  function completeLogin(
    response
  ) {
    toast.success(
      response?.message ||
        "Login successful"
    );

    router.replace(
      getDestination(
        response?.user
      )
    );
  }

  async function handleSubmit(
    event
  ) {
    event.preventDefault();

    if (
      loading ||
      googleLoading
    ) {
      return;
    }

    const validationErrors =
      validateLoginForm(form);

    setTouched({
      email: true,
      password: true,
    });

    setErrors(
      validationErrors
    );

    setSubmitError("");

    if (
      Object.keys(
        validationErrors
      ).length > 0
    ) {
      return;
    }

    const email =
      normalizeEmail(
        form.email
      );

    try {
      setLoading(true);

      const response =
        await login({
          email,
          password:
            form.password,
          rememberMe:
            form.rememberMe,
        });

      completeLogin(response);
    } catch (error) {
      const message =
        error?.message ||
        "Login failed. Please try again.";

      const errorCode =
        error?.code ||
        error?.data?.code;

      if (
        errorCode ===
        "EMAIL_NOT_VERIFIED"
      ) {
        toast.error(message);

        router.push(
          `/verify-email?email=${encodeURIComponent(
            email
          )}`
        );

        return;
      }

      setSubmitError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle(
    credential
  ) {
    if (
      loading ||
      googleLoading
    ) {
      return;
    }

    try {
      setGoogleLoading(true);
      setSubmitError("");

      const response =
        await googleLogin(
          credential,
          {
            rememberMe:
              form.rememberMe,
          }
        );

      completeLogin(response);
    } catch (error) {
      const message =
        error?.message ||
        "Google login failed. Please try again.";

      setSubmitError(message);
      toast.error(message);
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <Card className="rounded-[26px] p-5 shadow-xl sm:p-8">
      <div className="mb-7 sm:mb-8">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">
          Account access
        </p>

        <h1 className="mt-3 text-3xl font-black tracking-tight text-[var(--foreground)] sm:text-4xl">
          Welcome back
        </h1>

        <p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)] sm:text-base">
          Login to manage your wallet, orders, numbers, accounts and VPNs.
        </p>
      </div>

      {submitError ? (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        >
          {submitError}
        </div>
      ) : null}

      <GoogleAuthButton
        onCredential={
          handleGoogle
        }
        disabled={
          loading ||
          googleLoading
        }
        text="continue_with"
      />

      <div className="my-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-[var(--border)]" />

        <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
          or use email
        </span>

        <span className="h-px flex-1 bg-[var(--border)]" />
      </div>

      <form
        onSubmit={
          handleSubmit
        }
        className="space-y-5"
        noValidate
      >
        <Input
          label="Email address"
          name="email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={254}
          value={form.email}
          onChange={
            updateField
          }
          onBlur={
            handleBlur
          }
          error={
            touched.email
              ? errors.email
              : ""
          }
          leftIcon={Mail}
          required
        />

        <PasswordField
          label="Password"
          name="password"
          placeholder="Enter your password"
          autoComplete="current-password"
          value={
            form.password
          }
          onChange={
            updateField
          }
          onBlur={
            handleBlur
          }
          error={
            touched.password
              ? errors.password
              : ""
          }
          required
        />

        <div className="flex flex-col gap-3 text-sm min-[380px]:flex-row min-[380px]:items-center min-[380px]:justify-between">
          <label className="flex cursor-pointer items-center gap-2.5 text-[var(--muted-foreground)]">
            <input
              name="rememberMe"
              type="checkbox"
              checked={
                form.rememberMe
              }
              onChange={
                updateField
              }
              className="h-4 w-4 rounded border-[var(--input)] accent-blue-600"
            />

            Remember me
          </label>

          <Link
            href="/forgot-password"
            className="focus-ring w-fit rounded-md font-bold text-blue-600 hover:text-blue-700"
          >
            Forgot password?
          </Link>
        </div>

        <Button
          type="submit"
          className="w-full"
          size="lg"
          disabled={
            !canSubmit
          }
          aria-busy={
            loading
          }
        >
          {loading
            ? "Logging in..."
            : "Login"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--muted-foreground)]">
        Don&apos;t have an account?{" "}

        <Link
          href="/signup"
          className="focus-ring rounded-md font-bold text-blue-600 hover:text-blue-700"
        >
          Create account
        </Link>
      </p>
    </Card>
  );
}
