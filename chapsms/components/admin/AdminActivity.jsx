"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity, AlertTriangle, ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight,
  RefreshCw, RotateCcw, Search, ShoppingBag, X,
} from "lucide-react";
import { api } from "@/lib/api";

const PAGE_SIZE = 30;

const FILTERS = [
  ["all", "All"], ["deposit", "Deposits"], ["purchase", "Purchases"],
  ["refund", "Refunds"], ["failed", "Failed attempts"], ["withdraw", "Withdrawals"],
];

// Why a buy didn't go through, in admin words. Codes are the `code` each buy
// handler returns, lowercased by backend/utils/purchaseAttempts.js.
const FAIL_REASONS = {
  insufficient_balance: "User's balance too low",
  insufficient_wallet_balance: "User's balance too low",
  out_of_stock: "No stock",
  social_out_of_stock: "No stock",
  no_numbers: "No numbers available",
  social_product_not_found: "Product no longer available",
  unavailable: "Not available",
  provider_unavailable: "Provider unavailable",
  provider_error: "Provider error",
  wallet_rollback_failed: "Failed — wallet rollback also failed",
  order_creation_failed: "Order could not be created",
  error: "Failed",
};

const STATUS_WORDS = {
  waiting: "Awaiting SMS", cancelling: "Cancelling", received: "Code received",
  expired: "Expired", cancelled: "Cancelled", processing: "Processing",
  completed: "Completed", failed: "Failed", refunded: "Refunded",
  review_required: "Needs review", pending: "Pending",
};

const ICONS = {
  deposit: { icon: ArrowDownLeft, tint: "bg-emerald-500/10 text-emerald-500" },
  purchase: { icon: ShoppingBag, tint: "bg-blue-500/10 text-blue-500" },
  refund: { icon: RotateCcw, tint: "bg-amber-500/10 text-amber-500" },
  failed: { icon: AlertTriangle, tint: "bg-red-500/10 text-red-500" },
  withdraw: { icon: ArrowUpRight, tint: "bg-slate-500/10 text-slate-400" },
};

const PILL_TONES = {
  good: "bg-emerald-500/10 text-emerald-500",
  bad: "bg-red-500/10 text-red-500",
  warn: "bg-amber-500/10 text-amber-500",
  info: "bg-sky-500/10 text-sky-500",
  muted: "bg-[var(--muted)] text-[var(--muted-foreground)]",
};

const money = (value) => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(Number(value) || 0);
const clockTime = (value) => value ? new Intl.DateTimeFormat("en-NG", { timeStyle: "short", timeZone: "Africa/Lagos" }).format(new Date(value)) : "";
const lagosDay = (value) => new Date(value).toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });

function dayLabel(value) {
  if (!value) return "Unknown date";
  const day = lagosDay(value);
  const today = lagosDay(Date.now());
  if (day === today) return "Today";
  if (day === lagosDay(Date.now() - 86400000)) return "Yesterday";
  return new Date(value).toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short",
    ...(day.slice(0, 4) === today.slice(0, 4) ? {} : { year: "numeric" }),
    timeZone: "Africa/Lagos",
  });
}

