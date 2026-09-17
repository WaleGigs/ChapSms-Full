"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, LoaderCircle, RefreshCw, Search } from "lucide-react";
import toast from "react-hot-toast";

import { socialService } from "@/services/socialService";

function formatNaira(value) {
  return `₦${Number(value || 0).toLocaleString("en-NG", {
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function statusClasses(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "completed") return "bg-green-500/10 text-green-500 ring-green-500/20";
  if (normalized === "failed" || normalized === "refunded") return "bg-red-500/10 text-red-500 ring-red-500/20";
  if (normalized === "review_required") return "bg-amber-500/10 text-amber-500 ring-amber-500/20";
  return "bg-blue-500/10 text-blue-500 ring-blue-500/20";
}

export default function SocialOrdersPanel() {
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const response = await socialService.getAdminOrders({
        page,
        limit: 25,
        status,
        search: appliedSearch,
      });
      setOrders(Array.isArray(response?.orders) ? response.orders : []);
      setPagination(response?.pagination || { page: 1, pages: 1, total: 0 });
    } catch (error) {
      toast.error(error?.message || "Unable to load social orders");
    } finally {
      setLoading(false);
    }
  }, [page, status, appliedSearch]);

  useEffect(() => {
    load();
  }, [load]);

  async function copy(value) {
    try {
      await navigator.clipboard.writeText(String(value || ""));
      toast.success("Copied");
    } catch {
      toast.error("Could not copy");
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-black">Logs & Social Orders</h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              {Number(pagination.total || 0).toLocaleString("en-NG")} total orders
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(220px,1fr)_180px_auto]">
            <div className="relative">
              <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    setPage(1);
                    setAppliedSearch(search.trim());
                  }
                }}
                placeholder="Search product/order..."
                className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] pl-10 pr-3 text-sm outline-none focus:border-blue-500"
              />
            </div>

            <select
              value={status}
              onChange={(event) => {
                setPage(1);
                setStatus(event.target.value);
              }}
              className="h-11 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 text-sm font-semibold outline-none"
            >
              <option value="">All statuses</option>
              <option value="completed">Completed</option>
              <option value="processing">Processing</option>
              <option value="review_required">Review required</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </select>

            <button
              type="button"
              onClick={load}
              className="flex h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-4 text-sm font-black"
            >
              <RefreshCw size={16} /> Refresh
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-64 items-center justify-center rounded-3xl border border-[var(--border)] bg-[var(--card)]">
          <LoaderCircle className="animate-spin text-blue-500" size={28} />
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-12 text-center text-sm text-[var(--muted-foreground)]">
          No logs/social orders found.
        </div>
      ) : (
        <div className="space-y-3 md:hidden">
          {orders.map((order) => (
            <article key={order.id} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-black">{order.productName}</p>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">{order.category} · Qty {order.quantity}</p>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">{order.customer?.email || "Unknown customer"}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-black capitalize ring-1 ${statusClasses(order.status)}`}>
                  {String(order.status || "").replace(/_/g, " ")}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-[var(--muted)] p-3 text-xs">
                <div><p className="text-[var(--muted-foreground)]">Sale</p><p className="mt-1 font-black">{formatNaira(order.sellingPrice)}</p></div>
                <div><p className="text-[var(--muted-foreground)]">Cost</p><p className="mt-1 font-black">{formatNaira(order.providerCostNgn)}</p></div>
                <div><p className="text-[var(--muted-foreground)]">Profit</p><p className="mt-1 font-black">{formatNaira(order.profit)}</p></div>
              </div>

              {order.deliveredItems?.length ? (
                <div className="mt-3 space-y-2">
                  {order.deliveredItems.slice(0, 3).map((item, index) => (
                    <div key={`${order.id}-${index}`} className="flex items-center gap-2 rounded-xl bg-[var(--muted)] p-2.5">
                      <p className="min-w-0 flex-1 break-all font-mono text-xs">{item}</p>
                      <button type="button" onClick={() => copy(item)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--card)]">
                        <Copy size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              <p className="mt-3 text-xs text-[var(--muted-foreground)]">{formatDate(order.createdAt)}</p>
            </article>
          ))}
        </div>
      )}

      {!loading && orders.length > 0 ? (
        <div className="hidden overflow-x-auto rounded-3xl border border-[var(--border)] bg-[var(--card)] md:block">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="border-b border-[var(--border)] text-xs uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
              <tr>
                <th className="px-5 py-4">Product</th>
                <th className="px-4 py-4">Customer</th>
                <th className="px-4 py-4">Qty</th>
                <th className="px-4 py-4">Sale</th>
                <th className="px-4 py-4">Cost</th>
                <th className="px-4 py-4">Profit</th>
                <th className="px-4 py-4">Provider</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-5 py-4 text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="px-5 py-4"><p className="font-black">{order.productName}</p><p className="mt-1 text-xs text-[var(--muted-foreground)]">{order.category}</p></td>
                  <td className="px-4 py-4 text-[var(--muted-foreground)]">{order.customer?.email || "—"}</td>
                  <td className="px-4 py-4 font-bold">{order.quantity}</td>
                  <td className="px-4 py-4 font-bold">{formatNaira(order.sellingPrice)}</td>
                  <td className="px-4 py-4">{formatNaira(order.providerCostNgn)}</td>
                  <td className="px-4 py-4 font-black">{formatNaira(order.profit)}</td>
                  <td className="px-4 py-4 capitalize text-[var(--muted-foreground)]">{order.provider}</td>
                  <td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-[11px] font-black capitalize ring-1 ${statusClasses(order.status)}`}>{String(order.status || "").replace(/_/g, " ")}</span></td>
                  <td className="px-5 py-4 text-right text-[var(--muted-foreground)]">{formatDate(order.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage((value) => Math.max(1, value - 1))}
          className="h-10 rounded-xl border border-[var(--border)] px-4 text-sm font-bold disabled:opacity-40"
        >
          Previous
        </button>
        <span className="text-sm text-[var(--muted-foreground)]">Page {pagination.page || page} of {pagination.pages || 1}</span>
        <button
          type="button"
          disabled={page >= Number(pagination.pages || 1)}
          onClick={() => setPage((value) => value + 1)}
          className="h-10 rounded-xl border border-[var(--border)] px-4 text-sm font-bold disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
