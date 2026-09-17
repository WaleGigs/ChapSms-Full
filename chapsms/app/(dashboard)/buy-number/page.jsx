"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  CheckCircle2,
  Copy,
  LoaderCircle,
  MessageSquareText,
  Phone,
  Plus,
  RefreshCw,
  Timer,
  XCircle,
} from "lucide-react";

import { useCatalog } from "@/hooks/useCatalog";
import { useOrders } from "@/hooks/useOrders";
import { useWallet } from "@/hooks/useWallet";
import { catalogService } from "@/services/catalogService";
import { orderService } from "@/services/orderService";
import { trackNumberPurchased } from "@/lib/tiktokEvents";

import SearchableCountrySelect from "@/components/dashboard/SearchableCountrySelect";
import SearchableServiceSelect from "@/components/dashboard/SearchableServiceSelect";
import Button from "@/components/ui/Button";

const POLLING_INTERVAL_MS = 5000;
const FALLBACK_ORDER_LIFETIME_MS = 20 * 60 * 1000;
const RECENT_RECEIVED_VISIBLE_MS = 60 * 60 * 1000;
const DISMISSED_ORDERS_KEY = "chapsms-dismissed-active-orders";

const ACTIVE_SERVICE_NAME_ALIASES = {
  wa: "WhatsApp",
  ig: "Instagram",
  tg: "Telegram",
  fb: "Facebook",
  go: "Google",
  am: "Amazon",
  ds: "Discord",
  tt: "TikTok",
  tw: "X / Twitter",
  nf: "Netflix",
};

function getOrderId(order) {
  return order?._id || order?.id || "";
}

function getOrderStatus(order) {
  return String(order?.status || "waiting")
    .trim()
    .toLowerCase();
}

function isCurrentTrackableOrder(order) {
  const server = String(order?.server || "")
    .trim()
    .toLowerCase();
  const providerOrderId = String(order?.providerOrderId || "").trim();
  const sellingPrice = Number(order?.sellingPrice);

  // /orders also returns historical records from older ChapSMS versions.
  // Those legacy rows can still say "waiting", but they may point to the
  // retired 5sim provider or be missing fields required by the current model.
  // Never treat those historical rows as live activations.
  if (!["server1", "server2"].includes(server) || !providerOrderId) {
    return false;
  }

  // New orders created by the 20-minute lifecycle/refund backend carry this
  // rollout flag. Keep the sellingPrice fallback so the UI remains compatible
  // if the public serializer omits the rollout flag in a later backend build.
  if (order?.autoRefundEligible === true) {
    return true;
  }

  return Number.isFinite(sellingPrice) && sellingPrice > 0;
}

function isLiveOrder(order) {
  return (
    isCurrentTrackableOrder(order) &&
    ["waiting", "cancelling"].includes(getOrderStatus(order))
  );
}

function isRecentReceivedOrder(order, nowMs) {
  if (!isCurrentTrackableOrder(order)) {
    return false;
  }
  if (getOrderStatus(order) !== "received" && !order?.otpCode) {
    return false;
  }

  const createdAt = new Date(order?.createdAt || "").getTime();

  if (!Number.isFinite(createdAt)) {
    return false;
  }

  return nowMs - createdAt <= RECENT_RECEIVED_VISIBLE_MS;
}

function getOrderExpiryMs(order) {
  const createdAt = new Date(order?.createdAt || "").getTime();

  const fallbackExpiry = Number.isFinite(createdAt)
    ? createdAt + FALLBACK_ORDER_LIFETIME_MS
    : null;

  const explicitExpiry = new Date(order?.expiresAt || "").getTime();

  if (Number.isFinite(explicitExpiry) && Number.isFinite(fallbackExpiry)) {
    const drift = Math.abs(explicitExpiry - fallbackExpiry);

    // ChapSMS uses a 20-minute activation window. Ignore a bad provider
    // timestamp that would turn the countdown into an unrealistic value.
    return drift <= 5 * 60 * 1000 ? explicitExpiry : fallbackExpiry;
  }

  if (Number.isFinite(explicitExpiry)) {
    return explicitExpiry;
  }

  return Number.isFinite(fallbackExpiry) ? fallbackExpiry : null;
}

function getRemainingSeconds(order, nowMs) {
  const expiryMs = getOrderExpiryMs(order);

  if (!Number.isFinite(expiryMs)) {
    return 0;
  }

  return Math.max(0, Math.ceil((expiryMs - nowMs) / 1000));
}

