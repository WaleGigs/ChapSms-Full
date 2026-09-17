"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Check,
  ChevronDown,
  LoaderCircle,
  RefreshCw,
  Save,
  Search,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

import Button from "@/components/ui/Button";
import { useCatalog } from "@/hooks/useCatalog";
import { adminPricingService } from "@/services/adminPricingService";

const INITIAL_FORM = {
  server: "server1",
  country: "",
  service: "",
  operator: "any",
  pricingMode: "percentage",
  pricingStyle: "cheapest_buffer",
  maxPriceBufferPercent: "50",
  fixedSellingPrice: "",
  markupPercent: "50",
  fixedMarkup: "200",
  minimumSellingPrice: "1000",
  targetSellingPrice: "",
  notes: "",
  isActive: true,
};

function toPrimitive(value) {
  if (value === null || value === undefined) return "";

  if (
    typeof value === "string" ||
    typeof value === "number"
  ) {
    return String(value);
  }

  if (typeof value === "object") {
    return String(
      value.id ??
        value.code ??
        value.value ??
        value.operator ??
        value.provider_id ??
        ""
    );
  }

  return String(value);
}

function getCountryId(country) {
  return toPrimitive(
    country?.id ??
      country?.code ??
      country?.country
  );
}

function getCountryName(country) {
  return String(
    country?.eng ??
      country?.name ??
      country?.title ??
      country?.label ??
      country?.code ??
      country?.id ??
      "Unknown country"
  );
}

function getServiceId(service) {
  return toPrimitive(
    service?.id ??
      service?.code ??
      service?.service
  );
}

function getServiceName(service) {
  return String(
    service?.name ??
      service?.serviceName ??
      service?.title ??
      service?.label ??
      service?.code ??
      service?.id ??
      "Unknown service"
  );
}

function getOperatorId(operator) {
  return toPrimitive(
    operator?.id ??
      operator?.operator ??
      operator?.providerId ??
      operator?.poolId
  );
}

function formatNaira(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "—";
  }

  return `₦${number.toLocaleString("en-NG", {
    maximumFractionDigits: 0,
  })}`;
}

function formatProviderPrice(price, currency) {
  const number = Number(price);

  if (!Number.isFinite(number)) {
    return "—";
  }

  if (
    String(currency).toUpperCase() ===
    "USD"
  ) {
    return `$${number.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    })}`;
  }

  return `${number.toLocaleString("en-NG", {
    maximumFractionDigits: 2,
  })} ${currency || ""}`.trim();
}

