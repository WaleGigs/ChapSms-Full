"use client";

import { useEffect, useState } from "react";
import { BadgeDollarSign } from "lucide-react";

import PricingRuleForm from "@/components/admin/PricingRuleForm";
import PricingRulesTable from "@/components/admin/PricingRulesTable";
import { useAdminPricingRules } from "@/hooks/useAdminPricing";

export default function NumberPricingPanel() {
  const [serverFilter, setServerFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [page, setPage] = useState(1);
  const [editingRule, setEditingRule] = useState(null);

  const {
    rules,
    pagination,
    loading,
    error,
    reload,
  } = useAdminPricingRules({
    server: serverFilter,
    isActive: activeFilter,
    page,
    limit: 25,
  });

  useEffect(() => {
    setPage(1);
  }, [serverFilter, activeFilter]);

  function handleSaved() {
    setEditingRule(null);
    reload();
  }

  function handleEdit(rule) {
    setEditingRule(rule);
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">
          Server pricing
        </p>
        <div className="mt-2 flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
            <BadgeDollarSign size={22} />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-[var(--foreground)] sm:text-4xl">
              Pricing Management
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted-foreground)] sm:text-base">
              Set the price customers pay on ChapsSmS. Every preview shows the provider’s current cost, your selling price and expected profit.
            </p>
          </div>
        </div>
      </div>

      <PricingRuleForm
        editingRule={editingRule}
        onSaved={handleSaved}
        onCancelEdit={() => setEditingRule(null)}
      />

      <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:max-w-2xl">
          <div>
            <label className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
              Filter by server
            </label>
            <select
              value={serverFilter}
              onChange={(event) => setServerFilter(event.target.value)}
              className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-sm font-semibold text-[var(--foreground)] outline-none focus:border-blue-500"
            >
              <option value="">All servers</option>
              <option value="server1">Server 1 — SMSBower</option>
              <option value="server2">Server 2 — BenOTP</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
              Rule status
            </label>
            <select
              value={activeFilter}
              onChange={(event) => setActiveFilter(event.target.value)}
              className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-sm font-semibold text-[var(--foreground)] outline-none focus:border-blue-500"
            >
              <option value="">All rules</option>
              <option value="true">Active</option>
              <option value="false">Disabled</option>
            </select>
          </div>
        </div>
      </section>

      <PricingRulesTable
        rules={rules}
        loading={loading}
        error={error}
        onEdit={handleEdit}
        onReload={reload}
      />

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