function formatRemainingTime(totalSeconds) {
  const safeSeconds = Math.max(0, Number(totalSeconds || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = Math.floor(safeSeconds % 60);

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatNaira(value) {
  return `₦${Number(value || 0).toLocaleString("en-NG", {
    maximumFractionDigits: 0,
  })}`;
}

function getPurchaseParts(value) {
  if (!value) {
    return { date: "—", time: "—" };
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return { date: "—", time: "—" };
  }

  return {
    date: new Intl.DateTimeFormat("en-NG", {
      day: "numeric",
      month: "short",
    }).format(date),
    time: new Intl.DateTimeFormat("en-NG", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date),
  };
}

function formatName(value) {
  if (!value) return "Unknown";

  return String(value)
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getOrderServiceName(order) {
  const explicitName = String(order?.serviceName || "").trim();

  if (explicitName) {
    return explicitName;
  }

  const code = String(order?.service || "").trim();
  const alias = ACTIVE_SERVICE_NAME_ALIASES[code.toLowerCase()];

  return alias || formatName(code);
}

function getOrderCountryName(order) {
  const explicitName = String(order?.countryName || "").trim();

  if (explicitName) {
    return explicitName;
  }

  return formatName(order?.country || "");
}

function formatPhoneNumber(value) {
  if (!value) return "—";

  const digits = String(value).replace(/\D/g, "");

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }

  return String(value);
}

function getServerLabel(server) {
  const normalized = String(server || "").toLowerCase();

  if (normalized === "server1") return "S1";
  if (normalized === "server2") return "S2";

  return "—";
}

function getStatusLabel(order) {
  const status = getOrderStatus(order);

  if (order?.otpCode || status === "received") return "Code received";
  if (status === "expired") return "Order expired";
  if (status === "cancelled") return "Order cancelled";
  if (status === "cancelling") return "Cancelling order";

  return "Waiting for SMS";
}

function getStatusClasses(order) {
  const status = getOrderStatus(order);

  if (order?.otpCode || status === "received") {
    return "bg-green-50 text-green-700 ring-green-200 dark:bg-green-950/40 dark:text-green-300 dark:ring-green-900";
  }

  if (["expired", "cancelled"].includes(status)) {
    return "bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900";
  }

  return "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900";
}

function getChapsSmsMessage(
  value,
  fallback = "ChapsSms could not complete this request. Please try again."
) {
  const code = String(
    typeof value === "object"
      ? value?.code || value?.response?.data?.code || ""
      : ""
  )
    .trim()
    .toUpperCase();

  const messages = {
    NO_PRICE:
      "ChapsSms does not currently have a live price for this selection. Try another server or service.",
    NO_NUMBERS:
      "ChapsSms does not currently have numbers available for this selection. Try another server or service.",
    NO_STOCK:
      "ChapsSms does not currently have numbers available for this selection.",
    INVALID_COUNTRY:
      "This country is not currently available on ChapsSms.",
    INVALID_SERVICE:
      "This service is not currently available on ChapsSms.",
    INVALID_PRICE:
      "ChapsSms could not retrieve a valid live price right now. Please try again.",
    INVALID_PRICE_RESPONSE:
      "ChapsSms could not retrieve a live price right now. Please try again.",
    INSUFFICIENT_WALLET_BALANCE:
      "Your ChapsSms wallet balance is too low for this purchase.",
    UNSAFE_PAYMENT_CONFIGURATION:
      "Number purchasing is temporarily unavailable on ChapsSms.",
    CATALOG_LOAD_FAILED:
      "ChapsSms could not load the available countries and services. Please try again.",
    PRICE_LOOKUP_FAILED:
      "ChapsSms could not retrieve a live price right now. Please try again.",
    ORDER_CREATION_FAILED:
      "ChapsSms could not purchase this number right now.",
    ORDER_CANCELLATION_FAILED:
      "ChapsSms could not cancel this order right now.",
  };

  if (messages[code]) {
    return messages[code];
  }

  const message = String(
    typeof value === "string"
      ? value
      : value?.message || value?.response?.data?.message || ""
  ).trim();

  if (/chapssms/i.test(message)) {
    return message;
  }

  return fallback;
}

function CompactOrderCard({
  order,
  nowMs,
  refreshing,
  cancelling,
  onRefresh,
  onCancel,
  onDismiss,
  onCopy,
}) {
  const orderId = getOrderId(order);
  const status = getOrderStatus(order);
  const otpCode = String(order?.otpCode || "").trim();
  const live = isLiveOrder(order) && !otpCode;
  const received = Boolean(otpCode) || status === "received";
  const remainingSeconds = live ? getRemainingSeconds(order, nowMs) : 0;
  const purchased = getPurchaseParts(order?.createdAt);

  return (
    <article className="min-w-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span
              className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${getStatusClasses(
                order
              )}`}
            >
              {received ? (
                <CheckCircle2 size={13} />
              ) : live ? (
                <LoaderCircle className="animate-spin" size={13} />
              ) : (
                <XCircle size={13} />
              )}
              {getStatusLabel(order)}
            </span>

            <p className="mt-2 truncate text-sm font-black text-[var(--foreground)]">
              {getOrderCountryName(order)}
              <span className="mx-2 text-[var(--muted-foreground)]">•</span>
              {getOrderServiceName(order)}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onRefresh(orderId)}
            disabled={refreshing || !live}
            aria-label="Refresh order"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[var(--muted-foreground)] transition hover:bg-[var(--muted)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>

        {/* Compact horizontal metadata row: Paid / Order ID / Server / Purchased */}
        <div className="mt-4 grid grid-cols-4 divide-x divide-[var(--border)] overflow-hidden rounded-xl bg-[var(--muted)]">
          <div className="min-w-0 px-1.5 py-2.5 text-center sm:px-2">
            <p className="text-[8px] font-black uppercase tracking-[0.08em] text-[var(--muted-foreground)] sm:text-[9px]">
              Paid
            </p>
            <p className="mt-1 truncate text-[10px] font-black text-[var(--foreground)] sm:text-xs">
              {formatNaira(order?.sellingPrice ?? order?.price)}
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              onCopy(order?.providerOrderId || orderId, "Order ID copied")
            }
            className="min-w-0 px-1.5 py-2.5 text-center transition hover:bg-black/[0.03] dark:hover:bg-white/[0.03] sm:px-2"
          >
            <p className="text-[8px] font-black uppercase tracking-[0.08em] text-[var(--muted-foreground)] sm:text-[9px]">
              Order ID
            </p>
            <p className="mt-1 truncate font-mono text-[10px] font-bold text-[var(--foreground)] sm:text-xs">
              {order?.providerOrderId || orderId || "—"}
            </p>
          </button>

          <div className="min-w-0 px-1.5 py-2.5 text-center sm:px-2">
            <p className="text-[8px] font-black uppercase tracking-[0.08em] text-[var(--muted-foreground)] sm:text-[9px]">
              Server
            </p>
            <p className="mt-1 text-[10px] font-black text-[var(--foreground)] sm:text-xs">
              {getServerLabel(order?.server)}
            </p>
          </div>

          <div className="min-w-0 px-1.5 py-2.5 text-center sm:px-2">
            <p className="text-[8px] font-black uppercase tracking-[0.08em] text-[var(--muted-foreground)] sm:text-[9px]">
              Purchased
            </p>
            <p className="mt-1 truncate text-[10px] font-black text-[var(--foreground)] sm:text-xs">
              {purchased.date}
            </p>
            <p className="mt-0.5 truncate text-[9px] font-semibold text-[var(--muted-foreground)]">
              {purchased.time}
            </p>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-[var(--border)] px-3 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
                Virtual number
              </p>
              <p className="mt-1 truncate text-lg font-black tracking-tight text-[var(--foreground)] sm:text-xl">
                {formatPhoneNumber(order?.phoneNumber)}
              </p>
            </div>

            <button
              type="button"
              onClick={() => onCopy(order?.phoneNumber, "Number copied")}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-[var(--muted)] px-3 text-xs font-bold text-[var(--foreground)] transition hover:opacity-80"
            >
              <Copy size={14} />
              Copy
            </button>
          </div>
        </div>

        <div
          className={`mt-3 rounded-xl px-3 py-3 text-white ${
            otpCode ? "bg-blue-600" : "bg-slate-950"
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className={`text-[9px] font-black uppercase tracking-[0.12em] ${otpCode ? "text-blue-100" : "text-slate-400"}`}>
                OTP code
              </p>
              <p
                className={`mt-1 truncate text-xl font-black tracking-[0.12em] ${
                  !otpCode && live ? "animate-pulse" : ""
                }`}
              >
                {otpCode || (live ? "• • • • • •" : "Unavailable")}
              </p>
            </div>

            <button
              type="button"
              disabled={!otpCode}
              onClick={() => onCopy(otpCode, "OTP copied")}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-white/10 px-3 text-xs font-bold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Copy size={14} />
              OTP
            </button>
          </div>
        </div>

        {live && (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-[var(--muted)] px-3 py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <Timer className="shrink-0 text-blue-600" size={17} />
              <div className="min-w-0">
                <p className="text-xs font-black text-[var(--foreground)]">
                  Waiting for SMS
                </p>
                <p className="mt-0.5 truncate text-[10px] text-[var(--muted-foreground)]">
                  Checking automatically every five seconds.
                </p>
              </div>
            </div>

            <p className="shrink-0 text-lg font-black tabular-nums text-[var(--foreground)]">
              {formatRemainingTime(remainingSeconds)}
            </p>
          </div>
        )}

        {live && (
          <button
            type="button"
            onClick={() => onCancel(order)}
            disabled={cancelling}
            className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-[var(--card)] px-4 text-xs font-black text-red-600 transition hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900 dark:hover:bg-red-950/30"
          >
            {cancelling ? (
              <LoaderCircle className="animate-spin" size={15} />
            ) : (
              <XCircle size={15} />
            )}
            {cancelling ? "Cancelling..." : "Cancel Order"}
          </button>
        )}

        {received && (
          <button
            type="button"
            onClick={() => onDismiss(orderId)}
            className="mt-3 h-10 w-full rounded-xl bg-[var(--muted)] px-4 text-xs font-black text-[var(--foreground)] transition hover:opacity-80"
          >
            Done — hide this order
          </button>
        )}
      </div>
    </article>
  );
}

export default function BuyNumberPage() {
  const {
    orders,
    loading: ordersLoading,
    createOrder,
    updateOrder,
  } = useOrders();

  const { updateWalletBalance, refreshWallet } = useWallet();

  const [selectedServer, setSelectedServer] = useState("server1");
  const {
    countries,
    services,
    loading: catalogLoading,
    error: catalogError,
    reload: reloadCatalog,
  } = useCatalog(selectedServer);

  const [selectedCountryCode, setSelectedCountryCode] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [livePrice, setLivePrice] = useState(null);
  const [liveStock, setLiveStock] = useState(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceError, setPriceError] = useState("");
  const [purchasing, setPurchasing] = useState(false);
  const [showPurchasePanel, setShowPurchasePanel] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [refreshingOrderIds, setRefreshingOrderIds] = useState(() => new Set());
  const [cancellingOrderIds, setCancellingOrderIds] = useState(() => new Set());
  const [dismissedOrderIds, setDismissedOrderIds] = useState(() => new Set());

  const purchasePanelRef = useRef(null);
  const pollingInProgressRef = useRef(new Set());
  const blockedPollingRef = useRef(new Set());
  const expiryCheckedRef = useRef(new Set());
  const otpNotifiedRef = useRef(new Set());

  // Keep changing hook/context callbacks in refs so the 5-second polling callback
  // stays stable and is not reset by the 1-second countdown render.
  const updateOrderRef = useRef(updateOrder);
  const refreshWalletRef = useRef(refreshWallet);

  useEffect(() => {
    updateOrderRef.current = updateOrder;
  }, [updateOrder]);

  useEffect(() => {
    refreshWalletRef.current = refreshWallet;
  }, [refreshWallet]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DISMISSED_ORDERS_KEY);
      const ids = JSON.parse(raw || "[]");

      if (Array.isArray(ids)) {
        setDismissedOrderIds(new Set(ids.map(String)));
      }
    } catch {
      setDismissedOrderIds(new Set());
    }
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  const selectedCountry = useMemo(() => {
    return (
      countries.find(
        (country) => String(country.id) === String(selectedCountryCode)
      ) || null
    );
  }, [countries, selectedCountryCode]);

  const availableServices = useMemo(() => {
    if (!selectedCountry) {
      return [];
    }

    return services;
  }, [selectedCountry, services]);

  const selectedService = useMemo(() => {
    return (
      availableServices.find(
        (service) =>
          String(service.id || service.code || service.service || "") ===
          String(selectedServiceId)
      ) || null
    );
  }, [availableServices, selectedServiceId]);

  const estimatedPrice = Number(livePrice || 0);
  const serviceStock =
    liveStock === null || liveStock === undefined ? null : Number(liveStock);

  const serviceIsAvailable =
    Boolean(selectedCountry) &&
    Boolean(selectedService) &&
    !priceLoading &&
    Number.isFinite(estimatedPrice) &&
    estimatedPrice > 0;

  const visibleOrders = useMemo(() => {
    const list = Array.isArray(orders) ? orders : [];

    return list
      .filter((order) => {
        const orderId = getOrderId(order);

        if (!orderId || dismissedOrderIds.has(String(orderId))) {
          return false;
        }

        return isLiveOrder(order) || isRecentReceivedOrder(order, nowMs);
      })
      .sort((a, b) => {
        const aTime = new Date(a?.createdAt || 0).getTime();
        const bTime = new Date(b?.createdAt || 0).getTime();
        return bTime - aTime;
      });
  }, [orders, dismissedOrderIds, nowMs]);

  const liveOrders = useMemo(
    () => visibleOrders.filter((order) => isLiveOrder(order) && !order?.otpCode),
    [visibleOrders]
  );

  const liveOrderIds = useMemo(
    () => liveOrders.map((order) => String(getOrderId(order))).filter(Boolean),
    [liveOrders]
  );

  const liveOrderIdsKey = liveOrderIds.join("|");
  const shouldShowPurchasePanel = showPurchasePanel || liveOrders.length === 0;

  useEffect(() => {
    if (!selectedCountryCode) {
      return;
    }

    const countryStillExists = countries.some(
      (country) => String(country.id) === String(selectedCountryCode)
    );

    if (!countryStillExists) {
      setSelectedCountryCode("");
      setSelectedServiceId("");
    }
  }, [countries, selectedCountryCode]);

  useEffect(() => {
    if (!selectedServiceId) {
      return;
    }

    const serviceStillExists = availableServices.some(
      (service) =>
        String(service.id || service.code || service.service || "") ===
        String(selectedServiceId)
    );

    if (!serviceStillExists) {
      setSelectedServiceId("");
    }
  }, [availableServices, selectedServiceId]);

  useEffect(() => {
    let cancelled = false;

    setLivePrice(null);
    setLiveStock(null);
    setPriceError("");

    if (!selectedCountry || !selectedService) {
      setPriceLoading(false);
      return undefined;
    }

    const timeoutId = window.setTimeout(async () => {
      try {
        setPriceLoading(true);

        const response = await catalogService.getPrice({
          server: selectedServer,
          country: selectedCountry.id,
          countryName:
            selectedCountry.eng ||
            selectedCountry.name ||
            selectedCountry.label ||
            "",
          service:
            selectedService.id || selectedService.code || selectedService.service,
          serviceName:
            selectedService.name ||
            selectedService.title ||
            selectedService.label ||
            "",
          operator: selectedService.preferredOperator || "any",
        });

        if (cancelled) return;

        const price = Number(response?.price);
        const stock = Number(response?.stock);

        if (!Number.isFinite(price) || price <= 0) {
          throw new Error("A live price is not available");
        }

        setLivePrice(price);
        setLiveStock(Number.isFinite(stock) ? stock : null);
      } catch (error) {
        if (cancelled) return;

        setLivePrice(null);
        setLiveStock(null);
        setPriceError(
          getChapsSmsMessage(
            error,
            "ChapsSms could not retrieve a live price right now. Try another server or try again."
          )
        );
      } finally {
        if (!cancelled) {
          setPriceLoading(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [selectedServer, selectedCountry, selectedService]);

  const checkOrderById = useCallback(async (orderId, { showToast = false } = {}) => {
    const normalizedOrderId = String(orderId || "").trim();

    if (
      !normalizedOrderId ||
      blockedPollingRef.current.has(normalizedOrderId) ||
      pollingInProgressRef.current.has(normalizedOrderId)
    ) {
      return null;
    }

    try {
      pollingInProgressRef.current.add(normalizedOrderId);

      const updatedOrder = await orderService.checkOrder(normalizedOrderId);

      if (!updatedOrder) {
        return null;
      }

      updateOrderRef.current?.(updatedOrder);

      const updatedId = String(getOrderId(updatedOrder) || normalizedOrderId);
      const updatedStatus = getOrderStatus(updatedOrder);

      if (
        updatedOrder?.refunded ||
        ["cancelled", "expired"].includes(updatedStatus)
      ) {
        await refreshWalletRef.current?.();
      }

      if (updatedOrder?.otpCode && !otpNotifiedRef.current.has(updatedId)) {
        otpNotifiedRef.current.add(updatedId);
        toast.success(`${getOrderServiceName(updatedOrder)} OTP received`);
      } else if (showToast) {
        toast.success("Order refreshed");
      }

      return updatedOrder;
    } catch (error) {
      const message = String(error?.message || "");
      const legacyOrderError =
        /Unsupported SMS server reference:\s*5sim/i.test(message) ||
        /Order validation failed:.*(?:server|providerCostNgn|sellingPrice)/i.test(
          message
        );

      if (legacyOrderError) {
        // A stale historical order slipped through the API result. Block it
        // permanently for this page session instead of hammering the backend
        // every five seconds.
        blockedPollingRef.current.add(normalizedOrderId);
        return null;
      }

      console.error(`Order ${normalizedOrderId} check failed:`, error);

      if (showToast) {
        toast.error(
          getChapsSmsMessage(
            error,
            "ChapsSms could not refresh this order right now."
          )
        );
      }

      return null;
    } finally {
      pollingInProgressRef.current.delete(normalizedOrderId);
    }
  }, []);

  // Poll every waiting activation independently. One order receiving an OTP no
  // longer stops the other active orders from being checked.
  useEffect(() => {
    if (!liveOrderIdsKey) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      const ids = liveOrderIdsKey.split("|").filter(Boolean);

      Promise.allSettled(
        ids.map((orderId) => checkOrderById(orderId, { showToast: false }))
      );
    }, POLLING_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [liveOrderIdsKey, checkOrderById]);

  // At 00:00 immediately ask the backend to reconcile/cancel/refund that exact
  // order. The backend remains the authority for the actual refund.
  useEffect(() => {
    for (const order of liveOrders) {
      const orderId = String(getOrderId(order) || "");

      if (!orderId || expiryCheckedRef.current.has(orderId)) {
        continue;
      }

      if (getRemainingSeconds(order, nowMs) > 0) {
        continue;
      }

      expiryCheckedRef.current.add(orderId);
      checkOrderById(orderId, { showToast: false });
    }
  }, [liveOrders, nowMs, checkOrderById]);

  function resetLivePrice() {
    setLivePrice(null);
    setLiveStock(null);
    setPriceError("");
    setPriceLoading(false);
  }

  function handleServerChange(server) {
    if (purchasing) return;

    setSelectedServer(server);
    setSelectedCountryCode("");
    setSelectedServiceId("");
    resetLivePrice();
  }

  function handleCountryChange(countryId) {
    setSelectedCountryCode(String(countryId || ""));
    setSelectedServiceId("");
    resetLivePrice();
  }

  function handleServiceChange(serviceId) {
    setSelectedServiceId(String(serviceId || ""));
    resetLivePrice();
  }

  function openPurchasePanel() {
    setShowPurchasePanel(true);

    window.requestAnimationFrame(() => {
      purchasePanelRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  async function handlePurchase() {
    if (purchasing) return;

    if (!selectedCountry) {
      toast.error("Select a country");
      return;
    }

    if (!selectedService) {
      toast.error("Select a service");
      return;
    }

    if (Number.isFinite(serviceStock) && serviceStock <= 0) {
      toast.error(
        "ChapsSms does not currently have numbers available for this selection."
      );
      return;
    }

    if (!Number.isFinite(estimatedPrice) || estimatedPrice <= 0) {
      toast.error("A valid live price is not available");
      return;
    }

    try {
      setPurchasing(true);

      const response = await createOrder({
        server: selectedServer,
        country: selectedCountry.id,
        countryName:
          selectedCountry.eng ||
          selectedCountry.name ||
          selectedCountry.label ||
          "",
        service:
          selectedService.id || selectedService.code || selectedService.service,
        serviceName:
          selectedService.name ||
          selectedService.title ||
          selectedService.label ||
          "",
        operator: selectedService.preferredOperator || "any",
      });

      if (!response?.order) {
        throw new Error("The server did not return the new order");
      }

      if (
        response.walletBalance !== undefined &&
        response.walletBalance !== null
      ) {
        updateWalletBalance(response.walletBalance);
      } else {
        await refreshWallet();
      }

      const newOrderId = String(getOrderId(response.order) || "");
      blockedPollingRef.current.delete(newOrderId);
      expiryCheckedRef.current.delete(newOrderId);
      otpNotifiedRef.current.delete(newOrderId);

      trackNumberPurchased({
        value: response?.order?.sellingPrice ?? response?.order?.price ?? estimatedPrice,
        currency: "NGN",
        orderId: newOrderId,
        serviceName:
          response?.order?.serviceName ||
          selectedService?.name ||
          selectedService?.title ||
          selectedService?.label ||
          "Virtual number",
      });

      toast.success("Number purchased successfully");

      // Collapse the buy form after purchase so the active-order area stays
      // compact. The customer can immediately tap “Buy another number”.
      setShowPurchasePanel(false);
      setSelectedServiceId("");
      resetLivePrice();
    } catch (error) {
      console.error("Purchase failed:", error);

      try {
        if (
          error?.data?.walletBalance !== undefined &&
          error?.data?.walletBalance !== null
        ) {
          updateWalletBalance(Number(error.data.walletBalance));
        }

        await refreshWallet();
      } catch (walletRefreshError) {
        console.error(
          "Wallet refresh after failed purchase also failed:",
          walletRefreshError
        );
      }

      toast.error(
        getChapsSmsMessage(
          error,
          "ChapsSms could not purchase this number right now."
        )
      );
    } finally {
      setPurchasing(false);
    }
  }

  async function refreshOrder(orderId) {
    const normalizedOrderId = String(orderId || "");

    if (!normalizedOrderId || refreshingOrderIds.has(normalizedOrderId)) {
      return;
    }

    setRefreshingOrderIds((current) => {
      const next = new Set(current);
      next.add(normalizedOrderId);
      return next;
    });

    try {
      await checkOrderById(normalizedOrderId, { showToast: true });
    } finally {
      setRefreshingOrderIds((current) => {
        const next = new Set(current);
        next.delete(normalizedOrderId);
        return next;
      });
    }
  }

  async function handleCancel(order) {
    const orderId = String(getOrderId(order) || "");

    if (!orderId || cancellingOrderIds.has(orderId)) {
      return;
    }

    const confirmed = window.confirm(
      "Cancel this order? A refund will only be issued after ChapsSms confirms the cancellation."
    );

    if (!confirmed) return;

    setCancellingOrderIds((current) => {
      const next = new Set(current);
      next.add(orderId);
      return next;
    });

    try {
      const response = await orderService.cancelOrder(orderId);

      if (!response?.order) {
        throw new Error("The server did not return the cancelled order");
      }

      updateOrderRef.current?.(response.order);

      if (
        response.walletBalance !== undefined &&
        response.walletBalance !== null
      ) {
        updateWalletBalance(Number(response.walletBalance));
      }

      await refreshWallet();

      toast.success(
        response.refunded
          ? "Order cancelled and wallet refunded"
          : "Order cancelled"
      );
    } catch (error) {
      console.error("Cancellation failed:", error);

      try {
        await refreshWallet();
      } catch {
        // Preserve the original cancellation error.
      }

      toast.error(
        getChapsSmsMessage(
          error,
          "ChapsSms could not cancel this order right now."
        )
      );
    } finally {
      setCancellingOrderIds((current) => {
        const next = new Set(current);
        next.delete(orderId);
        return next;
      });
    }
  }

  function dismissOrder(orderId) {
    const normalizedOrderId = String(orderId || "");

    if (!normalizedOrderId) return;

    setDismissedOrderIds((current) => {
      const next = new Set(current);
      next.add(normalizedOrderId);

      try {
        localStorage.setItem(DISMISSED_ORDERS_KEY, JSON.stringify([...next]));
      } catch {
        // Hiding still works for the current render if storage is unavailable.
      }

      return next;
    });
  }

  async function copyText(value, message) {
    if (!value) {
      toast.error("Nothing to copy");
      return;
    }

    try {
      await navigator.clipboard.writeText(String(value));
      toast.success(message);
    } catch {
      toast.error("Could not copy");
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1120px] overflow-x-hidden">
      <div className="mb-5 sm:mb-6">
        <h1 className="text-2xl font-black tracking-tight text-[var(--foreground)] sm:text-3xl">
          Receive <span className="text-blue-600">SMS</span>
        </h1>
        <p className="mt-2 text-sm text-[var(--muted-foreground)] sm:text-base">
          Buy numbers, keep multiple activations open, and receive each OTP independently.
        </p>
      </div>

      {(visibleOrders.length > 0 || ordersLoading) && (
        <section className="mb-5 sm:mb-6">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-[var(--foreground)] sm:text-xl">
                Active orders
                {liveOrders.length > 0 ? ` (${liveOrders.length})` : ""}
              </h2>
              <p className="mt-1 text-xs text-[var(--muted-foreground)] sm:text-sm">
                Every waiting order keeps its own 20-minute timer and 5-second OTP check.
              </p>
            </div>

            {liveOrders.length > 0 && (
              <button
                type="button"
                onClick={openPurchasePanel}
                className="hidden shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-xs font-black text-white transition hover:bg-blue-700 sm:flex"
              >
                <Plus size={15} />
                Buy another
              </button>
            )}
          </div>

          {ordersLoading && visibleOrders.length === 0 ? (
            <div className="flex min-h-28 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--card)]">
              <LoaderCircle className="animate-spin text-blue-600" size={24} />
            </div>
          ) : (
            <div className="grid min-w-0 gap-4 xl:grid-cols-2">
              {visibleOrders.map((order) => {
                const orderId = String(getOrderId(order) || "");

                return (
                  <CompactOrderCard
                    key={orderId}
                    order={order}
                    nowMs={nowMs}
                    refreshing={refreshingOrderIds.has(orderId)}
                    cancelling={cancellingOrderIds.has(orderId)}
                    onRefresh={refreshOrder}
                    onCancel={handleCancel}
                    onDismiss={dismissOrder}
                    onCopy={copyText}
                  />
                );
              })}
            </div>
          )}

          {liveOrders.length > 0 && !showPurchasePanel && (
            <button
              type="button"
              onClick={openPurchasePanel}
              className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-black text-white transition hover:bg-blue-700"
            >
              <Plus size={17} />
              Buy another number
            </button>
          )}
        </section>
      )}

      {shouldShowPurchasePanel && (
        <div
          ref={purchasePanelRef}
          className="grid min-w-0 items-stretch gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_310px]"
        >
          <section className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm sm:rounded-3xl sm:p-6 lg:p-8">
            <div className="flex items-start justify-between gap-3 sm:gap-4">
              <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent)] text-[var(--accent-foreground)]">
                  <MessageSquareText size={21} />
                </div>

                <div className="min-w-0">
                  <h2 className="text-lg font-black text-[var(--foreground)] sm:text-xl">
                    {liveOrders.length > 0 ? "Buy another number" : "Buy a number"}
                  </h2>

                  <div className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-1.5 shadow-sm">
                    <div className="relative grid grid-cols-2">
                      <div
                        aria-hidden="true"
                        className={`absolute inset-y-0 w-1/2 rounded-xl bg-blue-600 shadow-sm transition-transform duration-300 ease-out ${
                          selectedServer === "server2"
                            ? "translate-x-full"
                            : "translate-x-0"
                        }`}
                      />

                      {[
                        { id: "server1", label: "Server 1" },
                        { id: "server2", label: "Server 2" },
                      ].map((server) => {
                        const isActive = selectedServer === server.id;

                        return (
                          <button
                            key={server.id}
                            type="button"
                            onClick={() => handleServerChange(server.id)}
                            disabled={purchasing}
                            aria-pressed={isActive}
                            className={`relative z-10 min-h-11 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
                              isActive
                                ? "text-white"
                                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                            }`}
                          >
                            {server.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                    Select a country and service. Existing activations will keep running.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={reloadCatalog}
                disabled={catalogLoading}
                aria-label="Refresh live catalog"
                className="rounded-xl p-2 text-[var(--muted-foreground)] transition hover:bg-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-50"
              >
                <RefreshCw
                  size={17}
                  className={catalogLoading ? "animate-spin" : ""}
                />
              </button>
            </div>

            {catalogError && !countries.length && (
              <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/40">
                <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                  {getChapsSmsMessage(
                    catalogError,
                    "ChapsSms could not load the available countries and services. Please try again."
                  )}
                </p>
                <button
                  type="button"
                  onClick={reloadCatalog}
                  className="mt-3 text-sm font-bold text-red-700 underline dark:text-red-300"
                >
                  Try again
                </button>
              </div>
            )}

            {catalogLoading && !countries.length ? (
              <div className="flex min-h-72 items-center justify-center">
                <div className="text-center">
                  <LoaderCircle
                    className="mx-auto animate-spin text-blue-600"
                    size={30}
                  />
                  <p className="mt-3 text-sm text-[var(--muted-foreground)]">
                    Loading live countries and services...
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-6 space-y-5 sm:mt-7">
                <div>
                  <label className="mb-2 block text-sm font-bold text-[var(--foreground)]">
                    Country
                  </label>
                  <SearchableCountrySelect
                    countries={countries}
                    value={selectedCountryCode}
                    onChange={handleCountryChange}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-[var(--foreground)]">
                    Service
                  </label>
                  <SearchableServiceSelect
                    services={availableServices}
                    value={selectedServiceId}
                    onChange={handleServiceChange}
                    disabled={!selectedCountryCode}
                  />
                </div>

                <div className="flex flex-col gap-4 rounded-2xl bg-[var(--muted)] px-4 py-4 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                      Live price
                    </p>
                    <p className="mt-1 text-2xl font-black text-[var(--foreground)]">
                      {priceLoading
                        ? "Checking..."
                        : selectedService && estimatedPrice > 0
                          ? formatNaira(estimatedPrice)
                          : "—"}
                    </p>
                    {priceError && (
                      <p className="mt-1 max-w-xs text-xs font-semibold text-red-600">
                        {priceError}
                      </p>
                    )}
                  </div>

                  <div className="min-w-0 text-left min-[420px]:text-right">
                    <p className="truncate text-sm font-bold text-[var(--foreground)]">
                      {selectedCountry?.eng ||
                        selectedCountry?.name ||
                        selectedCountry?.label ||
                        "Select country"}
                    </p>
                    <p className="mt-1 truncate text-sm text-[var(--muted-foreground)]">
                      {selectedService?.name || "Select service"}
                    </p>
                    {selectedService && (
                      <p className="mt-1 text-xs font-semibold text-[var(--muted-foreground)]">
                        {Number.isFinite(serviceStock) && serviceStock > 0
                          ? `${serviceStock.toLocaleString()} available`
                          : "Availability checked at purchase"}
                      </p>
                    )}
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={handlePurchase}
                  disabled={
                    purchasing ||
                    catalogLoading ||
                    priceLoading ||
                    !selectedCountry ||
                    !serviceIsAvailable
                  }
                  className="h-12 w-full"
                >
                  {purchasing ? (
                    <>
                      <LoaderCircle className="animate-spin" size={18} />
                      Purchasing...
                    </>
                  ) : priceLoading ? (
                    <>
                      <LoaderCircle className="animate-spin" size={18} />
                      Checking price...
                    </>
                  ) : (
                    <>
                      <Phone size={18} />
                      Buy Number
                    </>
                  )}
                </Button>

                {liveOrders.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowPurchasePanel(false)}
                    className="w-full text-center text-xs font-bold text-[var(--muted-foreground)] underline underline-offset-4"
                  >
                    Hide purchase form
                  </button>
                )}
              </div>
            )}
          </section>

          <aside className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm sm:rounded-3xl sm:p-6">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
              Multiple orders
            </p>
            <div className="mt-6 space-y-6">
              {[
                "Buy one number and keep it waiting.",
                "Tap Buy another number for a second service.",
                "Each number checks for its own OTP every five seconds.",
                "Each order has its own 20-minute expiry and refund flow.",
              ].map((item, index) => (
                <div key={item} className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-black text-blue-600">
                    {index + 1}
                  </span>
                  <p className="pt-1 text-sm leading-6 text-[var(--muted-foreground)]">
                    {item}
                  </p>
                </div>
              ))}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
