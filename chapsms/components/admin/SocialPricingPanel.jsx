"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Edit3, LoaderCircle, RefreshCw, Save, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

import { socialService } from "@/services/socialService";

const PROVIDERS = [
  { id: "loggsplug", label: "LoggsPlug" },
  { id: "sameeha", label: "SameehaSocialHub" },
];

function formatNaira(value) {
  return `₦${Number(value || 0).toLocaleString("en-NG", {
    maximumFractionDigits: 0,
  })}`;
}

function round100(value) {
  return Math.ceil(Number(value || 0) / 100) * 100;
}

export default function SocialPricingPanel() {
  const [provider, setProvider] = useState("loggsplug");
  const [catalog, setCatalog] = useState({ categories: [], products: [] });
  const [pricing, setPricing] = useState({ globals: {}, productRules: [] });
  const [loading, setLoading] = useState(true);
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [globalMarkup, setGlobalMarkup] = useState("100");
  const [minimumSellingPrice, setMinimumSellingPrice] = useState("0");
  const [category, setCategory] = useState("");
  const [providerProductId, setProviderProductId] = useState("");
  const [mode, setMode] = useState("markup");
  const [markupPercent, setMarkupPercent] = useState("100");
  const [targetSellingPrice, setTargetSellingPrice] = useState("");
  const [fixedSellingPrice, setFixedSellingPrice] = useState("");
  const [note, setNote] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [catalogResponse, pricingResponse] = await Promise.all([
        socialService.getAdminCatalog(),
        socialService.getAdminPricing(),
      ]);
      setCatalog(catalogResponse);
      setPricing({
        globals: pricingResponse?.globals || {},
        productRules: Array.isArray(pricingResponse?.productRules)
          ? pricingResponse.productRules
          : [],
      });
    } catch (error) {
      toast.error(error?.message || "Unable to load account & VPN pricing");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const globalRule = pricing.globals?.[provider];
    setGlobalMarkup(String(globalRule?.markupPercent ?? 100));
    setMinimumSellingPrice(String(globalRule?.minimumSellingPrice ?? 0));
    setCategory("");
    setProviderProductId("");
    setMode("markup");
    setMarkupPercent("100");
    setTargetSellingPrice("");
    setFixedSellingPrice("");
    setNote("");
    setLogoUrl("");
  }, [provider, pricing.globals]);

  const providerProducts = useMemo(
    () =>
      (catalog.products || []).filter(
        (item) => item.provider === provider
      ),
    [catalog.products, provider]
  );

  const providerCategories = useMemo(
    () =>
      [...new Set(providerProducts.map((item) => item.category).filter(Boolean))].sort((a, b) => {
        const aNum = /^\d/.test(String(a).trim());
        const bNum = /^\d/.test(String(b).trim());
        if (aNum !== bNum) return aNum ? 1 : -1;
        return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
      }),
    [providerProducts]
  );

  const categoryProducts = useMemo(
    () =>
      providerProducts
        .filter((item) => !category || item.category === category)
        .sort((a, b) =>
          Number(a.providerCostNgn || 0) - Number(b.providerCostNgn || 0) ||
          String(a.name || "").localeCompare(String(b.name || ""))
        ),
    [providerProducts, category]
  );

  const selectedProduct = useMemo(
    () =>
      providerProducts.find(
        (item) => String(item.providerProductId) === String(providerProductId)
      ) || null,
    [providerProducts, providerProductId]
  );

  const selectedSavedRule = useMemo(
    () =>
      (pricing.productRules || []).find(
        (rule) =>
          rule.provider === provider &&
          String(rule.providerProductId) === String(providerProductId)
      ) || null,
    [pricing.productRules, provider, providerProductId]
  );

  useEffect(() => {
    if (!providerProductId) {
      setMode("markup");
      setMarkupPercent("100");
      setTargetSellingPrice("");
      setFixedSellingPrice("");
      setNote("");
      setLogoUrl("");
      return;
    }

    if (selectedSavedRule) {
      setMode(selectedSavedRule.pricingMode || "markup");
      setMarkupPercent(String(selectedSavedRule.markupPercent ?? 0));
      setTargetSellingPrice("");
      setFixedSellingPrice(String(selectedSavedRule.fixedSellingPrice || ""));
      setNote(selectedSavedRule.note || "");
      setLogoUrl(selectedSavedRule.logoUrl || "");
    } else {
      setMode("markup");
      setMarkupPercent(String(pricing.globals?.[provider]?.markupPercent ?? 100));
      setTargetSellingPrice("");
      setFixedSellingPrice("");
      setNote("");
      setLogoUrl("");
    }
  }, [providerProductId, selectedSavedRule, provider, pricing.globals]);

  const previewPrice = useMemo(() => {
    if (!selectedProduct) return 0;
    const cost = Number(selectedProduct.providerCostNgn || 0);
    const minimum = Number(minimumSellingPrice || 0);

    if (mode === "fixed") {
      return Math.max(Number(fixedSellingPrice || 0), minimum);
    }

    return Math.max(
      round100(cost * (1 + Number(markupPercent || 0) / 100)),
      minimum
    );
  }, [selectedProduct, mode, fixedSellingPrice, markupPercent, minimumSellingPrice]);

  function handleTargetSellingPrice(value) {
    setTargetSellingPrice(value);

    if (!selectedProduct || value === "") return;

    const cost = Number(selectedProduct.providerCostNgn || 0);
    const target = Number(value);

    if (!Number.isFinite(cost) || cost <= 0 || !Number.isFinite(target) || target < 0) {
      return;
    }

    const markup = Math.max(0, ((target - cost) / cost) * 100);
    setMode("markup");
    setMarkupPercent(String(Number(markup.toFixed(2))));
  }

  async function saveGlobal() {
    try {
      setSavingGlobal(true);
      await socialService.saveGlobalPricing({
        provider,
        markupPercent: Number(globalMarkup || 0),
        minimumSellingPrice: Number(minimumSellingPrice || 0),
      });
      toast.success("Global account & VPN markup saved");
      await load();
    } catch (error) {
      toast.error(error?.message || "Unable to save markup");
    } finally {
      setSavingGlobal(false);
    }
  }

  async function saveProductRule({ pricingEnabled = true } = {}) {
    if (!selectedProduct) {
      toast.error("Choose a product");
      return;
    }

    try {
      setSavingProduct(true);
      await socialService.saveProductRule({
        provider,
        providerProductId: selectedProduct.providerProductId,
        productName: selectedProduct.name,
        category: selectedProduct.category,
        pricingEnabled,
        pricingMode: mode,
        markupPercent: Number(markupPercent || 0),
        fixedSellingPrice: Number(fixedSellingPrice || 0),
        note,
        logoUrl,
      });
      toast.success("Account & VPN product rule saved");
      await load();
    } catch (error) {
      toast.error(error?.message || "Unable to save product rule");
    } finally {
      setSavingProduct(false);
    }
  }

  function editRule(rule) {
    setCategory(rule.category || "");
    setProviderProductId(String(rule.providerProductId || ""));

    window.setTimeout(() => {
      document
        .getElementById("account-vpn-product-editor")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    }, 0);
  }

  async function deleteRule(rule) {
    try {
      await socialService.deleteProductRule(rule.provider, rule.providerProductId);
      toast.success("Override removed");
      if (
        provider === rule.provider &&
        String(providerProductId) === String(rule.providerProductId)
      ) {
        setProviderProductId("");
      }
      await load();
    } catch (error) {
      toast.error(error?.message || "Unable to remove override");
    }
  }

  async function refresh() {
    try {
      setRefreshing(true);
      await socialService.refreshCatalog();
      await load();
      toast.success("Account & VPN catalog refreshed");
    } catch (error) {
      toast.error(error?.message || "Unable to refresh account & VPN catalog");
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center rounded-3xl border border-[var(--border)] bg-[var(--card)]">
        <LoaderCircle className="animate-spin text-blue-500" size={28} />
      </div>
    );
  }

  const savedRows = (pricing.productRules || []).filter(
    (rule) => rule.provider === provider
  );

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm sm:p-6">
        <h2 className="text-xl font-black">Pricing Accounts & VPNs</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted-foreground)]">
          One global markup per source. Customer price is reseller cost plus your markup, rounded up to the next ₦100 and floored at your minimum price. Pick a product below to override it.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl bg-[var(--muted)] p-1.5 sm:max-w-md">
          {PROVIDERS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setProvider(item.id)}
              className={`min-h-11 rounded-xl px-3 text-sm font-black transition ${
                provider === item.id
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-bold">
            Global markup (%)
            <input
              type="number"
              min="0"
              value={globalMarkup}
              onChange={(event) => setGlobalMarkup(event.target.value)}
              className="mt-2 h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 outline-none focus:border-blue-500"
            />
          </label>

          <label className="text-sm font-bold">
            Minimum selling price (₦)
            <input
              type="number"
              min="0"
              value={minimumSellingPrice}
              onChange={(event) => setMinimumSellingPrice(event.target.value)}
              className="mt-2 h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 outline-none focus:border-blue-500"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={saveGlobal}
            disabled={savingGlobal}
            className="flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white disabled:opacity-50"
          >
            {savingGlobal ? <LoaderCircle className="animate-spin" size={17} /> : <Save size={17} />}
            Save markup
          </button>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="flex h-11 items-center gap-2 rounded-xl border border-[var(--border)] px-5 text-sm font-black"
          >
            <RefreshCw size={17} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </section>

      <section id="account-vpn-product-editor" className="scroll-mt-24 rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm sm:p-6">
        <h2 className="text-xl font-black">Per-product override ({PROVIDERS.find((item) => item.id === provider)?.label})</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
          Category → product → your price. This beats the global markup for that product only. Delete the saved row to fall back to global pricing.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-bold">
            Category
            <select
              value={category}
              onChange={(event) => {
                setCategory(event.target.value);
                setProviderProductId("");
              }}
              className="mt-2 h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 outline-none"
            >
              <option value="">All categories</option>
              {providerCategories.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>

          <label className="text-sm font-bold">
            Product
            <select
              value={providerProductId}
              onChange={(event) => setProviderProductId(event.target.value)}
              className="mt-2 h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 outline-none"
            >
              <option value="">Choose product</option>
              {categoryProducts.map((item) => (
                <option key={`${item.provider}:${item.providerProductId}`} value={item.providerProductId}>
                  {item.name} · {formatNaira(item.providerCostNgn)} cost
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-bold">
            Mode
            <select
              value={mode}
              onChange={(event) => setMode(event.target.value)}
              className="mt-2 h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 outline-none"
            >
              <option value="markup">Markup %</option>
              <option value="fixed">Fixed selling price</option>
            </select>
          </label>

          {mode === "markup" ? (
            <>
              <label className="text-sm font-bold">
                Markup (%)
                <input
                  type="number"
                  min="0"
                  value={markupPercent}
                  onChange={(event) => {
                    setMarkupPercent(event.target.value);
                    setTargetSellingPrice("");
                  }}
                  className="mt-2 h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 outline-none"
                />
              </label>

              <label className="text-sm font-bold md:col-span-2">
                Or type a target sell price (₦) → auto-fills markup
                <input
                  type="number"
                  min="0"
                  value={targetSellingPrice}
                  onChange={(event) => handleTargetSellingPrice(event.target.value)}
                  placeholder="e.g. 6000"
                  className="mt-2 h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 outline-none focus:border-blue-500"
                />
              </label>
            </>
          ) : (
            <label className="text-sm font-bold">
              Selling price (₦)
              <input
                type="number"
                min="0"
                value={fixedSellingPrice}
                onChange={(event) => setFixedSellingPrice(event.target.value)}
                className="mt-2 h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 outline-none"
              />
            </label>
          )}
        </div>

        {selectedProduct ? (
          <div className="mt-5 grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--muted)] p-4 sm:grid-cols-3">
            <div><p className="text-xs text-[var(--muted-foreground)]">Reseller cost</p><p className="mt-1 font-black">{formatNaira(selectedProduct.providerCostNgn)}</p></div>
            <div><p className="text-xs text-[var(--muted-foreground)]">Customer price</p><p className="mt-1 font-black text-blue-500">{formatNaira(previewPrice)}</p></div>
            <div><p className="text-xs text-[var(--muted-foreground)]">Expected profit</p><p className="mt-1 font-black">{formatNaira(Math.max(0, previewPrice - Number(selectedProduct.providerCostNgn || 0)))}</p></div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => saveProductRule({ pricingEnabled: true })}
          disabled={!selectedProduct || savingProduct}
          className="mt-5 flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white disabled:opacity-50"
        >
          {savingProduct ? <LoaderCircle className="animate-spin" size={17} /> : <Save size={17} />}
          Save override
        </button>
      </section>

      <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm sm:p-6">
        <h2 className="text-xl font-black">Product note ({PROVIDERS.find((item) => item.id === provider)?.label})</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
          Login rules, usage notes, and card logo for the picked product. This content is shown to customers. Logo URL overrides the automatic social icon.
        </p>

        <textarea
          rows={5}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={"How to access the account, login rules, warranty notes...\n\nPaste links on their own line if needed."}
          className="mt-5 min-h-40 w-full resize-y whitespace-pre-wrap rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4 text-sm leading-6 outline-none focus:border-blue-500"
        />

        <label className="mt-4 block text-sm font-bold">
          Logo image URL (optional — leave blank to auto-pick known service logos)
          <input
            value={logoUrl}
            onChange={(event) => setLogoUrl(event.target.value)}
            placeholder="https://..."
            className="mt-2 h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 outline-none focus:border-blue-500"
          />
        </label>

        <button
          type="button"
          onClick={() => saveProductRule({ pricingEnabled: Boolean(selectedSavedRule?.pricingEnabled) })}
          disabled={!selectedProduct || savingProduct}
          className="mt-5 flex h-11 items-center gap-2 rounded-xl border border-[var(--border)] px-5 text-sm font-black disabled:opacity-50"
        >
          <Save size={17} />
          Save note
        </button>
      </section>

      <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
        <div className="border-b border-[var(--border)] p-5 sm:p-6">
          <h2 className="text-xl font-black">Saved Account & VPN rows ({savedRows.length})</h2>
        </div>

        {savedRows.length === 0 ? (
          <div className="p-8 text-center text-sm text-[var(--muted-foreground)]">No account/VPN overrides or notes saved for this provider.</div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {savedRows.map((rule) => (
              <div key={rule.id || `${rule.provider}:${rule.providerProductId}`} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-black">{rule.productName || `Product ${rule.providerProductId}`}</p>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    {rule.category || "Other"} · {rule.pricingEnabled
                      ? rule.pricingMode === "fixed"
                        ? `Fixed ${formatNaira(rule.fixedSellingPrice)}`
                        : `${Number(rule.markupPercent || 0)}% markup`
                      : "Global pricing"}
                    {rule.note ? " · note saved" : ""}
                    {rule.logoUrl ? " · custom logo" : ""}
                  </p>
                </div>

                <div className="grid w-full grid-cols-2 gap-2 sm:w-auto">
                  <button
                    type="button"
                    onClick={() => editRule(rule)}
                    className="flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-4 text-xs font-black text-[var(--foreground)] transition hover:bg-[var(--muted)]"
                  >
                    <Edit3 size={15} />
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteRule(rule)}
                    className="flex h-10 items-center justify-center gap-2 rounded-xl border border-red-500/30 px-4 text-xs font-black text-red-500 transition hover:bg-red-500/5"
                  >
                    <Trash2 size={15} />
                    Delete row
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