function SearchablePicker({
  value,
  options,
  onChange,
  getOptionId,
  getOptionLabel,
  placeholder,
  searchPlaceholder,
  disabled = false,
  emptyText = "No matches found",
}) {
  const [open, setOpen] =
    useState(false);
  const [query, setQuery] =
    useState("");
  const rootRef = useRef(null);

  const selectedOption =
    useMemo(
      () =>
        options.find(
          (option) =>
            String(
              getOptionId(option)
            ) === String(value)
        ) || null,
      [
        options,
        value,
        getOptionId,
      ]
    );

  const filteredOptions =
    useMemo(() => {
      const normalizedQuery =
        query
          .trim()
          .toLowerCase();

      if (!normalizedQuery) {
        return options;
      }

      return options.filter(
        (option) => {
          const id = String(
            getOptionId(option) || ""
          ).toLowerCase();

          const label = String(
            getOptionLabel(option) || ""
          ).toLowerCase();

          return (
            label.includes(
              normalizedQuery
            ) ||
            id.includes(
              normalizedQuery
            )
          );
        }
      );
    }, [
      options,
      query,
      getOptionId,
      getOptionLabel,
    ]);

  useEffect(() => {
    function handleOutside(event) {
      if (
        rootRef.current &&
        !rootRef.current.contains(
          event.target
        )
      ) {
        setOpen(false);
      }
    }

    document.addEventListener(
      "pointerdown",
      handleOutside
    );

    return () =>
      document.removeEventListener(
        "pointerdown",
        handleOutside
      );
  }, []);

  useEffect(() => {
    if (disabled) {
      setOpen(false);
      setQuery("");
    }
  }, [disabled]);

  return (
    <div
      ref={rootRef}
      className="relative mt-2"
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setOpen((current) =>
            !current
          );
          setQuery("");
        }}
        className="flex h-12 w-full items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 text-left text-sm font-semibold text-[var(--foreground)] outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-blue-950/40"
      >
        <span
          className={`truncate ${
            selectedOption
              ? "text-[var(--foreground)]"
              : "text-[var(--muted-foreground)]"
          }`}
        >
          {selectedOption
            ? getOptionLabel(
                selectedOption
              )
            : placeholder}
        </span>

        <ChevronDown
          size={17}
          className={`shrink-0 text-[var(--muted-foreground)] transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && !disabled && (
        <div className="absolute left-0 right-0 z-[90] mt-2 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl">
          <div className="border-b border-[var(--border)] p-3">
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
              />

              <input
                autoFocus
                value={query}
                onChange={(event) =>
                  setQuery(
                    event.target.value
                  )
                }
                placeholder={
                  searchPlaceholder
                }
                className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] pl-9 pr-3 text-sm font-semibold text-[var(--foreground)] outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto p-2">
            {filteredOptions.length ? (
              filteredOptions.map(
                (option) => {
                  const optionId =
                    String(
                      getOptionId(
                        option
                      ) || ""
                    );

                  const selected =
                    optionId ===
                    String(
                      value || ""
                    );

                  return (
                    <button
                      key={optionId}
                      type="button"
                      onClick={() => {
                        onChange(
                          optionId
                        );
                        setOpen(false);
                        setQuery("");
                      }}
                      className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition ${
                        selected
                          ? "bg-blue-600 text-white"
                          : "text-[var(--foreground)] hover:bg-[var(--muted)]"
                      }`}
                    >
                      <span className="min-w-0 truncate font-semibold">
                        {getOptionLabel(
                          option
                        )}
                      </span>

                      {selected && (
                        <Check
                          size={16}
                          className="shrink-0"
                        />
                      )}
                    </button>
                  );
                }
              )
            ) : (
              <p className="px-3 py-8 text-center text-sm font-semibold text-[var(--muted-foreground)]">
                {emptyText}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PricingRuleForm({
  editingRule = null,
  onSaved,
  onCancelEdit,
}) {
  const [form, setForm] =
    useState(INITIAL_FORM);

  const [operators, setOperators] =
    useState([]);
  const [operatorsLoading, setOperatorsLoading] =
    useState(false);
  const [operatorsError, setOperatorsError] =
    useState("");
  const [operatorReloadKey, setOperatorReloadKey] =
    useState(0);

  const [preview, setPreview] =
    useState(null);
  const [previewing, setPreviewing] =
    useState(false);
  const [saving, setSaving] =
    useState(false);

  const operatorRequestRef =
    useRef(0);
  const previewRequestRef =
    useRef(0);

  const {
    countries,
    services,
    loading: catalogLoading,
    error: catalogError,
    reload: reloadCatalog,
  } = useCatalog(form.server);

  useEffect(() => {
    if (!editingRule) {
      return;
    }

    const pricingStyle =
      editingRule.pricingStyle ||
      (
        String(
          editingRule.operator ||
            "any"
        ).toLowerCase() === "any"
          ? "cheapest_buffer"
          : "fixed_operator"
      );

    setForm({
      ...INITIAL_FORM,
      server:
        editingRule.server ||
        "server1",
      country:
        editingRule.country ||
        "",
      service:
        editingRule.service ||
        "",
      operator:
        pricingStyle ===
        "cheapest_buffer"
          ? "any"
          : editingRule.operator ||
            "",
      pricingMode:
        editingRule.pricingMode ||
        "percentage",
      pricingStyle,
      maxPriceBufferPercent:
        String(
          editingRule
            .maxPriceBufferPercent ??
            50
        ),
      fixedSellingPrice:
        editingRule.fixedSellingPrice ||
        "",
      markupPercent:
        String(
          editingRule.markupPercent ??
            50
        ),
      fixedMarkup:
        String(
          editingRule.fixedMarkup ??
            200
        ),
      minimumSellingPrice:
        String(
          editingRule
            .minimumSellingPrice ??
            1000
        ),
      targetSellingPrice: "",
      notes:
        editingRule.notes ||
        "",
      isActive:
        editingRule.isActive !==
        false,
    });

    setPreview(null);
  }, [editingRule]);

  const selectedCountry =
    useMemo(
      () =>
        countries.find(
          (country) =>
            getCountryId(
              country
            ) ===
            String(form.country)
        ) || null,
      [
        countries,
        form.country,
      ]
    );

  const selectedService =
    useMemo(
      () =>
        services.find(
          (service) =>
            getServiceId(
              service
            ) ===
            String(form.service)
        ) || null,
      [
        services,
        form.service,
      ]
    );

  const selectedOperator =
    useMemo(
      () =>
        operators.find(
          (operator) =>
            getOperatorId(
              operator
            ) ===
            String(form.operator)
        ) || null,
      [
        operators,
        form.operator,
      ]
    );

  const buildPayload =
    useCallback(
      () => ({
        ...form,
        operator:
          form.pricingStyle ===
          "cheapest_buffer"
            ? "any"
            : form.operator,
        countryName:
          selectedCountry
            ? getCountryName(
                selectedCountry
              )
            : editingRule
                ?.countryName ||
              "",
        serviceName:
          selectedService
            ? getServiceName(
                selectedService
              )
            : editingRule
                ?.serviceName ||
              "",
      }),
      [
        form,
        selectedCountry,
        selectedService,
        editingRule,
      ]
    );

  function updateField(
    name,
    value
  ) {
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function handleServerChange(
    server
  ) {
    setForm({
      ...INITIAL_FORM,
      server,
    });
    setOperators([]);
    setOperatorsError("");
    setPreview(null);
  }

  function handleCountryChange(
    country
  ) {
    setForm((current) => ({
      ...current,
      country,
      service: "",
      operator:
        current.pricingStyle ===
        "cheapest_buffer"
          ? "any"
          : "",
    }));
    setOperators([]);
    setOperatorsError("");
    setPreview(null);
  }

  function handleServiceChange(
    service
  ) {
    setForm((current) => ({
      ...current,
      service,
      operator:
        current.pricingStyle ===
        "cheapest_buffer"
          ? "any"
          : "",
    }));
    setOperators([]);
    setOperatorsError("");
    setPreview(null);
  }

  function handlePricingStyle(
    pricingStyle
  ) {
    setForm((current) => ({
      ...current,
      pricingStyle,
      operator:
        pricingStyle ===
        "cheapest_buffer"
          ? "any"
          : "",
      targetSellingPrice: "",
    }));
    setPreview(null);
  }

  /*
   * Match the video: the huge operator list is NOT part of
   * Cheapest + buffer. It appears only when Fixed operator is chosen.
   */
  useEffect(() => {
    const requestId =
      ++operatorRequestRef.current;

    setOperatorsError("");

    if (
      form.pricingStyle !==
        "fixed_operator" ||
      !form.country ||
      !form.service
    ) {
      setOperatorsLoading(false);
      return undefined;
    }

    setOperatorsLoading(true);

    adminPricingService
      .getOperators({
        server: form.server,
        country: form.country,
        service: form.service,
      })
      .then((response) => {
        if (
          requestId !==
          operatorRequestRef.current
        ) {
          return;
        }

        const list =
          Array.isArray(
            response?.operators
          )
            ? response.operators
            : [];

        setOperators(list);

        setForm((current) => {
          const exists =
            list.some(
              (item) =>
                getOperatorId(
                  item
                ) ===
                String(
                  current.operator
                )
            );

          return exists
            ? current
            : {
                ...current,
                operator: "",
              };
        });
      })
      .catch((error) => {
        if (
          requestId !==
          operatorRequestRef.current
        ) {
          return;
        }

        setOperators([]);
        setOperatorsError(
          error?.message ||
            "Unable to load operators"
        );
      })
      .finally(() => {
        if (
          requestId ===
          operatorRequestRef.current
        ) {
          setOperatorsLoading(
            false
          );
        }
      });

    return () => {
      operatorRequestRef.current +=
        1;
    };
  }, [
    form.server,
    form.country,
    form.service,
    form.pricingStyle,
    operatorReloadKey,
  ]);

  const previewReady =
    Boolean(
      form.country &&
        form.service &&
        (
          form.pricingStyle ===
            "cheapest_buffer" ||
          form.operator
        ) &&
        (
          form.pricingMode !==
            "fixed" ||
          Number(
            form.fixedSellingPrice
          ) > 0
        )
    );

  /*
   * Live preview like the video. Debounced so typing a markup
   * does not hammer SMSBower/BenOTP on every keystroke.
   */
  useEffect(() => {
    if (!previewReady) {
      setPreview(null);
      return undefined;
    }

    const requestId =
      ++previewRequestRef.current;

    const timer =
      window.setTimeout(
        async () => {
          try {
            setPreviewing(true);

            const response =
              await adminPricingService
                .previewPricing(
                  buildPayload()
                );

            if (
              requestId ===
              previewRequestRef.current
            ) {
              setPreview(
                response?.preview ||
                  null
              );
            }
          } catch {
            if (
              requestId ===
              previewRequestRef.current
            ) {
              setPreview(null);
            }
          } finally {
            if (
              requestId ===
              previewRequestRef.current
            ) {
              setPreviewing(false);
            }
          }
        },
        450
      );

    return () =>
      window.clearTimeout(
        timer
      );
  }, [
    previewReady,
    form.server,
    form.country,
    form.service,
    form.operator,
    form.pricingStyle,
    form.maxPriceBufferPercent,
    form.pricingMode,
    form.fixedSellingPrice,
    form.markupPercent,
    form.fixedMarkup,
    form.minimumSellingPrice,
    buildPayload,
  ]);

  function handleMarkupChange(
    value
  ) {
    setForm((current) => ({
      ...current,
      markupPercent: value,
      targetSellingPrice: "",
    }));
  }

  function handleTargetPriceChange(
    value
  ) {
    const target = Number(value);
    const basis = Number(
      preview?.providerCostNgn ??
        preview?.pricingBasisNgn
    );

    setForm((current) => {
      if (
        !Number.isFinite(target) ||
        target <= 0 ||
        !Number.isFinite(basis) ||
        basis <= 0
      ) {
        return {
          ...current,
          targetSellingPrice:
            value,
        };
      }

      const markup =
        Math.max(
          0,
          (
            target /
              basis -
            1
          ) * 100
        );

      return {
        ...current,
        targetSellingPrice:
          value,
        markupPercent:
          markup.toFixed(2),
      };
    });
  }

  async function handleSubmit(
    event
  ) {
    event.preventDefault();

    try {
      setSaving(true);

      const payload =
        buildPayload();

      if (
        payload.pricingStyle ===
          "fixed_operator" &&
        !payload.operator
      ) {
        throw new Error(
          "Choose an operator"
        );
      }

      const response =
        editingRule?.id
          ? await adminPricingService
              .updateRule(
                editingRule.id,
                payload
              )
          : await adminPricingService
              .saveRule(payload);

      toast.success(
        response?.message ||
          "Pricing rule saved successfully"
      );

      setForm((current) => ({
        ...INITIAL_FORM,
        server: current.server,
      }));
      setOperators([]);
      setPreview(null);
      onSaved?.(
        response?.rule || null
      );
    } catch (error) {
      toast.error(
        error?.message ||
          "Unable to save pricing rule"
      );
    } finally {
      setSaving(false);
    }
  }

  const fieldClass =
    "h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 text-sm font-semibold text-[var(--foreground)] outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-950/40 disabled:cursor-not-allowed disabled:opacity-60";

  const saveReady =
    previewReady &&
    !catalogLoading &&
    !operatorsLoading;

  return (
    <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm sm:p-6">
      <div className="flex flex-col justify-between gap-4 border-b border-[var(--border)] pb-5 sm:flex-row sm:items-start">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">
            {editingRule
              ? "Edit pricing"
              : "New pricing"}
          </p>

          <h2 className="mt-2 text-xl font-black text-[var(--foreground)]">
            Set ChapsSmS selling price
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted-foreground)]">
            Use Cheapest + buffer for automatic operator selection, or lock a popular service to one fixed operator.
          </p>
        </div>

        {editingRule && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setForm(
                INITIAL_FORM
              );
              setOperators([]);
              setPreview(null);
              onCancelEdit?.();
            }}
            className="gap-2"
          >
            <X size={16} />
            Cancel edit
          </Button>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="mt-6 space-y-6"
      >
        <div>
          <label className="text-sm font-bold">
            Server (provider)
          </label>

          <div className="mt-2 grid grid-cols-2 gap-3">
            {[
              [
                "server1",
                "Server 1 · SMSBower",
              ],
              [
                "server2",
                "Server 2 · BenOTP",
              ],
            ].map(
              ([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    handleServerChange(
                      value
                    )
                  }
                  className={`min-h-12 rounded-xl border px-4 text-sm font-black transition ${
                    form.server ===
                    value
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-[var(--border)] hover:bg-[var(--muted)]"
                  }`}
                >
                  {label}
                </button>
              )
            )}
          </div>
        </div>

        {catalogError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
            {catalogError}
            <button
              type="button"
              onClick={reloadCatalog}
              className="ml-2 font-black underline"
            >
              Try again
            </button>
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <label className="text-sm font-bold">
              Country
            </label>

            <SearchablePicker
              value={form.country}
              options={countries}
              onChange={
                handleCountryChange
              }
              getOptionId={
                getCountryId
              }
              getOptionLabel={
                getCountryName
              }
              placeholder={
                catalogLoading
                  ? "Loading countries..."
                  : "Choose a country"
              }
              searchPlaceholder="Search country..."
              disabled={
                catalogLoading
              }
              emptyText="No country matches your search"
            />
          </div>

          <div>
            <label className="text-sm font-bold">
              Service
            </label>

            <SearchablePicker
              value={form.service}
              options={services}
              onChange={
                handleServiceChange
              }
              getOptionId={
                getServiceId
              }
              getOptionLabel={
                getServiceName
              }
              placeholder={
                !form.country
                  ? "Select a country first"
                  : catalogLoading
                    ? "Loading services..."
                    : "Choose a service"
              }
              searchPlaceholder="Search service..."
              disabled={
                catalogLoading ||
                !form.country
              }
              emptyText="No service matches your search"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-bold">
            Mode
          </label>

          <select
            value={form.pricingMode}
            onChange={(event) =>
              updateField(
                "pricingMode",
                event.target.value
              )
            }
            className={`${fieldClass} mt-2`}
          >
            <option value="percentage">
              Percentage markup (floats with cost)
            </option>
            <option value="fixed">
              Fixed selling price
            </option>
            <option value="cost_plus">
              Provider cost + fixed markup
            </option>
          </select>
        </div>

        <div>
          <label className="text-sm font-bold">
            Pricing style
          </label>

          <div className="mt-2 grid grid-cols-2 gap-3 rounded-2xl bg-[var(--muted)]/40 p-1">
            <button
              type="button"
              onClick={() =>
                handlePricingStyle(
                  "cheapest_buffer"
                )
              }
              className={`min-h-12 rounded-xl px-3 text-sm font-black transition ${
                form.pricingStyle ===
                "cheapest_buffer"
                  ? "bg-gradient-to-r from-blue-600 to-indigo-500 text-white shadow-lg shadow-blue-500/20"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--card)]"
              }`}
            >
              Cheapest + buffer
            </button>

            <button
              type="button"
              onClick={() =>
                handlePricingStyle(
                  "fixed_operator"
                )
              }
              className={`min-h-12 rounded-xl px-3 text-sm font-black transition ${
                form.pricingStyle ===
                "fixed_operator"
                  ? "bg-gradient-to-r from-blue-600 to-indigo-500 text-white shadow-lg shadow-blue-500/20"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--card)]"
              }`}
            >
              Fixed operator
            </button>
          </div>
        </div>

        {form.pricingStyle ===
          "cheapest_buffer" && (
          <div>
            <label className="text-sm font-bold">
              Cheapest operator pool (%)
            </label>

            <input
              type="number"
              min="10"
              max="100"
              step="10"
              value={
                form.maxPriceBufferPercent
              }
              onChange={(event) =>
                updateField(
                  "maxPriceBufferPercent",
                  event.target.value
                )
              }
              className={`${fieldClass} mt-2`}
              placeholder="50"
            />

            <p className="mt-2 text-xs leading-5 text-[var(--muted-foreground)]">
              This controls operator selection only — it does not change the customer price. 50 selects from the 5 cheapest live operators, 70 from the 7 cheapest, and 100 from the 10 cheapest. Inside that pool, Server 1 prefers SMSBower&apos;s own provider-side Gold/ranking statistics when available; otherwise live stock and then lower cost are used as the fallback.
            </p>
          </div>
        )}

        {form.pricingStyle ===
          "fixed_operator" && (
          <div>
            <div className="flex items-end justify-between gap-3">
              <div>
                <label className="text-sm font-bold">
                  Choose operator
                </label>
                <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">
                  This remains the preferred fixed operator. If it definitively runs out of numbers,
                  ChapsSms automatically uses the best cheap live fallback based on provider ranking/statistics,
                  stock and cost, then returns to this operator as soon as it is restocked.
                </p>
              </div>

              {form.country &&
                form.service && (
                  <button
                    type="button"
                    onClick={() =>
                      setOperatorReloadKey(
                        (value) =>
                          value + 1
                      )
                    }
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--border)] px-3 text-xs font-black"
                  >
                    <RefreshCw
                      size={15}
                      className={
                        operatorsLoading
                          ? "animate-spin"
                          : ""
                      }
                    />
                    Refresh
                  </button>
                )}
            </div>

            {operatorsLoading ? (
              <div className="mt-3 flex min-h-24 items-center justify-center gap-2 rounded-2xl border border-[var(--border)] text-sm text-[var(--muted-foreground)]">
                <LoaderCircle
                  size={18}
                  className="animate-spin"
                />
                Loading operators...
              </div>
            ) : operatorsError ? (
              <div className="mt-3 rounded-2xl border border-red-300 p-4 text-sm text-red-500">
                {operatorsError}
              </div>
            ) : (
              <div className="mt-3 grid max-h-96 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                {operators.map(
                  (operator) => {
                    const operatorId =
                      getOperatorId(
                        operator
                      );
                    const active =
                      String(
                        form.operator
                      ) ===
                      operatorId;

                    return (
                      <button
                        key={operatorId}
                        type="button"
                        onClick={() =>
                          updateField(
                            "operator",
                            operatorId
                          )
                        }
                        className={`grid min-h-20 grid-cols-[1fr_auto] items-center gap-3 rounded-xl border p-3 text-left transition ${
                          active
                            ? "border-blue-500 bg-blue-500/10 ring-1 ring-blue-500"
                            : "border-[var(--border)] hover:bg-[var(--muted)]"
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="truncate font-black">
                            {operator.name ||
                              `Operator ${operatorId}`}
                          </p>
                          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                            {Number(
                              operator.stock ||
                                0
                            ).toLocaleString()} in stock
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="font-black">
                            {formatProviderPrice(
                              operator.price,
                              operator.currency
                            )}
                          </p>

                          {Number(
                            operator.priceNgn
                          ) > 0 && (
                            <p className="mt-1 text-xs font-black text-blue-500">
                              {formatNaira(
                                operator.priceNgn
                              )}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  }
                )}
              </div>
            )}

            {selectedOperator && (
              <p className="mt-3 text-xs font-bold text-blue-500">
                Selected{" "}
                {selectedOperator.name ||
                  `Operator ${form.operator}`}
                {" · "}
                {Number(
                  selectedOperator.stock ||
                    0
                ).toLocaleString()}{" "}
                stock
              </p>
            )}
          </div>
        )}

        {form.pricingMode ===
          "percentage" && (
          <div className="space-y-5">
            <div>
              <label className="text-sm font-bold">
                Markup (%)
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                value={
                  form.markupPercent
                }
                onChange={(event) =>
                  handleMarkupChange(
                    event.target.value
                  )
                }
                className={`${fieldClass} mt-2`}
                placeholder="58.43"
              />
            </div>

            <div>
              <label className="text-sm font-bold">
                Or type a target sell price (₦) → auto-fills markup
              </label>

              <input
                type="number"
                min="1"
                step="1"
                value={
                  form.targetSellingPrice
                }
                onChange={(event) =>
                  handleTargetPriceChange(
                    event.target.value
                  )
                }
                disabled={
                  !preview
                    ?.providerCostNgn
                }
                className={`${fieldClass} mt-2`}
                placeholder={
                  preview
                    ?.providerCostNgn
                    ? "4100"
                    : "Load live cost first"
                }
              />
            </div>
          </div>
        )}

        {form.pricingMode ===
          "fixed" && (
          <div>
            <label className="text-sm font-bold">
              Selling price (₦)
            </label>

            <input
              type="number"
              min="1"
              step="1"
              value={
                form.fixedSellingPrice
              }
              onChange={(event) =>
                updateField(
                  "fixedSellingPrice",
                  event.target.value
                )
              }
              className={`${fieldClass} mt-2`}
              placeholder="1000"
            />
          </div>
        )}

        {form.pricingMode ===
          "cost_plus" && (
          <div>
            <label className="text-sm font-bold">
              Fixed markup (₦)
            </label>

            <input
              type="number"
              min="0"
              step="1"
              value={
                form.fixedMarkup
              }
              onChange={(event) =>
                updateField(
                  "fixedMarkup",
                  event.target.value
                )
              }
              className={`${fieldClass} mt-2`}
              placeholder="200"
            />
          </div>
        )}

        <div>
          <label className="text-sm font-bold">
            Minimum selling price (₦)
          </label>

          <input
            type="number"
            min="0"
            step="1"
            value={
              form.minimumSellingPrice
            }
            onChange={(event) =>
              updateField(
                "minimumSellingPrice",
                event.target.value
              )
            }
            className={`${fieldClass} mt-2`}
            placeholder="1000"
          />
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)]/50 p-4 text-sm">
          {previewing ? (
            <p className="flex items-center gap-2 text-[var(--muted-foreground)]">
              <LoaderCircle
                size={17}
                className="animate-spin"
              />
              Checking live provider costs...
            </p>
          ) : preview ? (
            <div className="space-y-1.5">
              {form.pricingStyle ===
              "cheapest_buffer" ? (
                <>
                  <p>
                    <span className="text-[var(--muted-foreground)]">
                      Cheapest live cost:{" "}
                    </span>
                    <strong>
                      {formatNaira(
                        preview.floorCostNgn
                      )}
                    </strong>
                  </p>

                  <p>
                    <span className="text-[var(--muted-foreground)]">
                      Operators considered:{" "}
                    </span>
                    <strong>
                      {preview.eligibleCount || 0}
                    </strong>{" "}
                    <span className="text-xs text-[var(--muted-foreground)]">
                      (cheapest {preview.candidateLimit || Math.max(1, Math.ceil(Number(form.maxPriceBufferPercent || 50) / 10))})
                    </span>
                  </p>

                  <p>
                    <span className="text-[var(--muted-foreground)]">
                      Selected operator cost:{" "}
                    </span>
                    <strong>
                      {formatNaira(
                        preview.providerCostNgn
                      )}
                    </strong>
                  </p>

                  {preview.providerStatsAvailable ? (
                    <p>
                      <span className="text-[var(--muted-foreground)]">
                        SMSBower provider statistics:{" "}
                      </span>
                      <strong>
                        {preview.providerTier
                          ? String(preview.providerTier).charAt(0).toUpperCase() +
                            String(preview.providerTier).slice(1)
                          : "Ranked"}
                        {preview.providerRank
                          ? ` · #${preview.providerRank}`
                          : ""}
                      </strong>
                      {Number.isFinite(Number(preview.providerSalesCount)) ? (
                        <span className="text-xs text-[var(--muted-foreground)]">
                          {` · ${Number(preview.providerSalesCount).toLocaleString()} provider sales`}
                        </span>
                      ) : null}
                    </p>
                  ) : (
                    <p className="text-xs text-[var(--muted-foreground)]">
                      SMSBower did not expose a provider-side ranking for this country/service, so selection falls back to live stock and then lower cost inside the cheapest operator pool.
                    </p>
                  )}
                </>
              ) : (
                <p>
                  <span className="text-[var(--muted-foreground)]">
                    Operator cost (live):{" "}
                  </span>
                  <strong>
                    {formatNaira(
                      preview.providerCostNgn
                    )}
                  </strong>
                </p>
              )}

              {String(preview.providerCurrency || "").toUpperCase() === "USD" &&
                Number(preview.exchangeRateNgnPerUsd) > 0 && (
                  <p>
                    <span className="text-[var(--muted-foreground)]">
                      USD → NGN rate:{" "}
                    </span>
                    <strong>
                      ₦{Number(preview.exchangeRateNgnPerUsd).toLocaleString("en-NG")} / $1
                    </strong>
                  </p>
                )}

              <p>
                <span className="text-[var(--muted-foreground)]">
                  User pays:{" "}
                </span>
                <strong className="text-emerald-500">
                  {formatNaira(
                    preview.sellingPrice
                  )}
                </strong>
              </p>

              <p className="pt-1 text-xs text-[var(--muted-foreground)]">
                {form.pricingStyle ===
                "cheapest_buffer"
                  ? preview.providerStatsAvailable
                    ? `Auto-selected operator ${preview.operator} from the cheapest ${preview.eligibleCount || 1} candidate(s) using SMSBower provider-side ranking.`
                    : `Auto-selected operator ${preview.operator} from the cheapest ${preview.eligibleCount || 1} candidate(s) using live stock/cost fallback.`
                  : `Fixed to operator ${preview.operator}.`}
              </p>
            </div>
          ) : (
            <p className="text-[var(--muted-foreground)]">
              Select country/service and pricing settings to load the live operator pool, provider cost and customer price.
            </p>
          )}
        </div>

        <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-[var(--border)] px-4 text-sm font-bold">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(event) =>
              updateField(
                "isActive",
                event.target.checked
              )
            }
            className="h-4 w-4 accent-blue-600"
          />
          Rule is active
        </label>

        <div>
          <label className="text-sm font-bold">
            Admin notes
          </label>

          <textarea
            rows={3}
            maxLength={500}
            value={form.notes}
            onChange={(event) =>
              updateField(
                "notes",
                event.target.value
              )
            }
            placeholder="Optional internal note..."
            className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--foreground)] outline-none focus:border-blue-500"
          />
        </div>

        <Button
          type="submit"
          disabled={
            !saveReady || saving
          }
          className="w-full gap-2"
        >
          {saving ? (
            <LoaderCircle
              size={18}
              className="animate-spin"
            />
          ) : (
            <Save size={18} />
          )}

          {saving
            ? "Saving..."
            : editingRule
              ? "Update pricing"
              : "Save pricing"}
        </Button>
      </form>
    </section>
  );
}
