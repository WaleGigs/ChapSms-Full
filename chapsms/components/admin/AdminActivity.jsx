"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, RefreshCw, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";

const FILTERS = [
  ["all", "All activity"], ["deposit", "Deposits"], ["purchase", "Purchases"],
  ["refund", "Refunds"], ["failed", "Failed"], ["withdraw", "Withdrawals"]
];
const money = (value) => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(Number(value) || 0);
const date = (value) => value ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" }).format(new Date(value)) : "—";
const statusStyle = (status) => {
  if (["completed", "received", "earned"].includes(status)) return "bg-emerald-500/10 text-emerald-500";
  if (["failed", "cancelled", "expired"].includes(status)) return "bg-red-500/10 text-red-500";
  if (status === "refunded") return "bg-sky-500/10 text-sky-500";
  return "bg-amber-500/10 text-amber-500";
};

export default function AdminActivity() {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async (signal) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20", type: filter });
      if (query) params.set("search", query);
      const response = await api(`/admin/activity?${params.toString()}`);
      if (signal.aborted) return;
      setItems(Array.isArray(response.activities) ? response.activities : []);
      setPagination(response.pagination || { total: 0, totalPages: 0 });
    } catch (err) {
      if (!signal.aborted) setError(err.message || "Unable to load activity");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [filter, query, page, refreshKey]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-black text-[var(--foreground)]"><Activity className="text-blue-500" /> User Activity</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">Wallet funding, SMS purchases, refunds and transaction history</p>
        </div>
        <button type="button" onClick={() => setRefreshKey((n) => n + 1)} className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--muted)]"><RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh</button>
      </div>
      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
        <div className="space-y-4 border-b border-[var(--border)] p-4 sm:p-5">
          <form onSubmit={(e) => { e.preventDefault(); setPage(1); setQuery(search.trim()); }} className="flex flex-wrap gap-2">
            <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3"><Search size={17} className="text-[var(--muted-foreground)]" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customer name, username or email" className="h-11 w-full bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]" /></div>
            <button type="submit" className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700">Search</button>
          </form>
          <div className="flex flex-wrap gap-2">{FILTERS.map(([key, label]) => <button key={key} type="button" onClick={() => { setFilter(key); setPage(1); }} className={`rounded-lg px-3 py-2 text-xs font-bold transition ${filter === key ? "bg-blue-600 text-white" : "bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"}`}>{label}</button>)}</div>
        </div>
        {error && <div role="alert" className="m-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">{error}</div>}
        <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-[var(--border)] text-xs uppercase tracking-wider text-[var(--muted-foreground)]"><tr><th className="px-5 py-4">Customer</th><th className="px-5 py-4">Activity</th><th className="px-5 py-4">Details</th><th className="px-5 py-4">Amount</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Date</th></tr></thead>
          <tbody className="divide-y divide-[var(--border)]">{!loading && items.map((item) => <tr key={item.id} className="hover:bg-[var(--muted)]/30">
            <td className="px-5 py-4"><p className="font-semibold text-[var(--foreground)]">{item.name || "Customer"}</p><p className="text-xs text-[var(--muted-foreground)]">{item.email || "—"}</p></td>
            <td className="px-5 py-4 font-semibold capitalize text-[var(--foreground)]">{item.type || "—"}</td>
            <td className="max-w-[280px] px-5 py-4"><p className="truncate text-[var(--foreground)]">{[item.service, item.country].filter(Boolean).join(" · ") || item.description || "—"}</p><p className="truncate text-xs text-[var(--muted-foreground)]">{[item.gateway, item.reference, item.environment === "test" ? "Test" : null].filter(Boolean).join(" · ")}</p></td>
            <td className="whitespace-nowrap px-5 py-4 font-semibold text-[var(--foreground)]">{money(item.amount)}</td>
            <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusStyle(item.status)}`}>{item.status || "—"}</span></td>
            <td className="whitespace-nowrap px-5 py-4 text-[var(--muted-foreground)]">{date(item.createdAt)}</td>
          </tr>)}
          {loading && <tr><td colSpan={6} className="px-5 py-14 text-center text-[var(--muted-foreground)]">Loading activity…</td></tr>}
          {!loading && !items.length && !error && <tr><td colSpan={6} className="px-5 py-14 text-center text-[var(--muted-foreground)]">No activity found for these filters.</td></tr>}
          </tbody></table></div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] px-5 py-4 text-sm text-[var(--muted-foreground)]"><span>{pagination.total || 0} activities · Page {page} of {Math.max(1, pagination.totalPages || 0)}</span><div className="flex gap-2"><button type="button" disabled={page <= 1 || loading} onClick={() => setPage((n) => n - 1)} className="rounded-lg border border-[var(--border)] p-2 disabled:opacity-40" aria-label="Previous page"><ChevronLeft size={18}/></button><button type="button" disabled={page >= (pagination.totalPages || 0) || loading} onClick={() => setPage((n) => n + 1)} className="rounded-lg border border-[var(--border)] p-2 disabled:opacity-40" aria-label="Next page"><ChevronRight size={18}/></button></div></div>
      </section>
    </main>
  );
}
