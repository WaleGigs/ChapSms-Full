"use client";

import Link from "next/link";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  BadgeDollarSign,
  Boxes,
  Eye,
  EyeOff,
  LoaderCircle,
  PackagePlus,
  RefreshCw,
  Search,
  Store,
  Warehouse,
} from "lucide-react";

import toast from "react-hot-toast";

import {
  socialService,
} from "@/services/socialService";

function formatNaira(value) {
  return `₦${Number(
    value || 0
  ).toLocaleString("en-NG", {
    maximumFractionDigits: 2,
  })}`;
}

function providerLabel(value) {
  return String(value) ===
    "sameeha"
    ? "Sameeha"
    : "LoggsPlug";
}

function splitStockCount(
  value
) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) =>
      line.trim()
    )
    .filter(Boolean)
    .length;
}

function VisibilityButton({
  visible,
  disabled = false,
  loading = false,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={
        disabled || loading
      }
      className={`inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg px-2.5 text-[10px] font-black transition disabled:cursor-not-allowed disabled:opacity-50 min-[390px]:text-[11px] sm:min-h-9 sm:gap-2 sm:px-3 sm:text-xs ${
        visible
          ? "bg-green-50 text-green-700 ring-1 ring-green-200 hover:bg-green-100 dark:bg-green-950/30 dark:text-green-300 dark:ring-green-900"
          : "bg-red-50 text-red-600 ring-1 ring-red-200 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-300 dark:ring-red-900"
      }`}
    >
      {loading ? (
        <LoaderCircle
          size={14}
          className="animate-spin"
        />
      ) : visible ? (
        <Eye size={13} className="sm:h-3.5 sm:w-3.5" />
      ) : (
        <EyeOff size={13} className="sm:h-3.5 sm:w-3.5" />
      )}

      {visible
        ? "Visible"
        : "Hidden"}
    </button>
  );
}

