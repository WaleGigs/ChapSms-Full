"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CircleDollarSign,
  CreditCard,
  MessageSquareText,
  PackageCheck,
  ReceiptText,
  Server,
  TrendingUp,
  Users,
  WalletCards,
} from "lucide-react";

import AdminSummaryCard from "@/components/admin/AdminSummaryCard";
import { adminPricingService } from "@/services/adminPricingService";
import { socialService } from "@/services/socialService";

function formatNaira(value) {
  return `₦${Number(value || 0).toLocaleString("en-NG", {
    maximumFractionDigits: 2,
  })}`;
}

function formatCount(value) {
  return Number(value || 0).toLocaleString("en-NG");
}

function formatDeltaNaira(value) {
  const number = Number(value || 0);
  const sign = number < 0 ? "−" : "+";
  return `${sign}₦${Math.abs(number).toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;
}

function formatDeltaCount(value) {
  const number = Number(value || 0);
  const sign = number < 0 ? "−" : "+";
  return `${sign}${Math.abs(number).toLocaleString("en-NG")}`;
}

function formatBalance(item) {
  if (!item || item.balance === null || item.balance === undefined) return "—";
  const value = Number(item.balance);
  if (!Number.isFinite(value)) return "—";
  const currency = String(item.currency || "NGN").toUpperCase();

  if (currency === "USD") {
    return `$${value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  return `₦${value.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function findNumberBalance(summary, server) {
  return (summary?.providerBalances || []).find((item) => item.server === server) || null;
}

function findSocialBalance(summary, provider) {
  return (summary?.providerBalances || []).find((item) => item.provider === provider) || null;
}

function Section({ title, children }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-black text-[var(--foreground)] sm:text-base">
        {title}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}

export default function AdminOverviewPage() {
  const [numbers, setNumbers] = useState(null);
  const [socials, setSocials] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      setError("");

      const [numberResult, socialResult] = await Promise.allSettled([
        adminPricingService.getSummary(),
        socialService.getAdminSummary(),
      ]);

      if (numberResult.status === "fulfilled") {
        setNumbers(numberResult.value?.summary || null);
      } else {
        throw numberResult.reason;
      }

      if (socialResult.status === "fulfilled") {
        setSocials(socialResult.value || null);
      } else {
        setSocials(null);
      }
    } catch (requestError) {
      setError(requestError?.message || "Unable to load admin dashboard");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();

    const timer = window.setInterval(() => {
      load({ silent: true });
    }, 15000);

    return () => window.clearInterval(timer);
  }, [load]);

  const numberRevenue = Number(numbers?.totalRevenue || 0);
  const numberCost = Number(numbers?.totalCost ?? numbers?.totalProviderCost ?? 0);
  const numberProfit = Number(numbers?.totalProfit || 0);
  const socialRevenue = Number(socials?.totalRevenue || 0);
  const socialCost = Number(socials?.totalCost || 0);
  const socialProfit = Number(socials?.totalProfit || 0);

  const todayNumberRevenue = Number(numbers?.todayRevenue || 0);
  const todayNumberCost = Number(numbers?.todayCost ?? numbers?.todayProviderCost ?? 0);
  const todayNumberProfit = Number(numbers?.todayProfit || 0);
  const todayNumberOrders = Number(numbers?.todayOrders || 0);
  const todayReceivedOtps = Number(numbers?.todayReceivedOtps || 0);

  const todaySocialRevenue = Number(socials?.todayRevenue || 0);
  const todaySocialCost = Number(socials?.todayCost || 0);
  const todaySocialProfit = Number(socials?.todayProfit || 0);
  const todaySocialOrders = Number(socials?.todayOrders || 0);

  const smsBower = findNumberBalance(numbers, "server1");
  const benOtp = findNumberBalance(numbers, "server2");
  const loggsplug = findSocialBalance(socials, "loggsplug");
  const sameeha = findSocialBalance(socials, "sameeha");

  return (
    <div className="space-y-7">
      {error ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-semibold text-red-500">
          {error}
        </div>
      ) : null}

      <Section title="Overview">
        <AdminSummaryCard
          label="Total revenue"
          value={formatNaira(numberRevenue + socialRevenue)}
          delta={formatDeltaNaira(todayNumberRevenue + todaySocialRevenue)}
          icon={CircleDollarSign}
          loading={loading}
        />
        <AdminSummaryCard
          label="Total profit"
          value={formatNaira(numberProfit + socialProfit)}
          delta={formatDeltaNaira(todayNumberProfit + todaySocialProfit)}
          icon={TrendingUp}
          loading={loading}
        />
        <AdminSummaryCard
          label="Total cost"
          value={formatNaira(numberCost + socialCost)}
          delta={formatDeltaNaira(todayNumberCost + todaySocialCost)}
          icon={CreditCard}
          loading={loading}
        />
        <AdminSummaryCard
          label="Total orders"
          value={formatCount(Number(numbers?.totalOrders || 0) + Number(socials?.totalOrders || 0))}
          delta={formatDeltaCount(todayNumberOrders + todaySocialOrders)}
          icon={ReceiptText}
          loading={loading}
        />
      </Section>

      <Section title="Numbers">
        <AdminSummaryCard label="Numbers revenue" value={formatNaira(numberRevenue)} delta={formatDeltaNaira(todayNumberRevenue)} icon={CircleDollarSign} loading={loading} />
        <AdminSummaryCard label="Numbers profit" value={formatNaira(numberProfit)} delta={formatDeltaNaira(todayNumberProfit)} icon={TrendingUp} loading={loading} />
        <AdminSummaryCard label="Numbers cost" value={formatNaira(numberCost)} delta={formatDeltaNaira(todayNumberCost)} icon={CreditCard} loading={loading} />
        <AdminSummaryCard label="Number orders" value={formatCount(numbers?.totalOrders)} delta={formatDeltaCount(todayNumberOrders)} icon={ReceiptText} loading={loading} />
        <AdminSummaryCard label="Received OTP" value={formatCount(numbers?.receivedOtps ?? numbers?.receivedOrders)} delta={formatDeltaCount(todayReceivedOtps)} icon={MessageSquareText} loading={loading} />
      </Section>

      <Section title="Accounts & VPNs">
        <AdminSummaryCard label="Account & VPN revenue" value={formatNaira(socialRevenue)} delta={formatDeltaNaira(todaySocialRevenue)} icon={CircleDollarSign} loading={loading} />
        <AdminSummaryCard label="Account & VPN profit" value={formatNaira(socialProfit)} delta={formatDeltaNaira(todaySocialProfit)} icon={TrendingUp} loading={loading} />
        <AdminSummaryCard label="Account & VPN cost" value={formatNaira(socialCost)} delta={formatDeltaNaira(todaySocialCost)} icon={CreditCard} loading={loading} />
        <AdminSummaryCard label="Account & VPN orders" value={formatCount(socials?.totalOrders)} delta={formatDeltaCount(todaySocialOrders)} icon={PackageCheck} loading={loading} />
      </Section>

      <Section title="Platform">
        <AdminSummaryCard label="Users" value={formatCount(numbers?.totalUsers)} delta={formatDeltaCount(numbers?.todayUsers)} icon={Users} loading={loading} />
        <AdminSummaryCard label="Users' balance" value={formatNaira(numbers?.usersBalance)} delta={formatDeltaNaira(numbers?.todayUsersBalanceDelta)} icon={WalletCards} loading={loading} />
        <AdminSummaryCard label="SMSBower Balance" value={formatBalance(smsBower)} icon={Server} loading={loading} />
        <AdminSummaryCard label="BenOTP Balance" value={formatBalance(benOtp)} icon={Server} loading={loading} />
        <AdminSummaryCard label="LoggsPlug Balance" value={formatBalance(loggsplug)} icon={Server} loading={loading} />
        <AdminSummaryCard label="SameehaSocialHub Balance" value={formatBalance(sameeha)} icon={Server} loading={loading} />
      </Section>
    </div>
  );
}
