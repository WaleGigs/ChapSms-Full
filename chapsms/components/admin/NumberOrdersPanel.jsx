"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  Download,
  LoaderCircle,
  ReceiptText,
  RefreshCw,
  Search,
} from "lucide-react";

import AdminOrderCard from "@/components/admin/AdminOrderCard";
import StatusBadge from "@/components/table/StatusBadge";
import { adminPricingService } from "@/services/adminPricingService";

function toPrimitiveString(value, seen = new WeakSet()) {
  if (value === null || value === undefined) {
    return "";
  }

  const valueType = typeof value;

  if (
    valueType === "string" ||
    valueType === "number" ||
    valueType === "bigint" ||
    valueType === "boolean"
  ) {
    const text = String(value).trim();

    return text === "[object Object]"
      ? ""
      : text;
  }

  if (valueType === "object") {
    if (seen.has(value)) {
      return "";
    }

    seen.add(value);

    for (const key of [
      "$oid",
      "_id",
      "id",
      "value",
      "code",
    ]) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) {
        continue;
      }

      const text = toPrimitiveString(value[key], seen);

      if (text) {
        return text;
      }
    }
  }

  return "";
}

function getSaleKey(sale, index) {
  const id = toPrimitiveString(
    sale?.id ?? sale?._id
  );

  return id
    ? `sale-${id}-${index}`
    : [
        "sale",
        toPrimitiveString(sale?.server),
        toPrimitiveString(sale?.phoneNumber),
        toPrimitiveString(sale?.createdAt),
        index,
      ].join("-");
}

function formatNaira(value) {
  return `₦${Number(value || 0).toLocaleString("en-NG", {
    maximumFractionDigits: 2,
  })}`;
}

function formatDateTime(value) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function capitalize(value) {
  const text = String(value || "");
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "—";
}