/** "2h 5m" — how long the user sat on the deposit before spending it. */
function gapLabel(fromValue, toValue) {
  const ms = new Date(toValue).getTime() - new Date(fromValue).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "";
  const m = Math.round(ms / 60000);
  if (m < 1) return "under a minute";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

/** Consecutive rows bucketed by Lagos calendar day, preserving order. */
function groupByDay(rows) {
  const groups = [];
  rows.forEach((row) => {
    const label = dayLabel(row.at);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.rows.push(row);
    else groups.push({ label, rows: [row] });
  });
  return groups;
}

function pillFor(row) {
  const text = STATUS_WORDS[row.status] || row.status || "—";
  if (row.category === "failed") return { text: "Failed", tone: "bad" };
  if (row.category === "refund") return { text: "Refunded", tone: "warn" };
  if (["completed", "received"].includes(row.status)) return { text, tone: "good" };
  if (["failed", "cancelled", "expired"].includes(row.status)) return { text, tone: "bad" };
  if (row.status === "review_required") return { text, tone: "warn" };
  return { text, tone: row.status === "pending" ? "muted" : "info" };
}

function ActivityRow({ row, onUser }) {
  const { icon: Icon, tint } = ICONS[row.category] || ICONS.purchase;
  const pill = pillFor(row);
  const what = row.label || (row.kind === "social" ? "a social product" : "a number");
  const kindWord = row.kind === "social" ? "Social" : row.kind === "number" ? "Number" : null;
  const email = row.user?.email || "";
  const gateway = row.provider === "neurapay" ? "NeuraPay" : row.provider === "flutterwave" ? "Flutterwave" : null;

  let title;
  let amountText = row.amount != null ? money(row.amount) : "";
  let amountTone = "text-[var(--foreground)]";
  if (row.category === "deposit") {
    title = gateway ? `Deposit via ${gateway}` : row.label || "Deposit";
    if (row.status === "completed") { amountText = `+${amountText}`; amountTone = "text-emerald-500"; }
    else if (row.status === "pending") amountTone = "text-[var(--muted-foreground)]";
    else amountTone = "text-[var(--muted-foreground)] line-through"; // never landed
  } else if (row.category === "withdraw") {
    title = row.label || "Withdrawal";
    amountText = amountText && `−${amountText}`;
  } else if (row.category === "purchase") {
    title = `Bought ${what}`;
    amountText = amountText && `−${amountText}`;
  } else if (row.category === "refund") {
    const word = STATUS_WORDS[row.status];
    title = `${what} refunded${word && row.status !== "refunded" ? ` · ${word.toLowerCase()}` : ""}`;
    amountText = amountText && `+${amountText}`;
    amountTone = "text-amber-500";
  } else {
    title = `Couldn't buy ${what}`;
    amountTone = "text-[var(--muted-foreground)]";
  }

  const details = [
    clockTime(row.at),
    row.country,
    row.server === "server1" ? "Server 1" : row.server === "server2" ? "Server 2" : null,
    row.ref,
    row.environment === "test" ? "Test" : null,
  ].filter(Boolean);
  const reason = row.reason ? (FAIL_REASONS[row.reason] || row.reason.replace(/_/g, " ")) : null;
  const fp = row.firstPurchase;
  const showFirst = row.category === "deposit" && row.status === "completed" && fp !== undefined;
  const who = (
    <>
      {row.user?.name && <span className="font-medium">{row.user.name} · </span>}
      {email || "Unknown user"}
    </>
  );

  return (
    <li className="flex gap-3 px-4 py-3.5 transition-colors hover:bg-[var(--muted)]/30">
      <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tint}`}>
        <Icon size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex min-w-0 items-baseline gap-2">
              <span className="line-clamp-2 break-words text-[15px] font-semibold leading-snug text-[var(--foreground)]" title={title}>{title}</span>
              {kindWord && row.category !== "deposit" && row.category !== "withdraw" && (
                <span className="hidden shrink-0 text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] sm:inline">{kindWord}</span>
              )}
            </div>
            {/* Email always shown in full — it's how the admin identifies the user. */}
            <div className="mt-1 break-all text-[13px] leading-snug text-[var(--foreground)]">
              {onUser && row.userId ? (
                <button type="button" onClick={onUser} className="text-left hover:text-blue-500 hover:underline" title="Show only this user">{who}</button>
              ) : who}
            </div>
            <p className="mt-0.5 truncate text-xs text-[var(--muted-foreground)]">{details.join(" · ")}</p>
          </div>
          <div className="shrink-0 text-right">
            <div className={`text-[15px] font-bold tabular-nums ${amountTone}`}>{amountText}</div>
            <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${PILL_TONES[pill.tone]}`}>{pill.text}</span>
          </div>
        </div>

        {(reason || (row.category === "refund" && row.message)) && (
          <p className="mt-1.5 text-xs text-red-500">
            {reason && <span className="font-semibold">{reason}.</span>}
            {row.message && <span className="text-[var(--muted-foreground)]"> User saw “{row.message}”</span>}
          </p>
        )}

        {showFirst && (
          <p className="mt-1.5 text-xs text-[var(--muted-foreground)]">
            {fp === null ? (row.nextDepositAt ? "Not spent before their next deposit." : "Not spent yet.") : (
              <>
                First spent on <span className="font-medium text-[var(--foreground)]">{fp.label || (fp.kind === "social" ? "a social product" : "a number")}</span>
                {" "}· <span className="tabular-nums text-[var(--foreground)]">{money(fp.amount)}</span>
                {" "}· {gapLabel(row.at, fp.boughtAt)} later
              </>
            )}
          </p>
        )}
      </div>
    </li>
  );
}