export default function AdminSocialsPage() {
  const [
    activeTab,
    setActiveTab,
  ] = useState("catalog");

  const [
    catalog,
    setCatalog,
  ] = useState({
    categories: [],
    products: [],
  });

  const [
    houseProducts,
    setHouseProducts,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    visibilityBusy,
    setVisibilityBusy,
  ] = useState("");

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    providerFilter,
    setProviderFilter,
  ] = useState("all");

  const [
    categoryFilter,
    setCategoryFilter,
  ] = useState("all");

  const [
    createForm,
    setCreateForm,
  ] = useState({
    name: "",
    category: "",
    costPrice: "",
    sellingPrice: "",
    stockText: "",
  });

  const [
    creating,
    setCreating,
  ] = useState(false);

  const [
    editingHouse,
    setEditingHouse,
  ] = useState({});

  const [
    restockText,
    setRestockText,
  ] = useState({});

  const [
    houseBusy,
    setHouseBusy,
  ] = useState("");

  const loadEverything =
    useCallback(
      async ({
        silent = false,
      } = {}) => {
        try {
          if (!silent) {
            setLoading(true);
          }

          const [
            nextCatalog,
            nextHouseProducts,
          ] =
            await Promise.all([
              socialService
                .getAdminCatalog(),

              socialService
                .getHouseProducts(),
            ]);

          setCatalog(
            nextCatalog
          );

          setHouseProducts(
            nextHouseProducts
          );

          setEditingHouse(
            (current) => {
              const next = {
                ...current,
              };

              for (
                const product of
                nextHouseProducts
              ) {
                if (
                  !next[
                    product.id
                  ]
                ) {
                  next[
                    product.id
                  ] = {
                    name:
                      product.name,
                    category:
                      product.category,
                    costPrice:
                      String(
                        product.costPrice ??
                          0
                      ),
                    sellingPrice:
                      String(
                        product.sellingPrice ??
                          0
                      ),
                  };
                }
              }

              return next;
            }
          );
        } catch (error) {
          if (!silent) {
            toast.error(
              error?.message ||
                "Unable to load Account & VPN admin controls"
            );
          }
        } finally {
          if (!silent) {
            setLoading(false);
          }
        }
      },
      []
    );

  useEffect(() => {
    loadEverything();
  }, [loadEverything]);

  const visibleCategoryNames =
    useMemo(() => {
      const set =
        new Set(
          catalog.products.map(
            (product) =>
              product.category
          )
        );

      return [
        ...set,
      ].sort((a, b) =>
        a.localeCompare(b)
      );
    }, [catalog.products]);

  const filteredProducts =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return catalog.products.filter(
        (product) => {
          if (
            providerFilter !==
              "all" &&
            product.provider !==
              providerFilter
          ) {
            return false;
          }

          if (
            categoryFilter !==
              "all" &&
            product.category !==
              categoryFilter
          ) {
            return false;
          }

          if (!query) {
            return true;
          }

          return [
            product.name,
            product.category,
            product.provider,
            product
              .providerProductId,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(query);
        }
      );
    }, [
      catalog.products,
      search,
      providerFilter,
      categoryFilter,
    ]);

  const catalogStats =
    useMemo(
      () => ({
        total:
          catalog.products.length,

        visible:
          catalog.products.filter(
            (item) =>
              item.visible
          ).length,

        hidden:
          catalog.products.filter(
            (item) =>
              !item.visible
          ).length,
      }),
      [catalog.products]
    );

  const houseStats =
    useMemo(
      () => ({
        products:
          houseProducts.length,

        available:
          houseProducts.reduce(
            (sum, item) =>
              sum +
              Number(
                item.stock || 0
              ),
            0
          ),

        sold:
          houseProducts.reduce(
            (sum, item) =>
              sum +
              Number(
                item.sold || 0
              ),
            0
          ),
      }),
      [houseProducts]
    );

  async function refreshProviders() {
    if (refreshing) {
      return;
    }

    try {
      setRefreshing(true);

      await socialService
        .refreshCatalog();

      await loadEverything({
        silent: true,
      });

      toast.success(
        "Provider catalog refreshed"
      );
    } catch (error) {
      toast.error(
        error?.message ||
          "Could not refresh provider catalog"
      );
    } finally {
      setRefreshing(false);
    }
  }

  async function toggleCategory(
    category
  ) {
    const key =
      `category:${category.provider}:${category.category}`;

    if (visibilityBusy) {
      return;
    }

    try {
      setVisibilityBusy(
        key
      );

      await socialService
        .setVisibility({
          scope:
            "category",
          provider:
            category.provider,
          category:
            category.category,
          visible:
            !category.visible,
        });

      await loadEverything({
        silent: true,
      });

      toast.success(
        `${providerLabel(
          category.provider
        )} ${category.category} ${
          category.visible
            ? "hidden"
            : "shown"
        }`
      );
    } catch (error) {
      toast.error(
        error?.message ||
          "Could not update category visibility"
      );
    } finally {
      setVisibilityBusy(
        ""
      );
    }
  }

  async function toggleProduct(
    product
  ) {
    const key =
      `product:${product.provider}:${product.providerProductId}`;

    if (
      visibilityBusy ||
      product
        .hiddenByCategory
    ) {
      return;
    }

    try {
      setVisibilityBusy(
        key
      );

      await socialService
        .setVisibility({
          scope:
            "product",
          provider:
            product.provider,
          providerProductId:
            product
              .providerProductId,
          visible:
            !product.visible,
        });

      await loadEverything({
        silent: true,
      });

      toast.success(
        `${product.name} ${
          product.visible
            ? "hidden"
            : "shown"
        } on ${providerLabel(
          product.provider
        )}`
      );
    } catch (error) {
      toast.error(
        error?.message ||
          "Could not update product visibility"
      );
    } finally {
      setVisibilityBusy(
        ""
      );
    }
  }

  function updateCreateField(
    name,
    value
  ) {
    setCreateForm(
      (current) => ({
        ...current,
        [name]: value,
      })
    );
  }

  async function createHouseProduct(
    event
  ) {
    event.preventDefault();

    if (creating) {
      return;
    }

    if (
      !createForm.name.trim() ||
      !createForm
        .category
        .trim()
    ) {
      toast.error(
        "Enter a product name and category"
      );
      return;
    }

    const sellingPrice =
      Number(
        createForm.sellingPrice
      );

    if (
      !Number.isFinite(
        sellingPrice
      ) ||
      sellingPrice <= 0
    ) {
      toast.error(
        "Enter a valid selling price"
      );
      return;
    }

    try {
      setCreating(true);

      const response =
        await socialService
          .createHouseProduct({
            name:
              createForm
                .name
                .trim(),

            category:
              createForm
                .category
                .trim(),

            costPrice:
              Number(
                createForm
                  .costPrice ||
                  0
              ),

            sellingPrice,

            stockText:
              createForm
                .stockText,
          });

      setCreateForm({
        name: "",
        category: "",
        costPrice: "",
        sellingPrice: "",
        stockText: "",
      });

      await loadEverything({
        silent: true,
      });

      toast.success(
        response?.message ||
          "House stock product created"
      );
    } catch (error) {
      toast.error(
        error?.message ||
          "Could not create house stock product"
      );
    } finally {
      setCreating(false);
    }
  }

  function updateHouseEdit(
    productId,
    field,
    value
  ) {
    setEditingHouse(
      (current) => ({
        ...current,

        [productId]: {
          ...(current[
            productId
          ] || {}),

          [field]: value,
        },
      })
    );
  }

  async function saveHouseProduct(
    product
  ) {
    if (houseBusy) {
      return;
    }

    const form =
      editingHouse[
        product.id
      ] || {};

    try {
      setHouseBusy(
        `save:${product.id}`
      );

      await socialService
        .updateHouseProduct(
          product.id,
          {
            name:
              String(
                form.name ||
                  product.name
              ).trim(),

            category:
              String(
                form.category ||
                  product.category
              ).trim(),

            costPrice:
              Number(
                form.costPrice ??
                  product.costPrice ??
                  0
              ),

            sellingPrice:
              Number(
                form.sellingPrice ??
                  product.sellingPrice
              ),
          }
        );

      await loadEverything({
        silent: true,
      });

      toast.success(
        "House product updated"
      );
    } catch (error) {
      toast.error(
        error?.message ||
          "Could not update house product"
      );
    } finally {
      setHouseBusy("");
    }
  }

  async function toggleHouseProduct(
    product
  ) {
    if (houseBusy) {
      return;
    }

    try {
      setHouseBusy(
        `toggle:${product.id}`
      );

      await socialService
        .updateHouseProduct(
          product.id,
          {
            isActive:
              !product.isActive,
          }
        );

      await loadEverything({
        silent: true,
      });

      toast.success(
        product.isActive
          ? "House product hidden"
          : "House product shown"
      );
    } catch (error) {
      toast.error(
        error?.message ||
          "Could not update house product visibility"
      );
    } finally {
      setHouseBusy("");
    }
  }

  async function addStock(
    product
  ) {
    if (houseBusy) {
      return;
    }

    const text =
      String(
        restockText[
          product.id
        ] || ""
      );

    if (!text.trim()) {
      toast.error(
        "Paste at least one stock item"
      );
      return;
    }

    try {
      setHouseBusy(
        `stock:${product.id}`
      );

      const response =
        await socialService
          .addHouseStock(
            product.id,
            text
          );

      setRestockText(
        (current) => ({
          ...current,
          [product.id]: "",
        })
      );

      await loadEverything({
        silent: true,
      });

      toast.success(
        response?.message ||
          "Stock added"
      );
    } catch (error) {
      toast.error(
        error?.message ||
          "Could not add stock"
      );
    } finally {
      setHouseBusy("");
    }
  }

  return (
    <div className="min-w-0 space-y-4 overflow-x-hidden sm:space-y-6">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-blue-600 min-[390px]:text-[11px] sm:text-xs sm:tracking-[0.18em]">
            Accounts & VPNs
          </p>

          <h1 className="mt-1.5 text-[23px] font-black leading-tight tracking-tight text-[var(--foreground)] min-[390px]:text-[25px] sm:mt-2 sm:text-4xl">
            Account & VPN catalog control
          </h1>

          <p className="mt-1.5 max-w-3xl text-[12px] leading-5 text-[var(--muted-foreground)] min-[390px]:text-[13px] sm:mt-2 sm:text-base sm:leading-6">
            Control Sameeha and LoggsPlug independently, or sell your own uploaded inventory as House Stock.
          </p>
        </div>

        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
          <Link
            href="/admin/pricing?section=socials"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 text-[11px] font-black text-white transition hover:bg-blue-700 min-[390px]:text-[12px] sm:min-h-11 sm:px-4 sm:text-sm"
          >
            <BadgeDollarSign size={16} />
            Pricing
          </Link>

          <button
            type="button"
            onClick={refreshProviders}
            disabled={refreshing}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-[11px] font-black text-[var(--foreground)] transition hover:bg-[var(--muted)] disabled:opacity-50 min-[390px]:text-[12px] sm:min-h-11 sm:px-4 sm:text-sm"
          >
            <RefreshCw
              size={17}
              className={refreshing ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </div>
      </div>

      <div className="flex min-w-0 gap-1.5 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--card)] p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden min-[390px]:gap-2 sm:rounded-2xl sm:p-2">
        <button
          type="button"
          onClick={() =>
            setActiveTab(
              "catalog"
            )
          }
          className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[12px] font-black transition min-[390px]:text-[13px] sm:min-h-11 sm:gap-2 sm:rounded-xl sm:px-4 sm:text-sm ${
            activeTab ===
            "catalog"
              ? "bg-blue-600 text-white"
              : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
          }`}
        >
          <Store size={17} />
          Catalog visibility
        </button>

        <button
          type="button"
          onClick={() =>
            setActiveTab(
              "house"
            )
          }
          className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[12px] font-black transition min-[390px]:text-[13px] sm:min-h-11 sm:gap-2 sm:rounded-xl sm:px-4 sm:text-sm ${
            activeTab ===
            "house"
              ? "bg-blue-600 text-white"
              : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
          }`}
        >
          <Warehouse
            size={17}
          />
          House Stock
        </button>
      </div>

      {loading ? (
        <div className="flex min-h-64 items-center justify-center rounded-3xl border border-[var(--border)] bg-[var(--card)]">
          <LoaderCircle
            className="animate-spin text-blue-600"
            size={30}
          />
        </div>
      ) : activeTab ===
        "catalog" ? (
        <>
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            {[
              [
                "Provider products",
                catalogStats.total,
              ],
              [
                "Visible",
                catalogStats.visible,
              ],
              [
                "Hidden",
                catalogStats.hidden,
              ],
            ].map(
              ([
                label,
                value,
              ]) => (
                <div
                  key={label}
                  className="min-w-0 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 shadow-sm min-[390px]:p-3.5 sm:rounded-2xl sm:p-5"
                >
                  <p className="break-words text-[8px] font-bold uppercase leading-3 tracking-[0.08em] text-[var(--muted-foreground)] min-[390px]:text-[9px] sm:text-xs sm:leading-normal sm:tracking-[0.14em]">
                    {label}
                  </p>

                  <p className="mt-1.5 text-[20px] font-black leading-none text-[var(--foreground)] min-[390px]:text-[22px] sm:mt-2 sm:text-3xl">
                    {Number(
                      value || 0
                    ).toLocaleString()}
                  </p>
                </div>
              )
            )}
          </div>

          <section className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm sm:rounded-3xl sm:p-6">
            <div className="mb-4 sm:mb-5">
              <h2 className="text-[17px] font-black leading-tight text-[var(--foreground)] min-[390px]:text-[18px] sm:text-xl">
                Category visibility
              </h2>

              <p className="mt-1 text-[11px] leading-[18px] text-[var(--muted-foreground)] min-[390px]:text-[12px] sm:text-sm sm:leading-normal">
                A category switch affects only that provider. Hiding a LoggsPlug category does not hide the Sameeha category.
              </p>
            </div>

            <div className="grid min-w-0 gap-2.5 sm:grid-cols-2 sm:gap-3 xl:grid-cols-3">
              {catalog.categories.map(
                (category) => {
                  const key =
                    `category:${category.provider}:${category.category}`;

                  return (
                    <div
                      key={
                        category.id
                      }
                      className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--background)] p-3 min-[390px]:gap-3 sm:rounded-2xl sm:p-4"
                    >
                      <div className="min-w-0">
                        <p className="break-words text-[12px] font-black leading-4 text-[var(--foreground)] min-[390px]:text-[13px] sm:text-sm">
                          {category.category}
                        </p>

                        <p className="mt-1 text-[10px] leading-4 text-[var(--muted-foreground)] min-[390px]:text-[11px] sm:text-xs">
                          {providerLabel(
                            category.provider
                          )}{" "}
                          •{" "}
                          {category.productCount}{" "}
                          products
                        </p>
                      </div>

                      <VisibilityButton
                        visible={
                          category.visible
                        }
                        loading={
                          visibilityBusy ===
                          key
                        }
                        disabled={
                          Boolean(
                            visibilityBusy &&
                              visibilityBusy !==
                                key
                          )
                        }
                        onClick={() =>
                          toggleCategory(
                            category
                          )
                        }
                      />
                    </div>
                  );
                }
              )}
            </div>
          </section>

          <section className="min-w-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm sm:rounded-3xl">
            <div className="border-b border-[var(--border)] p-4 sm:p-6">
              <h2 className="text-[17px] font-black leading-tight text-[var(--foreground)] min-[390px]:text-[18px] sm:text-xl">
                Product visibility
              </h2>

              <p className="mt-1 text-[11px] leading-[18px] text-[var(--muted-foreground)] min-[390px]:text-[12px] sm:text-sm sm:leading-normal">
                Each provider product has its own switch. This is where you can hide LoggsPlug TextNow and keep Sameeha TextNow available.
              </p>

              <div className="mt-4 grid min-w-0 gap-2.5 min-[390px]:gap-3 md:mt-5 md:grid-cols-3">
                <div className="relative md:col-span-1">
                  <Search
                    size={17}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
                  />

                  <input
                    value={
                      search
                    }
                    onChange={(
                      event
                    ) =>
                      setSearch(
                        event
                          .target
                          .value
                      )
                    }
                    placeholder="Search product..."
                    className="h-10 w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--background)] pl-9 pr-3 text-[12px] font-semibold text-[var(--foreground)] outline-none focus:border-blue-500 min-[390px]:text-[13px] sm:rounded-xl sm:text-sm"
                  />
                </div>

                <select
                  value={
                    providerFilter
                  }
                  onChange={(
                    event
                  ) =>
                    setProviderFilter(
                      event
                        .target
                        .value
                    )
                  }
                  className="h-10 min-w-0 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-[12px] font-semibold text-[var(--foreground)] outline-none focus:border-blue-500 min-[390px]:text-[13px] sm:rounded-xl sm:text-sm"
                >
                  <option value="all">
                    All providers
                  </option>
                  <option value="sameeha">
                    Sameeha
                  </option>
                  <option value="loggsplug">
                    LoggsPlug
                  </option>
                </select>

                <select
                  value={
                    categoryFilter
                  }
                  onChange={(
                    event
                  ) =>
                    setCategoryFilter(
                      event
                        .target
                        .value
                    )
                  }
                  className="h-10 min-w-0 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-[12px] font-semibold text-[var(--foreground)] outline-none focus:border-blue-500 min-[390px]:text-[13px] sm:rounded-xl sm:text-sm"
                >
                  <option value="all">
                    All categories
                  </option>

                  {visibleCategoryNames.map(
                    (category) => (
                      <option
                        key={
                          category
                        }
                        value={
                          category
                        }
                      >
                        {category}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>

            {filteredProducts.length ===
            0 ? (
              <div className="p-6 text-center text-[12px] font-semibold text-[var(--muted-foreground)] min-[390px]:text-[13px] sm:p-10 sm:text-sm">
                No products match your filters.
              </div>
            ) : (
              <>
                <div className="grid min-w-0 gap-2.5 p-3 md:hidden min-[390px]:p-4">
                  {filteredProducts.map(
                    (product) => {
                      const key =
                        `product:${product.provider}:${product.providerProductId}`;

                      return (
                        <article
                          key={
                            product.id
                          }
                          className="min-w-0 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--background)] p-3 min-[390px]:p-3.5 sm:rounded-2xl sm:p-4"
                        >
                          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-2.5 min-[390px]:gap-3">
                            <div className="min-w-0">
                              <p className="break-words text-[9px] font-black uppercase leading-3 tracking-[0.1em] text-blue-600 min-[390px]:text-[10px] sm:tracking-[0.14em]">
                                {providerLabel(
                                  product.provider
                                )}{" "}
                                •{" "}
                                {product.category}
                              </p>

                              <h3 className="mt-1 break-words text-[12px] font-black leading-4 text-[var(--foreground)] min-[390px]:text-[13px] sm:text-sm">
                                {product.name}
                              </h3>

                              <p className="mt-1.5 text-[10px] leading-4 text-[var(--muted-foreground)] min-[390px]:text-[11px] sm:mt-2 sm:text-xs">
                                Cost{" "}
                                {formatNaira(
                                  product.providerCostNgn
                                )}{" "}
                                • Stock{" "}
                                {Number(
                                  product.stock ||
                                    0
                                ).toLocaleString()}
                              </p>
                            </div>

                            <VisibilityButton
                              visible={
                                product.visible
                              }
                              loading={
                                visibilityBusy ===
                                key
                              }
                              disabled={
                                product.hiddenByCategory ||
                                Boolean(
                                  visibilityBusy &&
                                    visibilityBusy !==
                                      key
                                )
                              }
                              onClick={() =>
                                toggleProduct(
                                  product
                                )
                              }
                            />
                          </div>

                          {product.hiddenByCategory && (
                            <p className="mt-2.5 rounded-lg bg-amber-50 px-2.5 py-2 text-[10px] font-bold leading-4 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300 min-[390px]:text-[11px] sm:mt-3 sm:px-3 sm:text-xs">
                              Hidden by its category switch.
                            </p>
                          )}
                        </article>
                      );
                    }
                  )}
                </div>

                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[900px] text-left">
                    <thead className="bg-[var(--muted)]">
                      <tr className="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--muted-foreground)] min-[390px]:text-[11px] sm:text-xs sm:tracking-[0.12em]">
                        <th className="px-5 py-4">
                          Product
                        </th>
                        <th className="px-5 py-4">
                          Provider
                        </th>
                        <th className="px-5 py-4">
                          Cost
                        </th>
                        <th className="px-5 py-4">
                          Stock
                        </th>
                        <th className="px-5 py-4 text-right">
                          Visibility
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-[var(--border)]">
                      {filteredProducts.map(
                        (product) => {
                          const key =
                            `product:${product.provider}:${product.providerProductId}`;

                          return (
                            <tr
                              key={
                                product.id
                              }
                            >
                              <td className="px-5 py-4">
                                <p className="font-black text-[var(--foreground)]">
                                  {product.name}
                                </p>

                                <p className="mt-1 text-[10px] leading-4 text-[var(--muted-foreground)] min-[390px]:text-[11px] sm:text-xs">
                                  {product.category}{" "}
                                  • ID{" "}
                                  {product.providerProductId}
                                </p>
                              </td>

                              <td className="px-5 py-4 text-sm font-bold text-[var(--foreground)]">
                                {providerLabel(
                                  product.provider
                                )}
                              </td>

                              <td className="px-5 py-4 text-sm font-black text-[var(--foreground)]">
                                {formatNaira(
                                  product.providerCostNgn
                                )}
                              </td>

                              <td className="px-5 py-4">
                                <p className={`text-sm font-black ${
                                  product.inStock
                                    ? "text-green-600"
                                    : "text-red-500"
                                }`}>
                                  {Number(
                                    product.stock ||
                                      0
                                  ).toLocaleString()}
                                </p>
                              </td>

                              <td className="px-5 py-4 text-right">
                                <VisibilityButton
                                  visible={
                                    product.visible
                                  }
                                  loading={
                                    visibilityBusy ===
                                    key
                                  }
                                  disabled={
                                    product.hiddenByCategory ||
                                    Boolean(
                                      visibilityBusy &&
                                        visibilityBusy !==
                                          key
                                    )
                                  }
                                  onClick={() =>
                                    toggleProduct(
                                      product
                                    )
                                  }
                                />

                                {product.hiddenByCategory && (
                                  <p className="mt-2 text-[10px] font-bold text-amber-600">
                                    Category hidden
                                  </p>
                                )}
                              </td>
                            </tr>
                          );
                        }
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            {[
              [
                "House products",
                houseStats.products,
              ],
              [
                "Available stock",
                houseStats.available,
              ],
              [
                "Sold",
                houseStats.sold,
              ],
            ].map(
              ([
                label,
                value,
              ]) => (
                <div
                  key={label}
                  className="min-w-0 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 shadow-sm min-[390px]:p-3.5 sm:rounded-2xl sm:p-5"
                >
                  <p className="break-words text-[8px] font-bold uppercase leading-3 tracking-[0.08em] text-[var(--muted-foreground)] min-[390px]:text-[9px] sm:text-xs sm:leading-normal sm:tracking-[0.14em]">
                    {label}
                  </p>

                  <p className="mt-1.5 text-[20px] font-black leading-none text-[var(--foreground)] min-[390px]:text-[22px] sm:mt-2 sm:text-3xl">
                    {Number(
                      value || 0
                    ).toLocaleString()}
                  </p>
                </div>
              )
            )}
          </div>

          <form
            onSubmit={
              createHouseProduct
            }
            className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm sm:rounded-3xl sm:p-6"
          >
            <div className="flex min-w-0 items-start gap-2.5 min-[390px]:gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-300 min-[390px]:h-10 min-[390px]:w-10 sm:h-11 sm:w-11 sm:rounded-2xl">
                <PackagePlus
                  size={21}
                />
              </div>

              <div>
                <h2 className="text-[17px] font-black leading-tight text-[var(--foreground)] min-[390px]:text-[18px] sm:text-xl">
                  Create House Stock product
                </h2>

                <p className="mt-1 text-[11px] leading-[18px] text-[var(--muted-foreground)] min-[390px]:text-[12px] sm:text-sm sm:leading-normal">
                  Use this when you buy accounts/logs elsewhere in bulk and want ChapSms to deliver them automatically.
                </p>
              </div>
            </div>

            <div className="mt-4 grid min-w-0 gap-3 min-[390px]:mt-5 md:mt-6 md:grid-cols-2 md:gap-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--muted-foreground)] min-[390px]:text-[11px] sm:text-xs sm:tracking-[0.12em]">
                  Product name
                </label>

                <input
                  value={
                    createForm.name
                  }
                  onChange={(
                    event
                  ) =>
                    updateCreateField(
                      "name",
                      event.target
                        .value
                    )
                  }
                  placeholder="e.g. TextNow aged account"
                  className="mt-1.5 h-10 w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-[12px] font-semibold text-[var(--foreground)] outline-none focus:border-blue-500 min-[390px]:text-[13px] sm:mt-2 sm:h-11 sm:rounded-xl sm:text-sm"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--muted-foreground)] min-[390px]:text-[11px] sm:text-xs sm:tracking-[0.12em]">
                  Category
                </label>

                <input
                  value={
                    createForm.category
                  }
                  onChange={(
                    event
                  ) =>
                    updateCreateField(
                      "category",
                      event.target
                        .value
                    )
                  }
                  placeholder="e.g. TextNow"
                  className="mt-1.5 h-10 w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-[12px] font-semibold text-[var(--foreground)] outline-none focus:border-blue-500 min-[390px]:text-[13px] sm:mt-2 sm:h-11 sm:rounded-xl sm:text-sm"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--muted-foreground)] min-[390px]:text-[11px] sm:text-xs sm:tracking-[0.12em]">
                  Your cost per item
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    createForm.costPrice
                  }
                  onChange={(
                    event
                  ) =>
                    updateCreateField(
                      "costPrice",
                      event.target
                        .value
                    )
                  }
                  placeholder="0"
                  className="mt-1.5 h-10 w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-[12px] font-semibold text-[var(--foreground)] outline-none focus:border-blue-500 min-[390px]:text-[13px] sm:mt-2 sm:h-11 sm:rounded-xl sm:text-sm"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--muted-foreground)] min-[390px]:text-[11px] sm:text-xs sm:tracking-[0.12em]">
                  Customer selling price
                </label>

                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={
                    createForm.sellingPrice
                  }
                  onChange={(
                    event
                  ) =>
                    updateCreateField(
                      "sellingPrice",
                      event.target
                        .value
                    )
                  }
                  placeholder="0"
                  className="mt-1.5 h-10 w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-[12px] font-semibold text-[var(--foreground)] outline-none focus:border-blue-500 min-[390px]:text-[13px] sm:mt-2 sm:h-11 sm:rounded-xl sm:text-sm"
                />
              </div>

              <div className="md:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--muted-foreground)] min-[390px]:text-[11px] sm:text-xs sm:tracking-[0.12em]">
                    Initial stock
                  </label>

                  <span className="text-[10px] font-bold text-[var(--muted-foreground)] min-[390px]:text-[11px] sm:text-xs">
                    {splitStockCount(
                      createForm.stockText
                    )}{" "}
                    lines
                  </span>
                </div>

                <textarea
                  value={
                    createForm.stockText
                  }
                  onChange={(
                    event
                  ) =>
                    updateCreateField(
                      "stockText",
                      event.target
                        .value
                    )
                  }
                  rows={8}
                  placeholder={"Paste one deliverable account/log per line.\nExample:\nemail@example.com|password|extra details\nanother@example.com|password|extra details"}
                  className="mt-2 w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 font-mono text-[11px] font-semibold leading-5 text-[var(--foreground)] outline-none focus:border-blue-500 min-[390px]:text-[12px] sm:rounded-xl sm:text-xs"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={
                creating
              }
              className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-[12px] font-black text-white transition hover:bg-blue-700 disabled:opacity-50 min-[390px]:text-[13px] sm:mt-5 sm:min-h-11 sm:w-auto sm:px-5 sm:text-sm"
            >
              {creating ? (
                <LoaderCircle
                  className="animate-spin"
                  size={17}
                />
              ) : (
                <PackagePlus
                  size={17}
                />
              )}

              Create product
            </button>
          </form>

          <section>
            <div className="mb-4">
              <h2 className="text-[17px] font-black leading-tight text-[var(--foreground)] min-[390px]:text-[18px] sm:text-xl">
                House Stock inventory
              </h2>

              <p className="mt-1 text-[11px] leading-[18px] text-[var(--muted-foreground)] min-[390px]:text-[12px] sm:text-sm sm:leading-normal">
                Stock lines are private. Customers only receive the exact items allocated to their completed order.
              </p>
            </div>

            {houseProducts.length ===
            0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)] p-6 text-center sm:rounded-3xl sm:p-10">
                <Boxes
                  size={32}
                  className="mx-auto text-[var(--muted-foreground)]"
                />

                <p className="mt-3 text-[13px] font-black text-[var(--foreground)] min-[390px]:text-sm sm:text-base">
                  No House Stock products yet
                </p>
              </div>
            ) : (
              <div className="grid min-w-0 gap-3.5 min-[390px]:gap-4 sm:gap-5 xl:grid-cols-2">
                {houseProducts.map(
                  (product) => {
                    const form =
                      editingHouse[
                        product.id
                      ] || {
                        name:
                          product.name,
                        category:
                          product.category,
                        costPrice:
                          String(
                            product.costPrice ??
                              0
                          ),
                        sellingPrice:
                          String(
                            product.sellingPrice ??
                              0
                          ),
                      };

                    const saving =
                      houseBusy ===
                      `save:${product.id}`;

                    const toggling =
                      houseBusy ===
                      `toggle:${product.id}`;

                    const stocking =
                      houseBusy ===
                      `stock:${product.id}`;

                    return (
                      <article
                        key={
                          product.id
                        }
                        className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm sm:rounded-3xl sm:p-6"
                      >
                        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-blue-600">
                              House Stock
                            </p>

                            <h3 className="mt-1 break-words text-[15px] font-black leading-5 text-[var(--foreground)] min-[390px]:text-base sm:text-lg">
                              {product.name}
                            </h3>

                            <p className="mt-1 text-[10px] leading-4 text-[var(--muted-foreground)] min-[390px]:text-[11px] sm:text-xs">
                              {product.category}
                            </p>
                          </div>

                          <VisibilityButton
                            visible={
                              product.isActive
                            }
                            loading={
                              toggling
                            }
                            disabled={
                              Boolean(
                                houseBusy &&
                                  !toggling
                              )
                            }
                            onClick={() =>
                              toggleHouseProduct(
                                product
                              )
                            }
                          />
                        </div>

                        <div className="mt-4 grid grid-cols-3 gap-2 min-[390px]:gap-2.5 sm:mt-5 sm:gap-3">
                          <div className="min-w-0 rounded-lg bg-[var(--muted)] p-2 min-[390px]:p-2.5 sm:rounded-xl sm:p-3">
                            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
                              Available
                            </p>

                            <p className="mt-1 text-[17px] font-black leading-none text-green-600 min-[390px]:text-[18px] sm:text-xl">
                              {Number(
                                product.stock ||
                                  0
                              ).toLocaleString()}
                            </p>
                          </div>

                          <div className="min-w-0 rounded-lg bg-[var(--muted)] p-2 min-[390px]:p-2.5 sm:rounded-xl sm:p-3">
                            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
                              Sold
                            </p>

                            <p className="mt-1 text-[17px] font-black leading-none text-[var(--foreground)] min-[390px]:text-[18px] sm:text-xl">
                              {Number(
                                product.sold ||
                                  0
                              ).toLocaleString()}
                            </p>
                          </div>

                          <div className="min-w-0 rounded-lg bg-[var(--muted)] p-2 min-[390px]:p-2.5 sm:rounded-xl sm:p-3">
                            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
                              Reserved
                            </p>

                            <p className="mt-1 text-[17px] font-black leading-none text-amber-600 min-[390px]:text-[18px] sm:text-xl">
                              {Number(
                                product.reserved ||
                                  0
                              ).toLocaleString()}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 grid min-w-0 gap-2.5 min-[390px]:gap-3 sm:mt-5 sm:grid-cols-2">
                          <input
                            value={
                              form.name
                            }
                            onChange={(
                              event
                            ) =>
                              updateHouseEdit(
                                product.id,
                                "name",
                                event.target
                                  .value
                              )
                            }
                            placeholder="Product name"
                            className="h-10 min-w-0 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-[12px] font-semibold text-[var(--foreground)] outline-none focus:border-blue-500 min-[390px]:text-[13px] sm:rounded-xl sm:text-sm"
                          />

                          <input
                            value={
                              form.category
                            }
                            onChange={(
                              event
                            ) =>
                              updateHouseEdit(
                                product.id,
                                "category",
                                event.target
                                  .value
                              )
                            }
                            placeholder="Category"
                            className="h-10 min-w-0 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-[12px] font-semibold text-[var(--foreground)] outline-none focus:border-blue-500 min-[390px]:text-[13px] sm:rounded-xl sm:text-sm"
                          />

                          <div>
                            <p className="mb-1 text-[10px] font-bold uppercase text-[var(--muted-foreground)]">
                              Cost
                            </p>

                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={
                                form.costPrice
                              }
                              onChange={(
                                event
                              ) =>
                                updateHouseEdit(
                                  product.id,
                                  "costPrice",
                                  event.target
                                    .value
                                )
                              }
                              className="h-10 w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-[12px] font-semibold text-[var(--foreground)] outline-none focus:border-blue-500 min-[390px]:text-[13px] sm:rounded-xl sm:text-sm"
                            />
                          </div>

                          <div>
                            <p className="mb-1 text-[10px] font-bold uppercase text-[var(--muted-foreground)]">
                              Selling price
                            </p>

                            <input
                              type="number"
                              min="1"
                              step="0.01"
                              value={
                                form.sellingPrice
                              }
                              onChange={(
                                event
                              ) =>
                                updateHouseEdit(
                                  product.id,
                                  "sellingPrice",
                                  event.target
                                    .value
                                )
                              }
                              className="h-10 w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-[12px] font-semibold text-[var(--foreground)] outline-none focus:border-blue-500 min-[390px]:text-[13px] sm:rounded-xl sm:text-sm"
                            />
                          </div>
                        </div>

                        <div className="mt-3 flex min-w-0 items-center justify-between gap-2 rounded-lg bg-[var(--muted)] px-2.5 py-2 text-[10px] min-[390px]:text-[11px] sm:rounded-xl sm:px-3 sm:text-xs">
                          <span className="font-semibold text-[var(--muted-foreground)]">
                            Current margin
                          </span>

                          <span className="font-black text-[var(--foreground)]">
                            {formatNaira(
                              Number(
                                form.sellingPrice ||
                                  0
                              ) -
                                Number(
                                  form.costPrice ||
                                    0
                                )
                            )}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            saveHouseProduct(
                              product
                            )
                          }
                          disabled={
                            Boolean(
                              houseBusy
                            )
                          }
                          className="mt-3 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 text-[10px] font-black text-white transition hover:bg-blue-700 disabled:opacity-50 min-[390px]:text-[11px] sm:mt-4 sm:min-h-10 sm:gap-2 sm:rounded-xl sm:px-4 sm:text-xs"
                        >
                          {saving && (
                            <LoaderCircle
                              className="animate-spin"
                              size={14}
                            />
                          )}
                          Save details
                        </button>

                        <div className="mt-4 border-t border-[var(--border)] pt-4 sm:mt-5 sm:pt-5">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-[12px] font-black text-[var(--foreground)] min-[390px]:text-[13px] sm:text-sm">
                              Add more stock
                            </p>

                            <p className="text-[10px] font-bold text-[var(--muted-foreground)] min-[390px]:text-[11px] sm:text-xs">
                              {splitStockCount(
                                restockText[
                                  product.id
                                ]
                              )}{" "}
                              lines
                            </p>
                          </div>

                          <textarea
                            value={
                              restockText[
                                product.id
                              ] || ""
                            }
                            onChange={(
                              event
                            ) =>
                              setRestockText(
                                (
                                  current
                                ) => ({
                                  ...current,
                                  [product.id]:
                                    event
                                      .target
                                      .value,
                                })
                              )
                            }
                            rows={5}
                            placeholder="Paste one new account/log per line..."
                            className="mt-2 w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 font-mono text-[11px] font-semibold leading-5 text-[var(--foreground)] outline-none focus:border-blue-500 min-[390px]:text-[12px] sm:rounded-xl sm:text-xs"
                          />

                          <button
                            type="button"
                            onClick={() =>
                              addStock(
                                product
                              )
                            }
                            disabled={
                              Boolean(
                                houseBusy
                              )
                            }
                            className="mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 text-xs font-black text-[var(--foreground)] transition hover:bg-[var(--muted)] disabled:opacity-50"
                          >
                            {stocking ? (
                              <LoaderCircle
                                className="animate-spin"
                                size={14}
                              />
                            ) : (
                              <PackagePlus
                                size={14}
                              />
                            )}

                            Add stock
                          </button>
                        </div>
                      </article>
                    );
                  }
                )}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
