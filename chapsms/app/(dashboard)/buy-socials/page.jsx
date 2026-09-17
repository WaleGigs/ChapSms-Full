"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ChevronDown,
  Copy,
  LoaderCircle,
  RefreshCw,
  Search,
  ShoppingCart,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

import { socialService } from "@/services/socialService";
import { useWallet } from "@/hooks/useWallet";

function formatNaira(value) {
  return `₦${Number(value || 0).toLocaleString("en-NG", {
    maximumFractionDigits: 0,
  })}`;
}

function getErrorCode(error) {
  return String(error?.code || error?.data?.code || error?.response?.data?.code || "")
    .trim()
    .toUpperCase();
}

function getErrorMessage(error) {
  const code = getErrorCode(error);
  const messages = {
    INSUFFICIENT_WALLET_BALANCE:
      "Your ChapsSms wallet balance is too low for this purchase.",
    SOCIAL_OUT_OF_STOCK: "This product is currently out of stock.",
    SOCIAL_PRODUCT_NOT_FOUND: "This product is no longer available.",
    SOCIAL_PURCHASE_REQUIRES_LIVE_MODE:
      "Buy Account & VPNs is temporarily unavailable while payment testing is enabled.",
    SOCIAL_PURCHASE_REVIEW_REQUIRED:
      "Your order is being verified. Please do not purchase the same product again.",
  };

  return (
    messages[code] ||
    error?.message ||
    error?.data?.message ||
    error?.response?.data?.message ||
    "ChapsSms could not complete this purchase."
  );
}