export default function NumberOrdersPanel() {
  const [filters, setFilters] = useState({
    server: "",
    status: "",
    search: "",
    dateFrom: "",
    dateTo: "",
  });
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [page, setPage] = useState(1);
  const [sales, setSales] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pages: 1,
    total: 0,
    limit: 25,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadSales = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await adminPricingService.getSales({
        ...appliedFilters,
        page,
        limit: 25,
      });

      setSales(
        Array.isArray(response?.sales)
          ? response.sales
          : []
      );
      setPagination(
        response?.pagination || {
          page,
          pages: 1,
          total: 0,
          limit: 25,
        }
      );
    } catch (requestError) {
      setSales([]);
      setError(
        requestError?.message ||
          "Unable to load sales records"
      );
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, page]);

  useEffect(() => {
    loadSales();
  }, [loadSales]);

  function updateFilter(name, value) {
    setFilters((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function applyFilters(event) {
    event?.preventDefault();
    setPage(1);
    setAppliedFilters(filters);
  }

  function clearFilters() {
    const emptyFilters = {
      server: "",
      status: "",
      search: "",
      dateFrom: "",
      dateTo: "",
    };

    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setPage(1);
  }

  function exportCSV() {
    if (!sales.length) {
      return;
    }

    const headers = [
      "Date",
      "Server",
      "Customer",
      "Email",
      "Country",
      "Service",
      "Operator",
      "Phone",
      "OTP",
      "Provider Cost NGN",
      "Selling Price",
      "Profit",
      "Status",
      "Refunded",
    ];

    const rows = sales.map((sale) => [
      formatDateTime(sale.createdAt),
      sale.server,
      `${sale?.customer?.firstName || ""} ${sale?.customer?.lastName || ""}`.trim(),
      sale?.customer?.email || "",
      sale.country,
      sale.service,
      sale.operator,
      sale.phoneNumber,
      sale.otpCode,
      sale.providerCostNgn,
      sale.sellingPrice,
      sale.profit,
      sale.status,
      sale.refunded ? "Yes" : "No",
    ]);

    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((value) =>
            `"${String(value ?? "").replaceAll('"', '""')}"`
          )
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `chapsms-sales-page-${page}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">
            Financial records
          </p>
          <div className="mt-2 flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
              <ReceiptText size={22} />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-[var(--foreground)] sm:text-4xl">
                Sales & Profit
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted-foreground)] sm:text-base">
                Review each sale with the customer, phone number, OTP, provider cost, ChapsSmS price, profit, status, date and time.
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={loadSales}
            disabled={loading}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm font-bold text-[var(--foreground)] transition hover:bg-[var(--muted)] disabled:opacity-60"
          >
            <RefreshCw
              size={17}
              className={loading ? "animate-spin" : ""}
            />
            Refresh
          </button>
          <button
            type="button"
            onClick={exportCSV}
            disabled={!sales.length}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            <Download size={17} />
            Export page
          </button>
        </div>
      </div>

      <form
        onSubmit={applyFilters}
        className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm sm:p-6"
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <div className="sm:col-span-2">
            <label className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
              Search
            </label>
            <div className="relative mt-2">
              <Search
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
              />
              <input
                value={filters.search}
                onChange={(event) =>
                  updateFilter("search", event.target.value)
                }
                placeholder="Email, phone number or OTP"
                className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] pl-10 pr-3 text-sm font-semibold text-[var(--foreground)] outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
              Server
            </label>
            <select
              value={filters.server}
              onChange={(event) =>
                updateFilter("server", event.target.value)
              }
              className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-sm font-semibold text-[var(--foreground)] outline-none focus:border-blue-500"
            >
              <option value="">All servers</option>
              <option value="server1">Server 1</option>
              <option value="server2">Server 2</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
              Status
            </label>
            <select
              value={filters.status}
              onChange={(event) =>
                updateFilter("status", event.target.value)
              }
              className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-sm font-semibold text-[var(--foreground)] outline-none focus:border-blue-500"
            >
              <option value="">All statuses</option>
              <option value="waiting">Waiting</option>
              <option value="received">Received</option>
              <option value="cancelled">Cancelled</option>
              <option value="expired">Expired</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
              From date
            </label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(event) =>
                updateFilter("dateFrom", event.target.value)
              }
              className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-sm font-semibold text-[var(--foreground)] outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
              To date
            </label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(event) =>
                updateFilter("dateTo", event.target.value)
              }
              className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-sm font-semibold text-[var(--foreground)] outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="submit"
            className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
          >
            Apply filters
          </button>
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-xl border border-[var(--border)] px-5 py-3 text-sm font-bold text-[var(--foreground)] transition hover:bg-[var(--muted)]"
          >
            Clear filters
          </button>
        </div>
      </form>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      <section className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
        <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] p-5 sm:p-6">
          <div>
            <h2 className="text-xl font-black text-[var(--foreground)]">
              Order records
            </h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              {Number(pagination.total || 0).toLocaleString()} record(s) found
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-3 px-6 py-16 text-sm font-semibold text-[var(--muted-foreground)]">
            <LoaderCircle className="animate-spin" size={20} />
            Loading sales records...
          </div>
        ) : sales.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <ReceiptText className="mx-auto text-[var(--muted-foreground)]" size={32} />
            <p className="mt-4 font-black text-[var(--foreground)]">
              No matching sales
            </p>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              Adjust the filters and try again.
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 p-4 md:hidden">
              {sales.map((sale, index) => (
                <AdminOrderCard
                  key={getSaleKey(sale, index)}
                  sale={sale}
                />
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[1450px] text-left text-sm">
                <thead className="border-b border-[var(--border)] text-xs uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
                  <tr>
                    <th className="px-6 py-4">Date & time</th>
                    <th className="px-4 py-4">Customer</th>
                    <th className="px-4 py-4">Server</th>
                    <th className="px-4 py-4">Country / service</th>
                    <th className="px-4 py-4">Phone / OTP</th>
                    <th className="px-4 py-4">Provider cost</th>
                    <th className="px-4 py-4">Selling price</th>
                    <th className="px-4 py-4">Profit</th>
                    <th className="px-4 py-4">Status</th>
                    <th className="px-6 py-4">Financial</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[var(--border)]">
                  {sales.map((sale, index) => {
                    const customerName = [
                      sale?.customer?.firstName,
                      sale?.customer?.lastName,
                    ]
                      .filter(Boolean)
                      .join(" ");

                    return (
                      <tr
                        key={getSaleKey(sale, index)}
                        className="transition hover:bg-[var(--muted)]/60"
                      >
                        <td className="px-6 py-4 text-xs font-semibold text-[var(--muted-foreground)]">
                          {formatDateTime(sale.createdAt)}
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-black text-[var(--foreground)]">
                            {customerName || "Customer"}
                          </p>
                          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                            {sale?.customer?.email || "—"}
                          </p>
                        </td>
                        <td className="px-4 py-4 font-black text-[var(--foreground)]">
                          {sale.server === "server1" ? "Server 1" : "Server 2"}
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-black text-[var(--foreground)]">
                            {capitalize(sale.service)}
                          </p>
                          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                            {sale.country} · {sale.operator || "any"}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-bold text-[var(--foreground)]">
                            {sale.phoneNumber || "—"}
                          </p>
                          <p className="mt-1 text-xs font-black tracking-wider text-blue-600">
                            {sale.otpCode || "Waiting"}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-bold text-[var(--foreground)]">
                            {formatNaira(sale.providerCostNgn)}
                          </p>
                          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                            {sale.providerCost} {sale.providerCurrency}
                          </p>
                        </td>
                        <td className="px-4 py-4 font-black text-blue-600">
                          {formatNaira(sale.sellingPrice)}
                        </td>
                        <td className="px-4 py-4 font-black text-green-600">
                          {formatNaira(sale.profit)}
                        </td>
                        <td className="px-4 py-4">
                          <StatusBadge status={sale.status} />
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-black ${
                              sale.refunded
                                ? "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
                                : "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                            }`}
                          >
                            {sale.refunded
                              ? "Refunded"
                              : capitalize(sale.financialStatus || "charged")}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

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
