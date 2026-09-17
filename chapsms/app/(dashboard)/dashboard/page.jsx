"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Code2,
  Headphones,
  History,
  MessageSquareText,
  PackageCheck,
  ShoppingBag,
  WalletCards,
} from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { useWallet } from "@/hooks/useWallet";
import { useOrders } from "@/hooks/useOrders";
import { socialService } from "@/services/socialService";

function formatNaira(value) {
  return `₦${Number(value || 0).toLocaleString("en-NG", {
    maximumFractionDigits: 0,
  })}`;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function titleCase(value) {
  const text = String(value || "").trim().replace(/[-_]+/g, " ");
  return text ? text.replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Unknown";
}

function statusClasses(status) {
  const normalized = String(status || "").toLowerCase();

  if (["received", "completed"].includes(normalized)) {
    return "bg-emerald-500/10 text-emerald-500 ring-emerald-500/20";
  }

  if (["cancelled", "expired", "failed", "refunded"].includes(normalized)) {
    return "bg-red-500/10 text-red-500 ring-red-500/20";
  }

  if (normalized === "review_required") {
    return "bg-amber-500/10 text-amber-500 ring-amber-500/20";
  }

  return "bg-blue-500/10 text-blue-500 ring-blue-500/20";
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { wallet, loading: walletLoading } = useWallet();
  const { orders, loading: numberLoading } = useOrders();

  const [socialOrders, setSocialOrders] = useState([]);
  const [socialLoading, setSocialLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    socialService
      .getOrders()
      .then((items) => {
        if (!cancelled) {
          setSocialOrders(Array.isArray(items) ? items : []);
        }
      })
      .catch(() => {
        if (!cancelled) setSocialOrders([]);
      })
      .finally(() => {
        if (!cancelled) setSocialLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const recentActivity = useMemo(() => {
    const numberRows = (Array.isArray(orders) ? orders : []).map((order) => ({
      id: order?._id || order?.id,
      type: "number",
      title: order?.serviceName || titleCase(order?.service),
      subtitle: [order?.countryName || order?.country, order?.phoneNumber]
        .filter(Boolean)
        .join(" · "),
      status: order?.status || "waiting",
      createdAt: order?.createdAt,
    }));

    const socialRows = (Array.isArray(socialOrders) ? socialOrders : []).map((order) => ({
      id: order?._id || order?.id,
      type: "social",
      title: order?.productName || "Account / VPN order",
      subtitle: [order?.category, order?.quantity ? `Qty ${order.quantity}` : ""]
        .filter(Boolean)
        .join(" · "),
      status: order?.status || "processing",
      createdAt: order?.createdAt,
    }));

    return [...numberRows, ...socialRows]
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 5);
  }, [orders, socialOrders]);

  const displayName =
    user?.firstName || user?.username || String(user?.email || "").split("@")[0] || "";

  const activityLoading = numberLoading || socialLoading;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header>
        <h1 className="text-[26px] font-black leading-tight tracking-tight text-[var(--foreground)] min-[390px]:text-[28px] sm:text-4xl">
          Welcome back{displayName ? `, ${displayName}` : ""}
        </h1>
        <p className="mt-1.5 text-[13px] text-[var(--muted-foreground)] min-[390px]:text-sm sm:mt-2 sm:text-base">
          Pick a service to get started.
        </p>
      </header>

      <section className="mt-6 rounded-[22px] border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm sm:mt-7 sm:rounded-3xl sm:p-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--muted-foreground)] sm:text-xs">
          Wallet balance
        </p>

        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[30px] font-black leading-none tracking-tight text-[var(--foreground)] sm:text-4xl">
              {walletLoading ? "..." : formatNaira(wallet?.balance)}
            </p>
            <p className="mt-2 text-[13px] text-[var(--muted-foreground)] sm:text-sm">
              Top up to keep buying numbers, accounts and VPNs.
            </p>
          </div>

          <Link
            href="/wallet"
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--muted)] px-5 text-sm font-black text-[var(--foreground)] transition hover:border-blue-500/50 hover:bg-blue-500/5 sm:w-auto"
          >
            + Add funds
          </Link>
        </div>
      </section>

      <section className="mt-7 sm:mt-8">
        <h2 className="text-lg font-black text-[var(--foreground)] sm:text-xl">Services</h2>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4">
          <Link
            href="/buy-number"
            className="group min-w-0 rounded-[20px] border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm transition hover:border-blue-500/40 hover:bg-blue-500/5 sm:p-5"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600/15 text-blue-500 ring-1 ring-blue-500/20 sm:h-12 sm:w-12 sm:rounded-2xl">
              <MessageSquareText size={20} />
            </div>
            <p className="mt-4 text-[14px] font-black text-[var(--foreground)] sm:text-base">
              Buy Number
            </p>
            <p className="mt-1 text-[11px] leading-4 text-[var(--muted-foreground)] sm:text-sm sm:leading-5">
              SMS verification<br />200+ countries
            </p>
          </Link>

          <Link
            href="/buy-socials"
            className="group min-w-0 rounded-[20px] border border-blue-500/20 bg-blue-500/[0.06] p-4 shadow-sm transition hover:border-blue-500/50 hover:bg-blue-500/10 sm:p-5"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600/15 text-blue-500 ring-1 ring-blue-500/20 sm:h-12 sm:w-12 sm:rounded-2xl">
              <ShoppingBag size={20} />
            </div>
            <p className="mt-4 text-[14px] font-black leading-tight text-[var(--foreground)] sm:text-base">
              Buy Account & VPNs
            </p>
            <p className="mt-1 text-[11px] leading-4 text-[var(--muted-foreground)] sm:text-sm sm:leading-5">
              Social media accounts, VPNs & digital tools<br />Instant delivery
            </p>
          </Link>
        </div>
      </section>

      <section className="mt-7 sm:mt-8">
        <h2 className="text-lg font-black text-[var(--foreground)] sm:text-xl">Quick actions</h2>

        <div className="mt-4 grid grid-cols-4 gap-2.5 sm:gap-3">
          {[
            ["/transactions", "History", History],
            ["/wallet", "Top up", WalletCards],
            ["/api-keys", "API", Code2],
            ["/support", "Support", Headphones],
          ].map(([href, label, Icon]) => (
            <Link
              key={href}
              href={href}
              className="flex min-w-0 flex-col items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--card)] px-2 py-4 text-center transition hover:border-blue-500/40 hover:bg-[var(--muted)]"
            >
              <Icon size={18} className="text-[var(--muted-foreground)]" />
              <span className="mt-2 truncate text-[10px] font-semibold text-[var(--foreground)] min-[390px]:text-[11px] sm:text-xs">
                {label}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-7 sm:mt-8">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-black text-[var(--foreground)] sm:text-xl">Recent activity</h2>
          <Link
            href="/transactions"
            className="inline-flex items-center gap-1 text-xs font-bold text-blue-500 hover:text-blue-400 sm:text-sm"
          >
            View all <ArrowRight size={14} />
          </Link>
        </div>

        <div className="mt-4 overflow-hidden rounded-[20px] border border-[var(--border)] bg-[var(--card)] shadow-sm sm:rounded-3xl">
          {activityLoading ? (
            <div className="px-5 py-10 text-center text-sm text-[var(--muted-foreground)]">
              Loading activity...
            </div>
          ) : recentActivity.length === 0 ? (
            <div className="px-5 py-10 text-center sm:py-12">
              <PackageCheck className="mx-auto text-[var(--muted-foreground)]" size={25} />
              <p className="mt-4 text-sm font-black text-[var(--foreground)]">No orders yet</p>
              <p className="mt-1 text-xs text-[var(--muted-foreground)] sm:text-sm">
                Your numbers, accounts and VPNs will show up here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {recentActivity.map((item, index) => (
                <div
                  key={`${item.type}:${item.id || index}`}
                  className="flex min-w-0 items-center gap-3 px-4 py-4 sm:px-5"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--muted)] text-[var(--muted-foreground)]">
                    {item.type === "number" ? (
                      <MessageSquareText size={17} />
                    ) : (
                      <ShoppingBag size={17} />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-[var(--foreground)]">
                      {item.title}
                    </p>
                    <p className="mt-1 truncate text-[11px] text-[var(--muted-foreground)] sm:text-xs">
                      {item.subtitle || formatDate(item.createdAt)}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black capitalize ring-1 ${statusClasses(
                        item.status
                      )}`}
                    >
                      {titleCase(item.status)}
                    </span>
                    <p className="mt-1.5 hidden text-[10px] text-[var(--muted-foreground)] min-[390px]:block">
                      {formatDate(item.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
