"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeDollarSign,
  Coins,
  MessageSquareText,
  RefreshCw,
  Server,
  ShoppingCart,
  TrendingUp,
  Users,
  WalletCards,
} from "lucide-react";

import { adminPricingService } from "@/services/adminPricingService";

function formatNaira(value) {
  return `₦${Number(value || 0).toLocaleString("en-NG", {
    maximumFractionDigits: 2,
  })}`;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-NG");
}

const TONES = {
  profit: "bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300",
  cost: "bg-rose-500/10 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300",
  orders: "bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300",
  otp: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
  users: "bg-cyan-500/10 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-300",
  wallet: "bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
};

function MetricCard({ label, value, icon: Icon, tone, description, loading }) {
  return (
    <article className="relative min-h-[155px] overflow-hidden rounded-[26px] border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm sm:min-h-[175px] sm:p-6">
      <div className="flex h-full items-start justify-between gap-5">
        <div className="min-w-0 self-center">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--muted-foreground)] sm:text-xs">
            {label}
          </p>

          <p className="mt-4 break-words text-3xl font-black tracking-tight text-[var(--foreground)] sm:text-[2rem]">
            {loading ? "..." : value}
          </p>

          <p className="mt-2 text-xs leading-5 text-[var(--muted-foreground)]">
            {description}
          </p>
        </div>

        <div
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-current/10 sm:h-16 sm:w-16 ${TONES[tone]}`}
        >
          <Icon size={26} strokeWidth={1.8} />
        </div>
      </div>
    </article>
  );
}

export default function AdminDashboardPage() {
  const [server, setServer] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await adminPricingService.getSummary({
        server,
        dateFrom,
        dateTo,
      });

      setSummary(response?.summary || null);
    } catch (requestError) {
      setSummary(null);
      setError(requestError?.message || "Unable to load admin dashboard");
    } finally {
      setLoading(false);
    }
  }, [server, dateFrom, dateTo]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const metrics = useMemo(
    () => [
      {
        label: "Total Profit",
        value: formatNaira(summary?.totalProfit),
        icon: TrendingUp,
        tone: "profit",
        description: "Revenue minus the actual provider cost",
      },
      {
        label: "Total Cost",
        value: formatNaira(summary?.totalProviderCost),
        icon: Coins,
        tone: "cost",
        description: "Cost of non-refunded provider orders",
      },
      {
        label: "Total Orders",
        value: formatNumber(summary?.totalOrders),
        icon: ShoppingCart,
        tone: "orders",
        description: "Non-refunded number purchases",
      },
      {
        label: "Received OTPs",
        value: formatNumber(summary?.receivedOrders),
        icon: MessageSquareText,
        tone: "otp",
        description: "Orders with a received verification code",
      },
      {
        label: "Users",
        value: formatNumber(summary?.totalUsers),
        icon: Users,
        tone: "users",
        description: "Registered ChapsSmS accounts",
      },
      {
        label: "Users' Balance",
        value: formatNaira(summary?.usersBalance),
        icon: WalletCards,
        tone: "wallet",
        description: "Combined live spendable wallet balance",
      },
    ],
    [summary],
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">
            Business overview
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-[var(--foreground)] sm:text-4xl">
            Admin Dashboard
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)] sm:text-base">
            Monitor profit, provider costs, orders, received OTPs, users, and live wallet balances.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/pricing"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
          >
            <BadgeDollarSign size={17} />
            Manage pricing
          </Link>

          <button
            type="button"
            onClick={loadDashboard}
            disabled={loading}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm font-bold text-[var(--foreground)] transition hover:bg-[var(--muted)] disabled:opacity-60"
          >
            <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </header>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      ) : null}

      <section
        aria-label="Admin business statistics"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      >
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} loading={loading} />
        ))}
      </section>

      <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm sm:p-6">
        <div>
          <h2 className="text-lg font-black text-[var(--foreground)]">Order filters</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Profit, cost, order and OTP metrics follow these filters. Users and users&apos; balance remain global totals.
          </p>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
              Server
            </label>
            <select
              value={server}
              onChange={(event) => setServer(event.target.value)}
              className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-sm font-semibold text-[var(--foreground)] outline-none focus:border-blue-500"
            >
              <option value="">All servers</option>
              <option value="server1">Server 1 — SMSBower</option>
              <option value="server2">Server 2 — BenOTP</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
              From
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-sm font-semibold text-[var(--foreground)] outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
              To
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-sm font-semibold text-[var(--foreground)] outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                setServer("");
                setDateFrom("");
                setDateTo("");
              }}
              className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--muted)] px-4 text-sm font-bold text-[var(--foreground)] transition hover:opacity-80"
            >
              Clear filters
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        {["server1", "server2"].map((serverKey) => {
          const data = summary?.[serverKey] || {};
          const serverName = serverKey === "server1" ? "Server 1" : "Server 2";
          const providerName = serverKey === "server1" ? "SMSBower" : "BenOTP";

          return (
            <section
              key={serverKey}
              className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm sm:p-6"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                    {providerName}
                  </p>
                  <h2 className="mt-1 text-xl font-black text-[var(--foreground)]">
                    {serverName}
                  </h2>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
                  <Server size={21} />
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl bg-[var(--muted)] p-3">
                  <p className="text-xs text-[var(--muted-foreground)]">Orders</p>
                  <p className="mt-1 font-black text-[var(--foreground)]">
                    {loading ? "..." : formatNumber(data.orders)}
                  </p>
                </div>
                <div className="rounded-xl bg-[var(--muted)] p-3">
                  <p className="text-xs text-[var(--muted-foreground)]">Revenue</p>
                  <p className="mt-1 font-black text-[var(--foreground)]">
                    {loading ? "..." : formatNaira(data.revenue)}
                  </p>
                </div>
                <div className="rounded-xl bg-[var(--muted)] p-3">
                  <p className="text-xs text-[var(--muted-foreground)]">Cost</p>
                  <p className="mt-1 font-black text-[var(--foreground)]">
                    {loading ? "..." : formatNaira(data.providerCost)}
                  </p>
                </div>
                <div className="rounded-xl bg-green-50 p-3 dark:bg-green-950/30">
                  <p className="text-xs text-green-600 dark:text-green-300">Profit</p>
                  <p className="mt-1 font-black text-green-600 dark:text-green-300">
                    {loading ? "..." : formatNaira(data.profit)}
                  </p>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <Link
        href="/admin/orders"
        className="inline-flex items-center gap-2 rounded-xl text-sm font-black text-blue-600 hover:text-blue-700"
      >
        Review all orders
        <ArrowRight size={16} />
      </Link>
    </div>
  );
}
