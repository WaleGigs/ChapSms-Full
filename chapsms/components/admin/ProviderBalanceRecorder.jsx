"use client";
import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";

// Mount this in the existing admin overview, passing its fetched numbers/socials summaries.
// Only saves balances already fetched by your existing provider integrations.
export default function ProviderBalanceRecorder({ numbers, socials }) {
  const { token, user } = useAuth();
  useEffect(() => {
    if (!token || user?.role !== "admin") return;
    const balances = [];
    const serverMap = { server1: "smsbower", server2: "benotp" };
    for (const item of numbers?.providerBalances || []) {
      if (serverMap[item.server] && item.balance != null && Number.isFinite(Number(item.balance))) balances.push({
        provider: serverMap[item.server], balance: item.balance,
        currency: String(item.currency || (item.server === "server1" ? "USD" : "NGN")).toUpperCase(),
      });
    }
    const socialMap = { loggsplug: "loggsplug", sameeha: "samehasocialhub" };
    for (const item of socials?.providerBalances || []) {
      if (socialMap[item.provider] && item.balance != null && Number.isFinite(Number(item.balance))) balances.push({
        provider: socialMap[item.provider], balance: item.balance,
        currency: String(item.currency || "NGN").toUpperCase(),
      });
    }
    if (!balances.length) return;
    const api = String(process.env.NEXT_PUBLIC_API_URL || "").replace(/\/+$/, "");
    if (!api) return;
    const controller = new AbortController();
    fetch(`${api}/admin/daily-changes/provider-snapshots`, {
      method: "POST", credentials: "include", signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ balances }),
    }).then(async (response) => {
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        console.error("Provider balance snapshot save failed:", response.status, payload.message || "Unknown error");
      }
    }).catch((error) => {
      if (error?.name !== "AbortError") console.error("Provider balance snapshot request failed:", error);
    });
    return () => controller.abort();
  }, [numbers, socials, token, user?.role]);
  return null;
}
