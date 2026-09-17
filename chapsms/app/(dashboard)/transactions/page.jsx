"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import {
  Copy,
  CreditCard,
  History,
  LoaderCircle,
  PackageCheck,
  RefreshCw,
  Search,
} from "lucide-react";
import toast from "react-hot-toast";

import { useOrders } from "@/hooks/useOrders";
import { catalogService } from "@/services/catalogService";
import { socialService } from "@/services/socialService";
import { api } from "@/lib/api";

const COMMON_SERVICE_NAMES = {
  wa: "WhatsApp",
  whatsapp: "WhatsApp",
  tg: "Telegram",
  telegram: "Telegram",
  fb: "Facebook",
  facebook: "Facebook",
  ig: "Instagram",
  instagram: "Instagram",
  go: "Google",
  google: "Google",
  tt: "TikTok",
  tiktok: "TikTok",
  tw: "X / Twitter",
  twitter: "X / Twitter",
  x: "X / Twitter",
  ds: "Discord",
  discord: "Discord",
};

function normalizeLookupKey(value) {
  return String(value || "").trim().toLowerCase();
}

function humanizeCode(value) {
  const text = String(value || "").trim();
  if (!text) return "—";
  const common = COMMON_SERVICE_NAMES[normalizeLookupKey(text)];
  if (common) return common;
  if (/^\d+$/.test(text)) return `Service ${text}`;
  return text.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function createServiceMap(services = []) {
  const map = {};
  for (const service of services) {
    const name = String(
      service?.name || service?.serviceName || service?.title || service?.label || ""
    ).trim();
    if (!name) continue;
    for (const identifier of [service?.id, service?.code, service?.service, service?.slug]) {
      const key = normalizeLookupKey(identifier);
      if (key) map[key] = name;
    }
  }
  return map;
}

function getOrderServiceName(order, serviceMaps) {
  const storedName = String(order?.serviceName || "").trim();
  if (storedName) return storedName;
  const serviceCode = normalizeLookupKey(order?.service);
  if (!serviceCode) return "—";
  const server = normalizeLookupKey(order?.server);
  if (server && serviceMaps?.[server]?.[serviceCode]) return serviceMaps[server][serviceCode];
  for (const map of Object.values(serviceMaps || {})) {
    if (map?.[serviceCode]) return map[serviceCode];
  }
  return humanizeCode(order?.service);
}

function getOrderCountryName(order) {
  const name = String(order?.countryName || "").trim();
  if (name) return name;
  const raw = String(order?.country || "").trim();
  if (!raw || /^\d+$/.test(raw)) return "";
  return humanizeCode(raw);
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

function formatNaira(value) {
  return `₦${Number(value || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function statusClasses(status) {
  const normalized = String(status || "").toLowerCase();
  if (["received", "completed"].includes(normalized)) {
    return "bg-green-500/10 text-green-500 ring-green-500/20";
  }
  if (["cancelled", "expired", "failed", "refunded"].includes(normalized)) {
    return "bg-red-500/10 text-red-500 ring-red-500/20";
  }
  if (normalized === "review_required") {
    return "bg-amber-500/10 text-amber-500 ring-amber-500/20";
  }
  return "bg-blue-500/10 text-blue-500 ring-blue-500/20";
}

function titleCase(value) {
  const text = String(value || "").trim().replace(/[-_]+/g, " ");
  return text ? text.replace(/\b\w/g, (c) => c.toUpperCase()) : "—";
}

function normalizeWalletTransaction(transaction, index) {
  const reference = String(
    transaction?.reference || transaction?.transactionId || transaction?._id || transaction?.id || ""
  ).trim();
  const date = transaction?.createdAt || transaction?.updatedAt || transaction?.date || null;
  const rawType = String(transaction?.type || "").trim().toLowerCase();
  const gateway = String(transaction?.paymentGateway || "").trim().toLowerCase();
  const paymentMethod = String(transaction?.paymentMethod || "").trim().toLowerCase();

  let method = String(transaction?.description || "").trim() || "Wallet";
  if (gateway === "neurapay") method = paymentMethod === "bank_transfer" ? "NeuraPay Bank Transfer" : "NeuraPay";
  if (gateway === "flutterwave") method = paymentMethod === "card" ? "Flutterwave Card" : "Flutterwave";

  return {
    ...transaction,
    rowKey: String(transaction?._id || "").trim() || reference || `${date || "wallet"}-${index}`,
    id: reference || "—",
    type: titleCase(rawType),
    rawType,
    method,
    status: String(transaction?.status || "completed").trim().toLowerCase(),
    date,
    amount: Number(transaction?.amount || 0),
  };
}

function extractWallet(response) {
  return response?.wallet || response?.data?.wallet || response?.data || response || {};
}

export default function TransactionsPage() {
  const { orders, loading: numberLoading, refreshOrders } = useOrders();
  const [serviceMaps, setServiceMaps] = useState({});
  const [activeTab, setActiveTab] = useState("numbers");
  const [numberSearch, setNumberSearch] = useState("");
  const [socialSearch, setSocialSearch] = useState("");
  const [paymentSearch, setPaymentSearch] = useState("");
  const [socialOrders, setSocialOrders] = useState([]);
  const [socialLoading, setSocialLoading] = useState(false);
  const [expandedCredentials, setExpandedCredentials] = useState({});
  const [payments, setPayments] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const legacy = Array.isArray(orders)
      ? orders.filter((order) => order?.service && !String(order?.serviceName || "").trim())
      : [];
    if (!legacy.length) return undefined;

    const servers = [...new Set(legacy.map((order) => normalizeLookupKey(order?.server)).filter((server) => ["server1", "server2"].includes(server)))];
    const targets = servers.length ? servers : ["server1", "server2"];

    Promise.allSettled(
      targets.map(async (server) => ({
        server,
        map: createServiceMap((await catalogService.getCatalog({ server }))?.services || []),
      }))
    ).then((results) => {
      if (cancelled) return;
      const next = {};
      results.forEach((result) => {
        if (result.status === "fulfilled") next[result.value.server] = result.value.map;
      });
      setServiceMaps((current) => ({ ...current, ...next }));
    });

    return () => {
      cancelled = true;
    };
  }, [orders]);

  const numberRows = useMemo(
    () =>
      (Array.isArray(orders) ? orders : []).map((order) => ({
        ...order,
        displayServiceName: getOrderServiceName(order, serviceMaps),
        displayCountryName: getOrderCountryName(order),
      })),
    [orders, serviceMaps]
  );

  const filteredNumbers = useMemo(() => {
    const query = numberSearch.trim().toLowerCase();
    if (!query) return numberRows;
    return numberRows.filter((order) =>
      [order.displayServiceName, order.displayCountryName, order.phoneNumber, order.otpCode, order.status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [numberRows, numberSearch]);

  const loadSocials = useCallback(async () => {
    try {
      setSocialLoading(true);
      setSocialOrders(await socialService.getOrders());
    } catch (error) {
      toast.error(error?.message || "Unable to load logs history");
    } finally {
      setSocialLoading(false);
    }
  }, []);

  const loadPayments = useCallback(async () => {
    try {
      setPaymentsLoading(true);
      const response = await api("/wallet");
      const wallet = extractWallet(response);
      const rows = (Array.isArray(wallet?.transactions) ? wallet.transactions : [])
        .map(normalizeWalletTransaction)
        .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
      setPayments(rows);
    } catch (error) {
      toast.error(error?.message || "Unable to load payment history");
    } finally {
      setPaymentsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "socials" && socialOrders.length === 0) loadSocials();
    if (activeTab === "payments" && payments.length === 0) loadPayments();
  }, [activeTab, socialOrders.length, payments.length, loadSocials, loadPayments]);

  const filteredSocials = useMemo(() => {
    const query = socialSearch.trim().toLowerCase();
    if (!query) return socialOrders;
    return socialOrders.filter((order) =>
      [order.productName, order.category, order.status, ...(order.deliveredItems || [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [socialOrders, socialSearch]);

  const filteredPayments = useMemo(() => {
    const query = paymentSearch.trim().toLowerCase();
    if (!query) return payments;
    return payments.filter((row) =>
      [row.id, row.type, row.method, row.status, row.amount, row.description]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [payments, paymentSearch]);

  async function refresh() {
    try {
      setRefreshing(true);
      if (activeTab === "numbers") await refreshOrders();
      if (activeTab === "socials") await loadSocials();
      if (activeTab === "payments") await loadPayments();
    } finally {
      setRefreshing(false);
    }
  }

  async function copy(value) {
    try {
      await navigator.clipboard.writeText(String(value || ""));
      toast.success("Copied");
    } catch {
      toast.error("Could not copy");
    }
  }

  const activeSearch = activeTab === "numbers" ? numberSearch : activeTab === "socials" ? socialSearch : paymentSearch;
  const setActiveSearch = activeTab === "numbers" ? setNumberSearch : activeTab === "socials" ? setSocialSearch : setPaymentSearch;
  const loading = activeTab === "numbers" ? numberLoading : activeTab === "socials" ? socialLoading : paymentsLoading;

  return (
    <div className="mx-auto w-full max-w-[1200px]">
      <div>
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
          Usage <span className="text-blue-600">History</span>
        </h1>
        <p className="mt-2 text-sm text-[var(--muted-foreground)] sm:text-base">
          Numbers, account/VPN purchases, and wallet payments are kept separately.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-1 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-1 shadow-sm">
        {[
          ["numbers", "Number History", History],
          ["socials", "Account & VPN History", PackageCheck],
          ["payments", "Payment History", CreditCard],
        ].map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`flex min-h-12 items-center justify-center gap-2 rounded-xl px-2 text-xs font-black transition sm:px-4 sm:text-sm ${
              activeTab === id
                ? "bg-blue-600 text-white"
                : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
            }`}
          >
            <Icon size={16} />
            <span className="truncate">{label}</span>
          </button>
        ))}
      </div>

      <section className="mt-6 rounded-3xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-black">
            {activeTab === "numbers" ? `Number history (${filteredNumbers.length})` : activeTab === "socials" ? `Account & VPN history (${filteredSocials.length})` : `Payment history (${filteredPayments.length})`}
          </h2>

          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1 sm:w-72">
              <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
              <input
                value={activeSearch}
                onChange={(event) => setActiveSearch(event.target.value)}
                placeholder={activeTab === "numbers" ? "Search numbers..." : activeTab === "socials" ? "Search accounts & VPNs..." : "Search payments..."}
                className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] pl-10 pr-3 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <button
              type="button"
              onClick={refresh}
              disabled={refreshing || loading}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--border)]"
            >
              <RefreshCw size={17} className={refreshing || loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-56 items-center justify-center">
            <LoaderCircle className="animate-spin text-blue-500" size={28} />
          </div>
        ) : activeTab === "numbers" ? (
          <div className="mt-5 space-y-3">
            {filteredNumbers.length === 0 ? (
              <p className="py-12 text-center text-sm text-[var(--muted-foreground)]">No number orders found.</p>
            ) : filteredNumbers.map((order) => (
              <article key={order._id || order.id} className="rounded-2xl border border-[var(--border)] bg-[var(--muted)]/40 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black">{order.displayServiceName}</p>
                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">{order.displayCountryName || "—"}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-black capitalize ring-1 ${statusClasses(order.status)}`}>{order.status || "waiting"}</span>
                </div>
                <div className="mt-4 grid gap-3 rounded-xl bg-[var(--background)] p-3 sm:grid-cols-2">
                  <div><p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Number</p><p className="mt-1 break-all font-semibold">{order.phoneNumber || "—"}</p></div>
                  <div><p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">OTP</p><p className="mt-1 break-all font-black tracking-wider">{order.otpCode || "—"}</p></div>
                </div>
                <p className="mt-3 text-xs text-[var(--muted-foreground)]">{formatDate(order.createdAt)}</p>
              </article>
            ))}
          </div>
        ) : activeTab === "socials" ? (
          <div className="mt-5 space-y-3">
            {filteredSocials.length === 0 ? (
              <p className="py-12 text-center text-sm text-[var(--muted-foreground)]">No account or VPN purchases yet.</p>
            ) : filteredSocials.map((order) => (
              <article key={order.id || order._id} className="rounded-2xl border border-[var(--border)] bg-[var(--muted)]/40 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-black">{order.productName}</p>
                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">{order.category} · Qty {order.quantity} · {formatNaira(order.total ?? order.sellingPrice)}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-black capitalize ring-1 ${statusClasses(order.status)}`}>{String(order.status || "").replace(/_/g, " ")}</span>
                </div>

                {Array.isArray(order.deliveredItems) && order.deliveredItems.length > 0 ? (
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedCredentials((current) => ({
                          ...current,
                          [order.id || order._id]: !current[order.id || order._id],
                        }))
                      }
                      className="text-sm font-bold text-[var(--foreground)] underline underline-offset-4"
                    >
                      {expandedCredentials[order.id || order._id]
                        ? "Hide credentials"
                        : `View credentials (${order.deliveredItems.length})`}
                    </button>

                    {expandedCredentials[order.id || order._id] ? (
                      <div className="mt-3 space-y-2">
                        {order.deliveredItems.map((item, index) => (
                          <div key={`${order.id}-${index}`} className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-3">
                            <p className="whitespace-pre-wrap break-all font-mono text-xs font-semibold leading-5">{item}</p>
                            <button type="button" onClick={() => copy(item)} className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-xs font-bold">
                              <Copy size={15} /> Copy
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {order.message ? <p className="mt-3 text-xs text-amber-500">{order.message}</p> : null}
                <p className="mt-3 text-xs text-[var(--muted-foreground)]">{formatDate(order.createdAt)}</p>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {filteredPayments.length === 0 ? (
              <p className="py-12 text-center text-sm text-[var(--muted-foreground)]">No wallet transactions yet.</p>
            ) : filteredPayments.map((row) => (
              <article key={row.rowKey} className="rounded-2xl border border-[var(--border)] bg-[var(--muted)]/40 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-black">{row.type}</p>
                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">{row.method}</p>
                    <p className="mt-1 break-all text-[11px] text-[var(--muted-foreground)]">{row.id}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black">{["purchase", "withdraw"].includes(row.rawType) ? "-" : ["deposit", "refund"].includes(row.rawType) ? "+" : ""}{formatNaira(row.amount)}</p>
                    <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-black capitalize ring-1 ${statusClasses(row.status)}`}>{row.status}</span>
                  </div>
                </div>
                <p className="mt-3 text-xs text-[var(--muted-foreground)]">{formatDate(row.date)}</p>
              </article>
            ))}
            <div className="pt-2">
              <Link href="/wallet" className="inline-flex h-11 items-center justify-center rounded-xl bg-blue-600 px-5 text-sm font-black text-white">Add Funds</Link>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