function cleanCategoryText(value) {
  return String(value || "Other")
    .normalize("NFKC")
    .replace(/\p{Cf}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function categoryKey(value) {
  return cleanCategoryText(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function customerCategoryName(value) {
  const raw = cleanCategoryText(value);
  const key = categoryKey(raw);

  if (key.includes("LOGGSPLUG") || key.includes("LOGSPLUG")) {
    return "LOGS and UPDATE 0.2";
  }

  if (
    [
      "TEXTINGAPP",
      "TEXTINGAPPS",
      "USTEXTINGAPP",
      "USTEXTINGAPPS",
      "USATEXTINGAPP",
      "USATEXTINGAPPS",
    ].includes(key)
  ) {
    return "Googlevoice and Textplus";
  }

  return raw;
}

function sortCategoriesForCustomer(values) {
  const unique = Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => customerCategoryName(value))
        .filter(Boolean)
    )
  );

  const is711 = (value) => categoryKey(value).startsWith("711PROXY");
  const isNumeric = (value) => /^\d/.test(categoryKey(value));
  const byName = (a, b) =>
    customerCategoryName(a).localeCompare(customerCategoryName(b), undefined, {
      numeric: true,
      sensitivity: "base",
    });

  const alphabetical = unique
    .filter((value) => !isNumeric(value) && !is711(value))
    .sort(byName);

  const otherNumeric = unique
    .filter((value) => isNumeric(value) && !is711(value))
    .sort(byName);

  const proxy711 = unique
    .filter(is711)
    .sort(byName);

  return [...alphabetical, ...otherNumeric, ...proxy711];
}

function networkType(product) {
  const text = `${product?.name || ""} ${product?.category || ""}`.toLowerCase();
  if (text.includes("ipvanish") || text.includes("ip vanish")) return "ipvanish";
  if (text.includes("nord vpn") || text.includes("nordvpn")) return "nordvpn";
  if (text.includes("expressvpn") || text.includes("express vpn")) return "expressvpn";
  if (text.includes("surfshark")) return "surfshark";
  if (text.includes("proton vpn") || text.includes("protonvpn")) return "protonvpn";
  if (text.includes("cyberghost")) return "cyberghost";
  if (text.includes("windscribe")) return "windscribe";
  if (text.includes("facebook")) return "facebook";
  if (text.includes("twitter") || /(^|\s)x(\s|$)/.test(text)) return "x";
  if (text.includes("instagram")) return "instagram";
  if (text.includes("tiktok")) return "tiktok";
  if (text.includes("telegram")) return "telegram";
  if (text.includes("discord")) return "discord";
  if (text.includes("reddit")) return "reddit";
  if (text.includes("google") || text.includes("gmail")) return "google";
  if (text.includes("proxy")) return "proxy";
  return "generic";
}

const AUTO_BRAND_ASSETS = {
  facebook: ["https://cdn.simpleicons.org/facebook/ffffff", "bg-[#1877F2]", "Facebook"],
  x: ["https://cdn.simpleicons.org/x/ffffff", "bg-black", "X"],
  instagram: ["https://cdn.simpleicons.org/instagram/ffffff", "bg-fuchsia-600", "Instagram"],
  tiktok: ["https://cdn.simpleicons.org/tiktok/ffffff", "bg-black", "TikTok"],
  telegram: ["https://cdn.simpleicons.org/telegram/ffffff", "bg-sky-500", "Telegram"],
  discord: ["https://cdn.simpleicons.org/discord/ffffff", "bg-indigo-600", "Discord"],
  reddit: ["https://cdn.simpleicons.org/reddit/ffffff", "bg-orange-600", "Reddit"],
  google: ["https://cdn.simpleicons.org/google/4285F4", "bg-white", "Google"],
  ipvanish: ["https://www.google.com/s2/favicons?domain=ipvanish.com&sz=128", "bg-slate-950", "IPVanish"],
  nordvpn: ["https://www.google.com/s2/favicons?domain=nordvpn.com&sz=128", "bg-slate-950", "NordVPN"],
  expressvpn: ["https://www.google.com/s2/favicons?domain=expressvpn.com&sz=128", "bg-slate-950", "ExpressVPN"],
  surfshark: ["https://www.google.com/s2/favicons?domain=surfshark.com&sz=128", "bg-slate-950", "Surfshark"],
  protonvpn: ["https://www.google.com/s2/favicons?domain=protonvpn.com&sz=128", "bg-slate-950", "Proton VPN"],
  cyberghost: ["https://www.google.com/s2/favicons?domain=cyberghostvpn.com&sz=128", "bg-slate-950", "CyberGhost"],
  windscribe: ["https://www.google.com/s2/favicons?domain=windscribe.com&sz=128", "bg-slate-950", "Windscribe"],
};

function ProductLogo({ product }) {
  const [customFailed, setCustomFailed] = useState(false);
  const [brandFailed, setBrandFailed] = useState(false);
  const type = networkType(product);
  const brand = AUTO_BRAND_ASSETS[type];

  if (product?.logoUrl && !customFailed) {
    return (
      <div className="flex h-[50px] w-[50px] shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--background)] p-1.5 sm:h-14 sm:w-14">
        <img
          src={product.logoUrl}
          alt={`${product.name || "Product"} logo`}
          className="max-h-full max-w-full rounded-lg object-contain"
          onError={() => setCustomFailed(true)}
        />
      </div>
    );
  }

  if (brand && !brandFailed) {
    return (
      <div className={`flex h-[50px] w-[50px] shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--border)] p-2 sm:h-14 sm:w-14 ${brand[1]}`}>
        <img
          src={brand[0]}
          alt={brand[2]}
          className="h-full w-full object-contain"
          onError={() => setBrandFailed(true)}
        />
      </div>
    );
  }

  const initial = String(product?.name || "P").trim().slice(0, 1).toUpperCase();
  return (
    <div className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-xl bg-blue-600 text-lg font-black text-white sm:h-14 sm:w-14">
      {type === "proxy" ? "IP" : initial}
    </div>
  );
}

function DescriptionContent({ value }) {
  const text = String(value || "").replace(/\r\n/g, "\n");
  if (!text.trim()) return <>No extra usage note has been added for this product yet.</>;

  return text.split(/(https?:\/\/[^\s]+)/g).map((part, index) => {
    if (/^https?:\/\/[^\s]+$/.test(part)) {
      return (
        <a
          key={`${part}-${index}`}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all text-blue-500 underline underline-offset-2 hover:text-blue-400"
        >
          {part}
        </a>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

function ProductCard({ product, onBuy }) {
  const [descriptionOpen, setDescriptionOpen] = useState(false);

  return (
    <article className="min-w-0 rounded-[20px] border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm sm:p-5">
      <ProductLogo product={product} />
      <div className="mt-3 min-w-0 sm:mt-4">
        <h3 className="break-words text-[14px] font-black uppercase leading-[1.3] text-[var(--foreground)] min-[390px]:text-[15px] sm:text-lg">
          {product.name}
        </h3>
        <p className="mt-1.5 break-words text-[10px] font-semibold uppercase leading-4 tracking-[0.04em] text-[var(--muted-foreground)] min-[390px]:text-[11px] sm:text-xs">
          {customerCategoryName(product.category)}
        </p>
      </div>

      <button
        type="button"
        onClick={() => setDescriptionOpen((value) => !value)}
        className="mt-4 flex items-center gap-1.5 text-[12px] font-medium text-[var(--muted-foreground)] min-[390px]:text-[13px] sm:text-sm"
      >
        <ChevronDown size={15} className={`transition ${descriptionOpen ? "rotate-180" : ""}`} />
        {descriptionOpen ? "Hide description" : "View description"}
      </button>

      {descriptionOpen ? (
        <div className="mt-3 max-h-[220px] overflow-y-auto overscroll-contain whitespace-pre-wrap break-words rounded-xl border border-[var(--border)] bg-[var(--background)] p-3 text-[12px] leading-[1.65] text-[var(--foreground)] [overflow-wrap:anywhere] sm:max-h-[250px] sm:p-4 sm:text-sm sm:leading-6">
          <DescriptionContent value={product.description} />
        </div>
      ) : null}

      <p className={`mt-4 text-[13px] font-medium sm:text-base ${product.inStock ? "text-emerald-500" : "text-rose-500"}`}>
        {product.inStock
          ? `${Number(product.stock || 0).toLocaleString("en-NG")} in stock`
          : "Out of Stock"}
      </p>

      <p className="mt-3 text-[24px] font-black leading-none text-blue-600 sm:text-[28px]">
        {formatNaira(product.price)}
      </p>

      <button
        type="button"
        onClick={() => onBuy(product)}
        disabled={!product.inStock}
        className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--background)] text-[13px] font-black text-[var(--foreground)] transition hover:bg-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-45 sm:h-14 sm:text-[15px]"
      >
        <ShoppingCart size={17} />
        {product.inStock ? "Buy Now" : "Out of Stock"}
      </button>
    </article>
  );
}

function PurchaseModal({ product, quantity, setQuantity, purchasing, walletBalance, onClose, onPay }) {
  if (!product) return null;

  const maxQuantity = Math.max(1, Math.min(50, Number(product.stock || 1)));
  const safeQuantity = Math.min(maxQuantity, Math.max(1, Number.parseInt(quantity, 10) || 1));
  const unitPrice = Number(product.price || 0);
  const subtotal = unitPrice * safeQuantity;
  const balance = Number(walletBalance || 0);
  const insufficient = balance < subtotal;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-2.5 backdrop-blur-sm sm:items-center sm:p-6">
      <button type="button" onClick={purchasing ? undefined : onClose} aria-label="Close purchase" className="absolute inset-0" />

      <section className="relative z-10 max-h-[calc(100dvh-20px)] w-full max-w-[540px] overflow-y-auto rounded-t-[22px] border border-[var(--border)] bg-[var(--card)] p-5 pb-[max(20px,env(safe-area-inset-bottom))] text-[var(--foreground)] shadow-2xl sm:max-h-[90vh] sm:rounded-[24px] sm:p-8">
        <button type="button" onClick={onClose} disabled={purchasing} className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-xl text-[var(--muted-foreground)] hover:bg-[var(--muted)]" aria-label="Close">
          <X size={20} />
        </button>

        <h2 className="pr-10 text-xl font-black uppercase leading-tight sm:text-2xl">{product.name}</h2>
        <p className="mt-2 text-sm font-medium uppercase text-[var(--muted-foreground)]">{customerCategoryName(product.category)}</p>

        <div className="mt-7 space-y-5 text-sm sm:text-base">
          <div className="flex items-center justify-between gap-4">
            <span className="text-[var(--muted-foreground)]">Price per unit</span>
            <strong>{formatNaira(unitPrice)}</strong>
          </div>

          <div className="grid grid-cols-[1fr_auto] items-center gap-4">
            <span className="text-[var(--muted-foreground)]">Quantity</span>
            <div className="grid grid-cols-[48px_84px_48px] gap-2">
              <button type="button" disabled={purchasing || safeQuantity <= 1} onClick={() => setQuantity(Math.max(1, safeQuantity - 1))} className="h-11 rounded-xl border border-[var(--border)] bg-[var(--background)] font-bold disabled:opacity-35">−</button>
              <input type="number" min="1" max={maxQuantity} value={quantity} disabled={purchasing} onChange={(event) => setQuantity(Math.max(1, Math.min(maxQuantity, Number.parseInt(event.target.value, 10) || 1)))} className="h-11 min-w-0 rounded-xl border border-[var(--border)] bg-[var(--background)] text-center font-bold outline-none focus:border-blue-500" />
              <button type="button" disabled={purchasing || safeQuantity >= maxQuantity} onClick={() => setQuantity(Math.min(maxQuantity, safeQuantity + 1))} className="h-11 rounded-xl border border-[var(--border)] bg-[var(--background)] font-bold disabled:opacity-35">+</button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="text-[var(--muted-foreground)]">Subtotal</span>
            <strong>{formatNaira(subtotal)}</strong>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4">
            <span>Total <span className="text-xs text-[var(--muted-foreground)]">(You will be charged)</span></span>
            <strong className="text-xl text-rose-400">{formatNaira(subtotal)}</strong>
          </div>

          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[var(--muted-foreground)]">Wallet Balance</p>
              <p className={`mt-2 text-xl font-black ${insufficient ? "text-rose-400" : "text-[var(--foreground)]"}`}>{formatNaira(balance)}</p>
            </div>
            {insufficient ? <span className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-400">Balance Insufficient</span> : null}
          </div>
        </div>

        <p className="mt-5 text-sm leading-6 text-[var(--muted-foreground)]">Deducted from your wallet. Credentials are delivered instantly.</p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button type="button" onClick={onClose} disabled={purchasing} className="h-14 rounded-2xl border border-[var(--border)] font-bold disabled:opacity-50">Cancel</button>
          {insufficient ? (
            <Link href="/wallet" className="flex min-h-14 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--background)] px-3 text-center text-sm font-black">Add funds to buy</Link>
          ) : (
            <button type="button" onClick={() => onPay(safeQuantity)} disabled={purchasing} className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--background)] px-3 text-sm font-black disabled:opacity-60">
              {purchasing ? <><LoaderCircle className="animate-spin" size={19} /> Processing...</> : `Pay ${formatNaira(subtotal)}`}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

function DeliveredModal({ order, onDone }) {
  if (!order) return null;
  const items = Array.isArray(order.deliveredItems) ? order.deliveredItems : [];

  async function copy(value) {
    try {
      await navigator.clipboard.writeText(String(value || ""));
      toast.success("Copied");
    } catch {
      toast.error("Unable to copy");
    }
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center sm:p-6">
      <section className="max-h-[calc(100dvh-24px)] w-full max-w-[540px] overflow-y-auto rounded-t-[24px] border border-[var(--border)] bg-[var(--card)] p-5 text-[var(--foreground)] shadow-2xl sm:rounded-[24px] sm:p-8">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="text-emerald-500" size={26} />
          <h2 className="text-2xl font-black">Delivered</h2>
        </div>
        <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">{order.productName} × {order.quantity}. Also saved under History → Account & VPN.</p>

        <div className="mt-5 space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4 text-sm">
          <div className="flex justify-between gap-3"><span className="text-[var(--muted-foreground)]">ORDER ID</span><strong className="break-all text-right">#{String(order.id || "").slice(-8).toUpperCase()}</strong></div>
          <div className="flex justify-between gap-3"><span className="text-[var(--muted-foreground)]">QUANTITY</span><strong>{order.quantity}</strong></div>
          <div className="flex justify-between gap-3"><span className="text-[var(--muted-foreground)]">AMOUNT</span><strong>{formatNaira(order.total)}</strong></div>
          <div className="flex justify-between gap-3"><span className="text-[var(--muted-foreground)]">STATUS</span><span className="rounded-lg bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-500">Completed</span></div>
        </div>

        {items.length ? (
          <div className="mt-5">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Delivered items</p>
            <div className="mt-3 space-y-3">
              {items.map((item, index) => (
                <div key={`${order.id}-${index}`} className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4">
                  <p className="whitespace-pre-wrap break-all font-mono text-sm leading-6">{item}</p>
                  <button type="button" onClick={() => copy(item)} className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--border)] px-3 text-sm font-bold"><Copy size={15} /> Copy</button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <button type="button" onClick={onDone} className="mt-6 h-14 w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] font-black">Done</button>
      </section>
    </div>
  );
}

export default function BuySocialsPage() {
  const { wallet, refreshWallet } = useWallet();
  const [products, setProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [deliveredOrder, setDeliveredOrder] = useState(null);

  const loadCatalog = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setCatalogLoading(true);
      const response = await socialService.getCatalog();

      /*
       * Normalize customer-facing category names as soon as the catalog arrives.
       * This prevents raw provider names from leaking anywhere else on this page
       * and makes filtering/sorting use the same customer-visible category value.
       */
      const normalizedProducts = (
        Array.isArray(response.products) ? response.products : []
      ).map((product) => ({
        ...product,
        category: customerCategoryName(product?.category),
      }));

      // Only products are stored. Category order is derived from products below,
      // so the provider's category order can never leak into the UI.
      setProducts(normalizedProducts);
    } catch (error) {
      if (!silent) toast.error(getErrorMessage(error));
    } finally {
      if (!silent) setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCatalog();
    const timer = window.setInterval(() => loadCatalog({ silent: true }), 15000);
    return () => window.clearInterval(timer);
  }, [loadCatalog]);

  const sortedCategories = useMemo(
    () =>
      sortCategoriesForCustomer(
        products.map((product) => product.category)
      ),
    [products]
  );

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter((product) => {
      if (selectedCategory !== "all" && product.category !== selectedCategory) return false;
      if (!query) return true;
      return `${product.name || ""} ${customerCategoryName(product.category)}`.toLowerCase().includes(query);
    });
  }, [products, selectedCategory, search]);

  const groupedProducts = useMemo(() => {
    const map = new Map();
    for (const product of filteredProducts) {
      const category = product.category || "Other";
      if (!map.has(category)) map.set(category, []);
      map.get(category).push(product);
    }

    const orderedCategories = sortCategoriesForCustomer(
      Array.from(map.keys())
    );

    return orderedCategories.map((category) => [
      category,
      [...(map.get(category) || [])].sort(
        (a, b) =>
          Number(a.price || 0) - Number(b.price || 0) ||
          String(a.name || "").localeCompare(String(b.name || ""), undefined, {
            numeric: true,
            sensitivity: "base",
          })
      ),
    ]);
  }, [filteredProducts]);

  async function refreshCatalog() {
    if (refreshing) return;
    try {
      setRefreshing(true);
      await loadCatalog({ silent: true });
      toast.success("Products refreshed");
    } finally {
      setRefreshing(false);
    }
  }

  async function handlePurchase(safeQuantity) {
    if (!selectedProduct || purchasing) return;

    try {
      setPurchasing(true);
      const response = await socialService.buyProduct({ productId: selectedProduct.id, quantity: safeQuantity });
      await refreshWallet?.();
      await loadCatalog({ silent: true });

      if (response?.reviewRequired) {
        toast("Purchase is being verified. Do not order the same item again.");
        setSelectedProduct(null);
      } else if (response?.order) {
        setSelectedProduct(null);
        setDeliveredOrder(response.order);
      } else {
        toast.success("Purchase completed. Check Account & VPN History for your credentials.");
        setSelectedProduct(null);
      }
      setQuantity(1);
    } catch (error) {
      const code = getErrorCode(error);
      try { await refreshWallet?.(); } catch {}
      if (code === "SOCIAL_OUT_OF_STOCK" || /out of stock/i.test(getErrorMessage(error))) {
        setProducts((current) => current.map((item) => item.id === selectedProduct?.id ? { ...item, stock: 0, inStock: false } : item));
        setSelectedProduct(null);
        await loadCatalog({ silent: true });
      }
      toast.error(getErrorMessage(error));
    } finally {
      setPurchasing(false);
    }
  }

  return (
    <div className="mx-auto min-w-0 w-full max-w-[1080px] overflow-x-hidden text-[var(--foreground)]">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-[26px] font-black leading-tight tracking-tight min-[390px]:text-[28px] sm:text-4xl">Buysssssss Account & VPNs</h1>
        <p className="mt-2.5 max-w-xl text-[13px] leading-[22px] text-[var(--muted-foreground)] sm:text-base sm:leading-7">Instant delivery. Credentials appear right after payment from your NGN wallet.</p>
        <button type="button" onClick={refreshCatalog} disabled={refreshing} className="mt-4 flex h-11 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 text-[13px] font-black transition hover:bg-[var(--muted)] disabled:opacity-50 sm:h-12 sm:px-5 sm:text-sm">
          <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      <div className="space-y-3">
        <div className="relative">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search accounts, VPNs & tools..." className="h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] pl-10 pr-3.5 text-[14px] font-medium text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)] focus:border-blue-500 sm:h-14 sm:text-base" />
        </div>
        <div className="relative">
          <select
            value={selectedCategory}
            onChange={(event) => setSelectedCategory(event.target.value)}
            className="h-12 w-full appearance-none rounded-xl border border-[var(--border)] bg-[var(--card)] px-3.5 pr-11 text-[14px] font-semibold text-[var(--foreground)] outline-none focus:border-blue-500 [color-scheme:light] dark:[color-scheme:dark] sm:h-14 sm:px-4 sm:pr-12 sm:text-base"
          >
            <option value="all">All</option>
            {sortedCategories.map((category) => (
              <option key={category} value={category}>
                {customerCategoryName(category)}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden="true"
            size={18}
            className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[var(--foreground)]"
          />
        </div>
      </div>

      <p className="mt-5 text-[13px] text-[var(--muted-foreground)] sm:mt-6 sm:text-base">Showing {filteredProducts.length.toLocaleString("en-NG")} products</p>

      {catalogLoading ? (
        <div className="flex min-h-[260px] items-center justify-center"><LoaderCircle className="animate-spin text-blue-500" size={30} /></div>
      ) : groupedProducts.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-[var(--border)] p-10 text-center text-[var(--muted-foreground)]">No products found.</div>
      ) : (
        <div className="mt-6 space-y-8 sm:mt-8 sm:space-y-10">
          {groupedProducts.map(([category, categoryProducts]) => (
            <section key={category}>
              <h2 className="break-words border-b border-[var(--border)] pb-3 text-[16px] font-black uppercase leading-[1.25] tracking-[0.025em] text-[var(--foreground)] sm:pb-4 sm:text-2xl">{customerCategoryName(category)}</h2>
              <div className="mt-4 grid min-w-0 gap-4 sm:mt-5 sm:gap-5 lg:grid-cols-2">
                {categoryProducts.map((product) => <ProductCard key={product.id} product={product} onBuy={(item) => { setSelectedProduct(item); setQuantity(1); }} />)}
              </div>
            </section>
          ))}
        </div>
      )}

      <PurchaseModal product={selectedProduct} quantity={quantity} setQuantity={setQuantity} purchasing={purchasing} walletBalance={wallet?.balance} onClose={() => { if (!purchasing) { setSelectedProduct(null); setQuantity(1); } }} onPay={handlePurchase} />
      <DeliveredModal order={deliveredOrder} onDone={() => setDeliveredOrder(null)} />
    </div>
  );
}
