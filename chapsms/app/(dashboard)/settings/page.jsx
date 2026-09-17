"use client";

import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  Mail,
  ShieldCheck,
  User,
} from "lucide-react";

import Button from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";

export default function SettingsPage() {
  const { user } = useAuth();
  const [showPasswords, setShowPasswords] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const displayName = useMemo(() => {
    const fullName = [user?.firstName, user?.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();
    return user?.username || fullName || "ChapsSmS User";
  }, [user]);

  const initials = useMemo(
    () => String(displayName).slice(0, 2).toUpperCase() || "CU",
    [displayName],
  );

  const email = user?.email || "No email available";
  const apiKey = user?.apiKey || "";
  const displayedApiKey = !apiKey
    ? "No API key generated"
    : showApiKey
      ? apiKey
      : `${apiKey.slice(0, 4)}${"•".repeat(20)}${apiKey.slice(-4)}`;

  function handlePasswordChange(event) {
    const { name, value } = event.target;
    setPasswords((current) => ({ ...current, [name]: value }));
  }

  async function copyText(value, message) {
    if (!value) {
      toast.error("Nothing to copy");
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      toast.success(message);
    } catch {
      toast.error("Could not copy");
    }
  }

  async function handlePasswordUpdate(event) {
    event.preventDefault();

    const { currentPassword, newPassword, confirmPassword } = passwords;

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Complete all password fields");
      return;
    }

    if (newPassword.length < 6 || newPassword.length > 64) {
      toast.error("New password must contain 6–64 characters");
      return;
    }

    if (/\s/.test(newPassword)) {
      toast.error("New password must not contain spaces");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    try {
      setUpdatingPassword(true);
      const response = await api("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      toast.success(response?.message || "Password updated successfully");
      setPasswords({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error) {
      toast.error(error?.message || "Unable to update password");
    } finally {
      setUpdatingPassword(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-7">
        <h1 className="text-3xl font-black tracking-tight text-[var(--foreground)]">
          <span className="text-blue-600">Settings</span>
        </h1>
        <p className="mt-2 text-sm text-[var(--muted-foreground)] sm:text-base">
          Manage your profile, password and integration key.
        </p>
      </div>

      <div className="space-y-5">
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm sm:p-7">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white">
              <User size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black text-[var(--foreground)]">Profile</h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">Your ChapsSmS account identity.</p>
            </div>
          </div>

          <div className="mt-6 flex min-w-0 items-center gap-3 rounded-2xl bg-[var(--muted)] p-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-sm font-black text-white">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-black text-[var(--foreground)]">{displayName}</p>
              <p className="truncate text-sm text-[var(--muted-foreground)]">{email}</p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm sm:p-7">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white">
              <Mail size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black text-[var(--foreground)]">Email address</h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">Used for sign-in and account notifications.</p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <div className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--muted)] px-4 py-3">
              <span className="truncate text-sm font-semibold text-[var(--foreground)]">{email}</span>
              {user?.isVerified ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-bold text-green-700 dark:bg-green-950/40 dark:text-green-300">
                  <Check size={13} /> Verified
                </span>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => copyText(user?.email, "Email copied")}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-4 text-sm font-bold text-[var(--foreground)] transition hover:bg-[var(--muted)]"
            >
              <Copy size={16} /> Copy
            </button>
          </div>
        </section>

        <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm sm:p-7">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white">
              <LockKeyhole size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black text-[var(--foreground)]">Password</h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">Use 6–64 characters with no spaces.</p>
            </div>
          </div>

          <form onSubmit={handlePasswordUpdate} className="mt-6 space-y-4">
            {[
              { name: "currentPassword", label: "Current password" },
              { name: "newPassword", label: "New password" },
              { name: "confirmPassword", label: "Confirm new password" },
            ].map((field) => (
              <div key={field.name}>
                <label htmlFor={field.name} className="mb-2 block text-sm font-bold text-[var(--foreground)]">
                  {field.label}
                </label>
                <div className="relative">
                  <LockKeyhole size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
                  <input
                    id={field.name}
                    name={field.name}
                    type={showPasswords ? "text" : "password"}
                    value={passwords[field.name]}
                    onChange={handlePasswordChange}
                    minLength={field.name === "currentPassword" ? undefined : 6}
                    maxLength={64}
                    className="h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] pl-11 pr-12 text-sm font-semibold text-[var(--foreground)] outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords((current) => !current)}
                    aria-label={showPasswords ? "Hide passwords" : "Show passwords"}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] transition hover:text-[var(--foreground)]"
                  >
                    {showPasswords ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>
            ))}

            <div className="flex justify-end">
              <Button type="submit" disabled={updatingPassword}>
                <LockKeyhole size={17} />
                {updatingPassword ? "Updating..." : "Update password"}
              </Button>
            </div>
          </form>
        </section>

        <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm sm:p-7">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white">
              <KeyRound size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black text-[var(--foreground)]">API key</h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">Keep this key private.</p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <div className="min-w-0 flex-1 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--muted)] px-4 py-3 font-mono text-sm font-bold text-[var(--foreground)]">
              {displayedApiKey}
            </div>
            <button
              type="button"
              disabled={!apiKey}
              onClick={() => setShowApiKey((current) => !current)}
              className="h-12 rounded-xl border border-[var(--border)] px-4 text-sm font-bold text-[var(--foreground)] transition hover:bg-[var(--muted)] disabled:opacity-50"
            >
              {showApiKey ? "Hide" : "Show"}
            </button>
            <button
              type="button"
              disabled={!apiKey}
              onClick={() => copyText(apiKey, "API key copied")}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              <Copy size={16} /> Copy
            </button>
          </div>
        </section>

        <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm sm:p-7">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h2 className="text-xl font-black text-[var(--foreground)]">Two-factor authentication</h2>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">This feature will be connected later.</p>
              </div>
            </div>
            <span className="inline-flex w-fit rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              Not connected
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}