/**
 * User activity: one newest-first timeline of deposits, purchases, refunds,
 * failed buy attempts and withdrawals. Click a user's email to narrow the
 * timeline to just them.
 */
export default function AdminActivity() {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [focusUser, setFocusUser] = useState(null); // { id, email }
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  // Search as you type, debounced.
  useEffect(() => {
    const timer = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async (signal) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE), type: filter });
      if (focusUser) params.set("userId", focusUser.id);
      else if (query) params.set("search", query);
      const response = await api(`/admin/activity?${params.toString()}`);
      if (signal.aborted) return;
      setItems(Array.isArray(response.activities) ? response.activities : []);
      setPagination(response.pagination || { total: 0, totalPages: 0 });
    } catch (err) {
      if (!signal.aborted) setError(err.message || "Unable to load activity");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [filter, query, focusUser, page, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const focus = (row) => {
    setFocusUser({ id: row.userId, email: row.user?.email || row.userId });
    setPage(1);
  };

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-black text-[var(--foreground)]">
            <Activity className="text-blue-500" /> User Activity
            <span className="text-base font-semibold text-[var(--muted-foreground)]">({(pagination.total || 0).toLocaleString()})</span>
          </h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">Deposits, purchases, refunds and failed buys, newest first</p>
        </div>
        <button type="button" onClick={() => setRefreshKey((n) => n + 1)} className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--muted)]">
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
        <div className="space-y-4 border-b border-[var(--border)] p-4 sm:p-5">
          <div className="flex min-w-0 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3">
            <Search size={17} className="shrink-0 text-[var(--muted-foreground)]" />
            <input
              value={focusUser ? "" : search}
              disabled={Boolean(focusUser)}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer name, username or email"
              className="h-11 w-full bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)] disabled:opacity-50"
            />
          </div>
          {focusUser && (
            <div className="inline-flex max-w-full items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 py-1 pl-3 pr-1.5 text-sm text-[var(--foreground)]">
              <span className="text-xs text-[var(--muted-foreground)]">Only</span>
              <span className="break-all">{focusUser.email}</span>
              <button type="button" onClick={() => { setFocusUser(null); setPage(1); }} className="rounded-md p-1 hover:bg-[var(--muted)]" aria-label="Show all users"><X size={14} /></button>
            </div>
          )}
          <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
            {FILTERS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => { setFilter(key); setPage(1); }}
                className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold transition ${filter === key ? "bg-blue-600 text-white" : "bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {error && <div role="alert" className="m-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">{error}</div>}

        <div className="p-4 sm:p-5">
          {loading && !items.length ? (
            <p className="py-14 text-center text-[var(--muted-foreground)]">Loading activity…</p>
          ) : !items.length && !error ? (
            <p className="py-14 text-center text-[var(--muted-foreground)]">No activity found for these filters.</p>
          ) : (
            <div className={`space-y-6 ${loading ? "opacity-60" : ""}`}>
              {groupByDay(items).map((group) => (
                <section key={group.label}>
                  <h2 className="mb-2 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                    {group.label}
                    <span className="h-px flex-1 bg-[var(--border)]" />
                    <span className="font-normal normal-case tracking-normal">{group.rows.length}</span>
                  </h2>
                  <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)]">
                    {group.rows.map((row) => (
                      <ActivityRow key={row.id} row={row} onUser={focusUser ? null : () => focus(row)} />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] px-5 py-4 text-sm text-[var(--muted-foreground)]">
          <span>{(pagination.total || 0).toLocaleString()} activities · Page {page} of {Math.max(1, pagination.totalPages || 0)}</span>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((n) => n - 1)} className="rounded-lg border border-[var(--border)] p-2 disabled:opacity-40" aria-label="Previous page"><ChevronLeft size={18} /></button>
            <button type="button" disabled={page >= (pagination.totalPages || 0) || loading} onClick={() => setPage((n) => n + 1)} className="rounded-lg border border-[var(--border)] p-2 disabled:opacity-40" aria-label="Next page"><ChevronRight size={18} /></button>
          </div>
        </div>
      </section>
    </main>
  );
}
