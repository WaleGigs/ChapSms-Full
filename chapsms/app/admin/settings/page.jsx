"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Clock3,
  Mail,
  RefreshCcw,
  Save,
  Settings2,
  ShieldCheck,
  UserPlus,
  Wrench,
} from "lucide-react";
import toast from "react-hot-toast";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

const STORAGE_KEY = "chapsms-admin-settings";

const defaultSettings = {
  platformName: "ChapsSmS",
  supportEmail: "",
  defaultCurrency: "NGN",
  orderTimeoutMinutes: "20",
  minimumWalletFunding: "1000",
  registrationEnabled: true,
  emailVerificationRequired: true,
  maintenanceMode: false,
  orderNotificationsEnabled: true,
};

function Toggle({ checked, onChange, label, description, icon: Icon }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4">
      <span className="flex min-w-0 gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
          <Icon size={18} />
        </span>

        <span className="min-w-0">
          <span className="block font-bold text-[var(--foreground)]">
            {label}
          </span>

          <span className="mt-1 block text-sm leading-6 text-[var(--muted-foreground)]">
            {description}
          </span>
        </span>
      </span>

      <span className="relative mt-1 inline-flex shrink-0 items-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="peer sr-only"
        />

        <span className="h-6 w-11 rounded-full bg-slate-300 transition peer-checked:bg-blue-600 dark:bg-slate-700" />

        <span className="absolute left-1 h-4 w-4 rounded-full bg-white shadow-sm transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState(defaultSettings);
  const [savedSettings, setSavedSettings] = useState(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);

      if (stored) {
        const parsed = JSON.parse(stored);
        const nextSettings = {
          ...defaultSettings,
          ...parsed,
        };

        setSettings(nextSettings);
        setSavedSettings(nextSettings);
      }
    } catch {
      toast.error("Unable to load saved settings");
    } finally {
      setLoading(false);
    }
  }, []);

  const hasChanges = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(savedSettings),
    [settings, savedSettings]
  );

  function updateField(event) {
    const { name, value } = event.target;

    setSettings((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function updateToggle(name, value) {
    setSettings((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSave(event) {
    event.preventDefault();

    const platformName = settings.platformName.trim();
    const supportEmail = settings.supportEmail.trim().toLowerCase();
    const orderTimeout = Number(settings.orderTimeoutMinutes);
    const minimumFunding = Number(settings.minimumWalletFunding);

    if (!platformName) {
      toast.error("Platform name is required");
      return;
    }

    if (
      supportEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail)
    ) {
      toast.error("Enter a valid support email address");
      return;
    }

    if (!Number.isFinite(orderTimeout) || orderTimeout < 1) {
      toast.error("Order timeout must be at least 1 minute");
      return;
    }

    if (!Number.isFinite(minimumFunding) || minimumFunding < 0) {
      toast.error("Minimum wallet funding cannot be negative");
      return;
    }

    try {
      setSaving(true);

      const nextSettings = {
        ...settings,
        platformName,
        supportEmail,
        orderTimeoutMinutes: String(orderTimeout),
        minimumWalletFunding: String(minimumFunding),
      };

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(nextSettings)
      );

      setSettings(nextSettings);
      setSavedSettings(nextSettings);

      toast.success("Settings saved successfully");
    } catch {
      toast.error("Unable to save settings");
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    localStorage.removeItem(STORAGE_KEY);
    setSettings(defaultSettings);
    setSavedSettings(defaultSettings);
    toast.success("Settings restored to defaults");
  }

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="mt-4 text-sm text-[var(--muted-foreground)]">
            Loading settings...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">
          Administration
        </p>

        <h1 className="mt-2 text-3xl font-black tracking-tight text-[var(--foreground)] sm:text-4xl">
          Platform settings
        </h1>

        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)] sm:text-base">
          Configure platform details, account rules, order behavior, and
          maintenance controls.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <Card className="rounded-3xl p-5 sm:p-6">
          <div className="mb-6 flex items-start gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              <Settings2 size={21} />
            </span>

            <div>
              <h2 className="text-xl font-black text-[var(--foreground)]">
                General settings
              </h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                Basic platform identity and currency preferences.
              </p>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <label className="space-y-2">
              <span className="block text-sm font-semibold text-[var(--foreground)]">
                Platform name
              </span>

              <input
                name="platformName"
                value={settings.platformName}
                onChange={updateField}
                maxLength={60}
                className="h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 text-sm text-[var(--foreground)] outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10"
              />
            </label>

            <label className="space-y-2">
              <span className="block text-sm font-semibold text-[var(--foreground)]">
                Support email
              </span>

              <div className="relative">
                <Mail
                  size={18}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
                />

                <input
                  name="supportEmail"
                  type="email"
                  value={settings.supportEmail}
                  onChange={updateField}
                  placeholder="support@example.com"
                  className="h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] pl-11 pr-4 text-sm text-[var(--foreground)] outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10"
                />
              </div>
            </label>

            <label className="space-y-2">
              <span className="block text-sm font-semibold text-[var(--foreground)]">
                Default currency
              </span>

              <select
                name="defaultCurrency"
                value={settings.defaultCurrency}
                onChange={updateField}
                className="h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 text-sm text-[var(--foreground)] outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10"
              >
                <option value="NGN">Nigerian Naira (NGN)</option>
                <option value="USD">US Dollar (USD)</option>
                <option value="GBP">British Pound (GBP)</option>
                <option value="EUR">Euro (EUR)</option>
              </select>
            </label>

            <label className="space-y-2">
              <span className="block text-sm font-semibold text-[var(--foreground)]">
                Minimum wallet funding
              </span>

              <input
                name="minimumWalletFunding"
                type="number"
                min="0"
                step="1"
                value={settings.minimumWalletFunding}
                onChange={updateField}
                className="h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 text-sm text-[var(--foreground)] outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10"
              />
            </label>
          </div>
        </Card>

        <Card className="rounded-3xl p-5 sm:p-6">
          <div className="mb-6 flex items-start gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              <ShieldCheck size={21} />
            </span>

            <div>
              <h2 className="text-xl font-black text-[var(--foreground)]">
                Account and security
              </h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                Control registration and account verification.
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Toggle
              checked={settings.registrationEnabled}
              onChange={(value) =>
                updateToggle("registrationEnabled", value)
              }
              label="Allow user registration"
              description="Permit new users to create ChapsSmS accounts."
              icon={UserPlus}
            />

            <Toggle
              checked={settings.emailVerificationRequired}
              onChange={(value) =>
                updateToggle("emailVerificationRequired", value)
              }
              label="Require email verification"
              description="Users must verify their email before they can sign in."
              icon={ShieldCheck}
            />

            <Toggle
              checked={settings.orderNotificationsEnabled}
              onChange={(value) =>
                updateToggle("orderNotificationsEnabled", value)
              }
              label="Order notifications"
              description="Enable platform notifications for order status changes."
              icon={Bell}
            />

            <Toggle
              checked={settings.maintenanceMode}
              onChange={(value) =>
                updateToggle("maintenanceMode", value)
              }
              label="Maintenance mode"
              description="Temporarily restrict customer access while maintenance is active."
              icon={Wrench}
            />
          </div>
        </Card>

        <Card className="rounded-3xl p-5 sm:p-6">
          <div className="mb-6 flex items-start gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              <Clock3 size={21} />
            </span>

            <div>
              <h2 className="text-xl font-black text-[var(--foreground)]">
                Order settings
              </h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                Configure how long pending OTP orders remain active.
              </p>
            </div>
          </div>

          <label className="block max-w-md space-y-2">
            <span className="block text-sm font-semibold text-[var(--foreground)]">
              Order timeout in minutes
            </span>

            <input
              name="orderTimeoutMinutes"
              type="number"
              min="1"
              step="1"
              value={settings.orderTimeoutMinutes}
              onChange={updateField}
              className="h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 text-sm text-[var(--foreground)] outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10"
            />
          </label>
        </Card>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={handleReset}
            className="w-full sm:w-auto"
          >
            <RefreshCcw size={17} />
            Restore defaults
          </Button>

          <Button
            type="submit"
            disabled={!hasChanges || saving}
            className="w-full sm:w-auto"
          >
            <Save size={17} />
            {saving ? "Saving..." : "Save settings"}
          </Button>
        </div>
      </form>
    </div>
  );
}