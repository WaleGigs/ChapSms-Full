"use client";

import {
  Edit3,
  LoaderCircle,
  Power,
  RefreshCw,
} from "lucide-react";
import toast from "react-hot-toast";

import Button from "@/components/ui/Button";
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

function getRuleId(rule) {
  return toPrimitiveString(
    rule?.id ?? rule?._id
  );
}

function getRuleKey(rule, index) {
  const id = getRuleId(rule);

  if (id) {
    return `rule-${id}-${index}`;
  }

  return [
    "rule",
    toPrimitiveString(rule?.server),
    toPrimitiveString(rule?.country),
    toPrimitiveString(rule?.service),
    toPrimitiveString(rule?.operator),
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

function getModeLabel(rule) {
  if (rule.pricingMode === "fixed") {
    return `Fixed ${formatNaira(rule.fixedSellingPrice)}`;
  }

  if (rule.pricingMode === "cost_plus") {
    return `Cost + ${formatNaira(rule.fixedMarkup)}`;
  }

  return `${Number(rule.markupPercent || 0)}% markup`;
}

function getStyleLabel(rule) {
  const style =
    rule.pricingStyle ||
    (
      String(
        rule.operator || "any"
      ).toLowerCase() === "any"
        ? "cheapest_buffer"
        : "fixed_operator"
    );

  if (style === "cheapest_buffer") {
    return `Cheapest + ${Number(
      rule.maxPriceBufferPercent ?? 50
    )}% buffer`;
  }

  return `Fixed operator ${rule.operator}`;
}

export default function PricingRulesTable({
  rules = [],
  loading = false,
  error = "",
  onEdit,
  onReload,
}) {
  async function handleDisable(rule) {
    const confirmed = window.confirm(
      `Disable the pricing rule for ${
        rule.serviceName || rule.service
      } in ${rule.countryName || rule.country}?`
    );

    if (!confirmed) {
      return;
    }

    const ruleId = getRuleId(rule);

    if (!ruleId) {
      toast.error("This pricing rule has no valid ID");
      return;
    }

    try {
      await adminPricingService.disableRule(ruleId);
      toast.success("Pricing rule disabled");
      onReload?.();
    } catch (requestError) {
      toast.error(
        requestError?.message ||
          "Unable to disable pricing rule"
      );
    }
  }

  return (
    <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
      <div className="flex flex-col justify-between gap-4 border-b border-[var(--border)] p-5 sm:flex-row sm:items-start sm:p-6">
        <div>
          <h2 className="text-xl font-black text-[var(--foreground)]">
            Saved pricing rules
          </h2>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            Every server, country, service and operator combination keeps its own selling rule.
          </p>
        </div>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onReload}
          className="gap-2"
        >
          <RefreshCw size={16} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="m-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300 sm:m-6">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-3 px-6 py-16 text-sm font-semibold text-[var(--muted-foreground)]">
          <LoaderCircle className="animate-spin" size={20} />
          Loading pricing rules...
        </div>
      ) : rules.length === 0 ? (
        <div className="px-6 py-16 text-center">
          <Power className="mx-auto text-[var(--muted-foreground)]" size={30} />
          <p className="mt-4 font-black text-[var(--foreground)]">
            No pricing rules yet
          </p>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            Create the first rule using the pricing form above.
          </p>
        </div>
      ) : (
        <>
          <div className="divide-y divide-[var(--border)] md:hidden">
            {rules.map((rule, index) => (
              <article
                key={getRuleKey(rule, index)}
                className="p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-[var(--foreground)]">
                      {rule.serviceName || rule.service}
                    </p>
                    <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                      {rule.countryName || rule.country} · {getStyleLabel(rule)}
                    </p>
                  </div>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-black ${
                      rule.isActive
                        ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                        : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    {rule.isActive ? "Active" : "Disabled"}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-[var(--muted)] p-3">
                    <p className="text-xs text-[var(--muted-foreground)]">Server</p>
                    <p className="mt-1 font-black text-[var(--foreground)]">
                      {rule.server === "server1" ? "Server 1" : "Server 2"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[var(--muted)] p-3">
                    <p className="text-xs text-[var(--muted-foreground)]">Pricing</p>
                    <p className="mt-1 font-black text-[var(--foreground)]">
                      {getModeLabel(rule)}
                    </p>
                  </div>
                </div>

                <p className="mt-4 text-xs text-[var(--muted-foreground)]">
                  Updated {formatDateTime(rule.updatedAt)}
                </p>

                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => onEdit?.(rule)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm font-bold transition hover:bg-[var(--muted)]"
                  >
                    <Edit3 size={15} /> Edit
                  </button>

                  {rule.isActive && (
                    <button
                      type="button"
                      onClick={() => handleDisable(rule)}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-200 px-3 py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30"
                    >
                      <Power size={15} /> Disable
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className="border-b border-[var(--border)] text-xs uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
                <tr>
                  <th className="px-6 py-4">Server</th>
                  <th className="px-4 py-4">Country</th>
                  <th className="px-4 py-4">Service</th>
                  <th className="px-4 py-4">Pricing style</th>
                  <th className="px-4 py-4">Pricing</th>
                  <th className="px-4 py-4">Status</th>
                  <th className="px-4 py-4">Updated</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[var(--border)]">
                {rules.map((rule, index) => (
                  <tr
                    key={getRuleKey(rule, index)}
                    className="transition hover:bg-[var(--muted)]/60"
                  >
                    <td className="px-6 py-4 font-black text-[var(--foreground)]">
                      {rule.server === "server1" ? "Server 1" : "Server 2"}
                    </td>
                    <td className="px-4 py-4 font-semibold text-[var(--foreground)]">
                      {rule.countryName || rule.country}
                    </td>
                    <td className="px-4 py-4 font-semibold text-[var(--foreground)]">
                      {rule.serviceName || rule.service}
                    </td>
                    <td className="px-4 py-4 text-[var(--muted-foreground)]">
                      {getStyleLabel(rule)}
                    </td>
                    <td className="px-4 py-4 font-black text-blue-600">
                      {getModeLabel(rule)}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-black ${
                          rule.isActive
                            ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                            : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        }`}
                      >
                        {rule.isActive ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-xs text-[var(--muted-foreground)]">
                      {formatDateTime(rule.updatedAt)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => onEdit?.(rule)}
                          className="rounded-lg border border-[var(--border)] p-2 text-[var(--foreground)] transition hover:bg-[var(--muted)]"
                          aria-label="Edit pricing rule"
                        >
                          <Edit3 size={16} />
                        </button>

                        {rule.isActive && (
                          <button
                            type="button"
                            onClick={() => handleDisable(rule)}
                            className="rounded-lg border border-red-200 p-2 text-red-600 transition hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30"
                            aria-label="Disable pricing rule"
                          >
                            <Power size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
