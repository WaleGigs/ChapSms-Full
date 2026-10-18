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
import { settingsService } from "@/services/settingsService";

const defaultSettings = {
  platformName: "ChapsSmS",
  supportEmail: "",
  orderTimeoutMinutes: "20",
  minimumWalletFunding: "1000",
  registrationEnabled: true,
  emailVerificationRequired: true,
  maintenanceMode: false,
  orderNotificationsEnabled: true,
};

const defaultLimits = {
  orderTimeoutMinutes: { min: 5, max: 20 },
  minimumWalletFunding: { min: 100 },
};

// Number inputs edit strings; the API stores numbers.
function toFormSettings(settings = {}) {
  const merged = { ...defaultSettings, ...settings };

  return {
    ...merged,
    orderTimeoutMinutes: String(merged.orderTimeoutMinutes),
    minimumWalletFunding: String(merged.minimumWalletFunding),
  };
}

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
  const [limits, setLimits] = useState(defaultLimits);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);

  function applyResponse(response) {
    const nextSettings = toFormSettings(response?.settings);

    setSettings(nextSettings);
    setSavedSettings(nextSettings);
    setLimits({ ...defaultLimits, ...(response?.limits || {}) });
  }

  function fetchSettings() {
    return settingsService
      .getAdminSettings()
      .then(applyResponse)
      .catch((error) => {
        setLoadError(error?.message || "Unable to load platform settings");
      })
      .finally(() => setLoading(false));
  }

  function loadSettings() {
    setLoading(true);
    setLoadError("");
    fetchSettings();
  }

  useEffect(() => {
    fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const timeoutLimits = limits.orderTimeoutMinutes;
    const fundingMin = limits.minimumWalletFunding.min;

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

    if (
      !Number.isInteger(orderTimeout) ||
      orderTimeout < timeoutLimits.min ||
      orderTimeout > timeoutLimits.max
    ) {
      toast.error(
        `Order timeout must be between ${timeoutLimits.min} and ${timeoutLimits.max} minutes`
      );
      return;
    }

    if (!Number.isFinite(minimumFunding) || minimumFunding < fundingMin) {
      toast.error(`Minimum wallet funding must be at least ${fundingMin}`);
      return;
    }

    if (
      settings.maintenanceMode &&
      !savedSettings.maintenanceMode &&
      !window.confirm(
        "Turn on maintenance mode? Customers will not be able to sign in, order or fund their wallet until you turn it off. Admins keep access."
      )
    ) {
      return;
    }

    try {
      setSaving(true);

      const response = await settingsService.updateAdminSettings({
        platformName,
        supportEmail,
        orderTimeoutMinutes: orderTimeout,
        minimumWalletFunding: minimumFunding,
        registrationEnabled: settings.registrationEnabled,
        emailVerificationRequired: settings.emailVerificationRequired,
        maintenanceMode: settings.maintenanceMode,
        orderNotificationsEnabled: settings.orderNotificationsEnabled,
      });

      applyResponse(response);
      toast.success(response?.message || "Settings saved successfully");
    } catch (error) {
      toast.error(error?.message || "Unable to save settings");
    } finally {
      setSaving(false);
    }
  }

  // Fills the form with defaults; nothing changes until Save is pressed.
  function handleReset() {
    setSettings(defaultSettings);
    toast.success("Defaults filled in. Save to apply them.");
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

  if (loadError) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-[var(--muted-foreground)]">{loadError}</p>
          <Button type="button" onClick={loadSettings} className="mt-4">
            <RefreshCcw size={17} />
            Try again
          </Button>
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
                Platform identity used in emails and on the support page.
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
                Minimum wallet funding (NGN)
              </span>

              <input
                name="minimumWalletFunding"
                type="number"
                min={limits.minimumWalletFunding.min}
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
              description="Permit new users to create ChapsSmS accounts, including with Google."
              icon={UserPlus}
            />

            <Toggle
              checked={settings.emailVerificationRequired}
              onChange={(value) =>
                updateToggle("emailVerificationRequired", value)
              }
              label="Require email verification"
              description="Users must verify their email before they can sign in. When off, new accounts can sign in right away."
              icon={ShieldCheck}
            />

            <Toggle
              checked={settings.orderNotificationsEnabled}
              onChange={(value) =>
                updateToggle("orderNotificationsEnabled", value)
              }
              label="Order notifications"
              description="Show customers alerts when an OTP arrives or an order expires."
              icon={Bell}
            />

            <Toggle
              checked={settings.maintenanceMode}
              onChange={(value) =>
                updateToggle("maintenanceMode", value)
              }
              label="Maintenance mode"
              description="Block customer sign-in, orders and funding. Admins keep access."
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
                How long a number waits for an OTP before it is cancelled
                and refunded. Applies to new orders.
              </p>
            </div>
          </div>

          <label className="block max-w-md space-y-2">
            <span className="block text-sm font-semibold text-[var(--foreground)]">
              Order timeout in minutes ({limits.orderTimeoutMinutes.min}–
              {limits.orderTimeoutMinutes.max})
            </span>

            <input
              name="orderTimeoutMinutes"
              type="number"
              min={limits.orderTimeoutMinutes.min}
              max={limits.orderTimeoutMinutes.max}
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
