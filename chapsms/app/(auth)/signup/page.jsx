"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, UserRound } from "lucide-react";
import toast from "react-hot-toast";

import { useAuth } from "@/context/AuthContext";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import PasswordField from "@/components/auth/PasswordField";

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    String(value || "").trim()
  );
}

function validatePassword(password) {
  const value = String(password || "");

  if (!value) {
    return "Password is required";
  }

  if (value.length < 6 || value.length > 64) {
    return "Password must contain 6–64 characters";
  }

  if (/\s/.test(value)) {
    return "Password must not contain spaces";
  }

  return "";
}

export default function SignupPage() {
  const router = useRouter();
  const { signup } = useAuth();

  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    terms: false,
  });

  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [loading, setLoading] = useState(false);

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

    setErrors((current) => ({
      ...current,
      [name]: "",
      ...(name === "password"
        ? { confirmPassword: "" }
        : {}),
    }));
  }

  function validateForm() {
    const nextErrors = {};
    const username =
      form.username.trim();

    const email =
      normalizeEmail(form.email);

    if (!username) {
      nextErrors.username =
        "Username is required";
    }

    if (!email) {
      nextErrors.email =
        "Email address is required";
    } else if (
      !isValidEmail(email)
    ) {
      nextErrors.email =
        "Enter a valid email address";
    }

    const passwordError =
      validatePassword(
        form.password
      );

    if (passwordError) {
      nextErrors.password =
        passwordError;
    }

    if (!form.confirmPassword) {
      nextErrors.confirmPassword =
        "Confirm your password";
    } else if (
      form.password !==
      form.confirmPassword
    ) {
      nextErrors.confirmPassword =
        "Passwords do not match";
    }

    if (!form.terms) {
      nextErrors.terms =
        "Accept the Terms and Privacy Policy";
    }

    return nextErrors;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (loading) {
      return;
    }

    const validationErrors =
      validateForm();

    setErrors(validationErrors);
    setSubmitError("");

    if (
      Object.keys(validationErrors)
        .length > 0
    ) {
      return;
    }

    const username =
      form.username.trim();

    const email =
      normalizeEmail(form.email);

    try {
      setLoading(true);

      const response =
        await signup({
          username,
          email,
          password:
            form.password,
        });

      toast.success(
        response?.message ||
          "Account created. Check your email for the verification code."
      );

      router.push(
        `/verify-email?email=${encodeURIComponent(
          email
        )}`
      );
    } catch (error) {
      const message =
        error?.message ||
        "Unable to create your account. Please try again.";

      setSubmitError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  const passwordError =
    validatePassword(
      form.password
    );

  const passwordsDoNotMatch =
    Boolean(
      form.password &&
        form.confirmPassword
    ) &&
    form.password !==
      form.confirmPassword;

  const passwordsMatch =
    Boolean(
      form.password &&
        form.confirmPassword
    ) &&
    !passwordError &&
    form.password ===
      form.confirmPassword;

  const confirmPasswordError =
    errors.confirmPassword ||
    (passwordsDoNotMatch
      ? "Passwords do not match"
      : "");

  const canSubmit =
    Boolean(
      form.username.trim()
    ) &&
    isValidEmail(
      normalizeEmail(
        form.email
      )
    ) &&
    !passwordError &&
    !passwordsDoNotMatch &&
    Boolean(form.confirmPassword) &&
    form.terms &&
    !loading;

  return (
    <Card className="rounded-[26px] p-5 shadow-xl sm:p-8">
      <div className="mb-7 sm:mb-8">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">
          New account
        </p>

        <h1 className="mt-3 text-3xl font-black tracking-tight text-[var(--foreground)] sm:text-4xl">
          Create your ChapsSmS account
        </h1>

        <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)] sm:text-base">
          Choose a username, enter
          your email address, and
          create a password.
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

      <form
        onSubmit={handleSubmit}
        className="space-y-5"
        noValidate
      >
        <Input
          label="Username"
          name="username"
          type="text"
          placeholder="Choose a username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={50}
          value={form.username}
          onChange={updateField}
          error={errors.username}
          leftIcon={UserRound}
          required
        />

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
          onChange={updateField}
          error={errors.email}
          leftIcon={Mail}
          required
        />

        <PasswordField
          label="Password"
          name="password"
          placeholder="6–64 characters, no spaces"
          autoComplete="new-password"
          minLength={6}
          maxLength={64}
          value={form.password}
          onChange={updateField}
          error={errors.password}
          required
        />

        <PasswordField
          label="Confirm password"
          name="confirmPassword"
          placeholder="Enter the password again"
          autoComplete="new-password"
          minLength={6}
          maxLength={64}
          value={form.confirmPassword}
          onChange={updateField}
          error={
            confirmPasswordError
          }
          aria-invalid={
            passwordsDoNotMatch ||
            Boolean(
              errors.confirmPassword
            )
          }
          required
        />

        {passwordsMatch ? (
          <p
            role="status"
            className="-mt-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400"
          >
            Passwords match
          </p>
        ) : null}

        <p className="-mt-2 text-xs text-[var(--muted-foreground)]">
          Password must contain 6–64 characters and no spaces.
        </p>

        <div>
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4 text-sm text-[var(--muted-foreground)]">
            <input
              name="terms"
              type="checkbox"
              checked={form.terms}
              onChange={updateField}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-[var(--input)] accent-blue-600"
            />

            <span>
              I agree to the{" "}
              <Link
                href="/terms"
                className="font-bold text-blue-600 hover:text-blue-700"
              >
                Terms
              </Link>{" "}
              and{" "}
              <Link
                href="/privacy"
                className="font-bold text-blue-600 hover:text-blue-700"
              >
                Privacy Policy
              </Link>
              .
            </span>
          </label>

          {errors.terms ? (
            <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">
              {errors.terms}
            </p>
          ) : null}
        </div>

        <Button
          type="submit"
          className="w-full"
          size="lg"
          disabled={!canSubmit}
          aria-busy={loading}
        >
          {loading
            ? "Creating account..."
            : "Create account"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--muted-foreground)]">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-bold text-blue-600 hover:text-blue-700"
        >
          Login
        </Link>
      </p>
    </Card>
  );
}
