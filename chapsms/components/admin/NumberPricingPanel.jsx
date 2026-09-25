"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BadgeDollarSign,
  LoaderCircle,
  RefreshCw,
  Save,
} from "lucide-react";
import toast from "react-hot-toast";

import PricingRuleForm from "@/components/admin/PricingRuleForm";
import PricingRulesTable from "@/components/admin/PricingRulesTable";
import { useAdminPricingRules } from "@/hooks/useAdminPricing";
import { api } from "@/lib/api";

export default function NumberPricingPanel() {
  const [serverFilter, setServerFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [page, setPage] = useState(1);
  const [editingRule, setEditingRule] = useState(null);

  const [settingsLoading, setSettingsLoading] =
    useState(true);
  const [savingSetting, setSavingSetting] =
    useState("");
  const [exchangeRate, setExchangeRate] =
    useState("");
  const [
    defaultMinimumPrice,
    setDefaultMinimumPrice,
  ] = useState("");
  const [settingsError, setSettingsError] =
    useState("");

  const {
    rules,
    pagination,
    loading,
    error,
    reload,
  } = useAdminPricingRules({
    server: serverFilter,
    isActive: activeFilter,
    page,
    limit: 25,
  });

  const applySettingsResponse = useCallback(
    (response) => {
      const settings =
        response?.settings || {};

      if (
        Number.isFinite(
          Number(settings.exchangeRate)
        ) &&
        Number(settings.exchangeRate) > 0
      ) {
        setExchangeRate(
          String(settings.exchangeRate)
        );
      }

      if (
        Number.isFinite(
          Number(
            settings.defaultMinimumPrice
          )
        ) &&
        Number(
          settings.defaultMinimumPrice
        ) > 0
      ) {
        setDefaultMinimumPrice(
          String(
            settings.defaultMinimumPrice
          )
        );
      }
    },
    []
  );

  const loadPricingSettings =
    useCallback(async () => {
      try {
        setSettingsLoading(true);
        setSettingsError("");

        const response = await api(
          "/admin/pricing-settings"
        );

        applySettingsResponse(response);
      } catch (requestError) {
        const message =
          requestError?.message ||
          "Unable to load global pricing settings";

        setSettingsError(message);
      } finally {
        setSettingsLoading(false);
      }
    }, [applySettingsResponse]);

  useEffect(() => {
    loadPricingSettings();
  }, [loadPricingSettings]);

  useEffect(() => {
    setPage(1);
  }, [serverFilter, activeFilter]);

  async function saveGlobalSetting(type) {
    const isMinimum =
      type === "minimum";

    const rawValue = isMinimum
      ? defaultMinimumPrice
      : exchangeRate;

    const numericValue =
      Number(rawValue);

    if (
      !Number.isFinite(numericValue) ||
      numericValue <= 0
    ) {
      toast.error(
        isMinimum
          ? "Enter a valid minimum number price"
          : "Enter a valid USD to NGN rate"
      );
      return;
    }

    try {
      setSavingSetting(type);
      setSettingsError("");

      const response = await api(
        "/admin/pricing-settings",
        {
          method: "PATCH",
          body: JSON.stringify(
            isMinimum
              ? {
                  defaultMinimumPrice:
                    numericValue,
                }
              : {
                  exchangeRate:
                    numericValue,
                }
          ),
        }
      );

      applySettingsResponse(response);

      toast.success(
        isMinimum
          ? `Default minimum number price is now ₦${numericValue.toLocaleString(
              "en-NG"
            )}`
          : `USD rate is now ₦${numericValue.toLocaleString(
              "en-NG"
            )} per $1`
      );
    } catch (requestError) {
      const message =
        requestError?.message ||
        "Unable to update pricing setting";

      setSettingsError(message);
      toast.error(message);
    } finally {
      setSavingSetting("");
    }
  }

  function handleSaved() {
    setEditingRule(null);
    reload();
  }

  function handleEdit(rule) {
    setEditingRule(rule);
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">
          Server pricing
        </p>
        <div className="mt-2 flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
            <BadgeDollarSign size={22} />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-[var(--foreground)] sm:text-4xl">
              Pricing Management
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted-foreground)] sm:text-base">
              Set the price customers pay on ChapsSmS. Every preview shows the provider’s current cost, your selling price and expected profit.
            </p>
          </div>
        </div>
      </div>

      <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 border-b border-[var(--border)] pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">
              Global number settings
            </p>
            <h2 className="mt-2 text-xl font-black text-[var(--foreground)]">
              Default floor & dollar rate
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)]">
              This is the global floor for every number service. Saved country/service rules can still have a higher minimum, but they can never make a customer price lower than this global amount.
            </p>
          </div>

          <button
            type="button"
            onClick={loadPricingSettings}
            disabled={
              settingsLoading ||
              Boolean(savingSetting)
            }
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-3 text-xs font-black text-[var(--foreground)] transition hover:bg-[var(--muted)] disabled:opacity-50"
          >
            <RefreshCw
              size={15}
              className={
                settingsLoading
                  ? "animate-spin"
                  : ""
              }
            />
            Refresh settings
          </button>
        </div>

        {settingsError ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
            {settingsError}
          </div>
        ) : null}

        {settingsLoading ? (
          <div className="flex min-h-32 items-center justify-center gap-3 text-sm font-semibold text-[var(--muted-foreground)]">
            <LoaderCircle
              className="animate-spin"
              size={20}
            />
            Loading pricing settings...
          </div>
        ) : (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4">
              <label
                htmlFor="global-minimum-number-price"
                className="text-xs font-black uppercase tracking-[0.14em] text-[var(--muted-foreground)]"
              >
                Default minimum number price
              </label>

              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <div className="relative min-w-0 flex-1">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-black text-[var(--muted-foreground)]">
                    ₦
                  </span>
                  <input
                    id="global-minimum-number-price"
                    type="number"
                    min="1"
                    step="1"
                    inputMode="decimal"
                    value={
                      defaultMinimumPrice
                    }
                    onChange={(event) =>
                      setDefaultMinimumPrice(
                        event.target.value
                      )
                    }
                    className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] pl-8 pr-3 text-sm font-black text-[var(--foreground)] outline-none transition focus:border-blue-500"
                    placeholder="1000"
                  />
                </div>

                <button
                  type="button"
                  onClick={() =>
                    saveGlobalSetting(
                      "minimum"
                    )
                  }
                  disabled={
                    Boolean(savingSetting)
                  }
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-black text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingSetting ===
                  "minimum" ? (
                    <LoaderCircle
                      size={16}
                      className="animate-spin"
                    />
                  ) : (
                    <Save size={16} />
                  )}
                  Save minimum
                </button>
              </div>

              <p className="mt-3 text-xs leading-5 text-[var(--muted-foreground)]">
                Example: changing ₦1,000 to ₦1,500 makes ₦1,500 the new floor for automatic/default number prices.
              </p>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4">
              <label
                htmlFor="global-usd-ngn-rate"
                className="text-xs font-black uppercase tracking-[0.14em] text-[var(--muted-foreground)]"
              >
                USD → NGN rate
              </label>

              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <div className="relative min-w-0 flex-1">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-black text-[var(--muted-foreground)]">
                    ₦
                  </span>
                  <input
                    id="global-usd-ngn-rate"
                    type="number"
                    min="1"
                    step="0.01"
                    inputMode="decimal"
                    value={exchangeRate}
                    onChange={(event) =>
                      setExchangeRate(
                        event.target.value
                      )
                    }
                    className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] pl-8 pr-3 text-sm font-black text-[var(--foreground)] outline-none transition focus:border-blue-500"
                    placeholder="1600"
                  />
                </div>

                <button
                  type="button"
                  onClick={() =>
                    saveGlobalSetting("rate")
                  }
                  disabled={
                    Boolean(savingSetting)
                  }
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-black text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingSetting === "rate" ? (
                    <LoaderCircle
                      size={16}
                      className="animate-spin"
                    />
                  ) : (
                    <Save size={16} />
                  )}
                  Save rate
                </button>
              </div>

              <p className="mt-3 text-xs leading-5 text-[var(--muted-foreground)]">
                This is the rate used to convert USD provider costs into naira. Example: enter 1600 for $1 = ₦1,600.
              </p>
            </div>
          </div>
        )}
      </section>

      <PricingRuleForm
        editingRule={editingRule}
        onSaved={handleSaved}
        onCancelEdit={() => setEditingRule(null)}
      />

      <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:max-w-2xl">
          <div>
            <label className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
              Filter by server
            </label>
            <select
              value={serverFilter}
              onChange={(event) => setServerFilter(event.target.value)}
              className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-sm font-semibold text-[var(--foreground)] outline-none focus:border-blue-500"
            >
              <option value="">All servers</option>
              <option value="server1">Server 1 — SMSBower</option>
              <option value="server2">Server 2 — BenOTP</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
              Rule status
            </label>
            <select
              value={activeFilter}
              onChange={(event) => setActiveFilter(event.target.value)}
              className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-sm font-semibold text-[var(--foreground)] outline-none focus:border-blue-500"
            >
              <option value="">All rules</option>
              <option value="true">Active</option>
              <option value="false">Disabled</option>
            </select>
          </div>
        </div>
      </section>

      <PricingRulesTable
        rules={rules}
        loading={loading}
        error={error}
        onEdit={handleEdit}
        onReload={reload}
      />

      {pagination.pages > 1 && (
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page <= 1 || loading}
            className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-bold text-[var(--foreground)] disabled:opacity-40"
          >
            Previous
          </button>

          <p className="text-sm font-semibold text-[var(--muted-foreground)]">
            Page {pagination.page} of {pagination.pages}
          </p>

          <button
            type="button"
            onClick={() =>
              setPage((current) =>
                Math.min(pagination.pages, current + 1)
              )
            }
            disabled={page >= pagination.pages || loading}
            className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-bold text-[var(--foreground)] disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
