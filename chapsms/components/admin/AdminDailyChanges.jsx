"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { RefreshCw } from "lucide-react";

const nf = new Intl.NumberFormat("en-NG", { maximumFractionDigits: 2 });
const fmt = (v, kind = "money") => {
  if (v === null || v === undefined || v === "" || !Number.isFinite(Number(v))) return "—";
  return `${kind === "money" ? "₦" : ""}${nf.format(Number(v))}`;
};
const providerFmt = (record, field = "balance") => {
  const value = record && typeof record === "object" ? record[field] : (field === "balance" ? record : null);
  if (value === null || value === undefined || value === "" || !Number.isFinite(Number(value))) return "—";
  const currency = String(record?.currency || "NGN").toUpperCase() === "USD" ? "USD" : "NGN";
  return new Intl.NumberFormat(currency === "USD" ? "en-US" : "en-NG", {
    style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(Number(value));
};
const categories = [
  { title: "Overall (Numbers-only until Accounts & VPNs are connected)", key: "overall", fields: [
    ["Total Revenue", "revenue"], ["Total Profit", "profit"], ["Total Cost", "cost"], ["Total Orders", "orders", "count"] ] },
  { title: "Numbers", key: "numbers", fields: [
    ["Numbers Revenue", "revenue"], ["Numbers Profit", "profit"], ["Numbers Cost", "cost"],
    ["Number Orders", "orders", "count"], ["Received OTP", "receivedOtp", "count"] ] },
  { title: "Accounts & VPNs", key: "accounts", fields: [
    ["Revenue", "revenue"], ["Profit", "profit"], ["Cost", "cost"], ["Orders", "orders", "count"] ] },
  { title: "Platform", key: "platform", fields: [
    ["New Users", "users", "count"], ["Users' Balance Change", "usersBalanceChange"],
    ["Users' Closing Balance", "usersBalance"] ] },
  { title: "Provider Balances", key: "providers", fields: [
    ["Smsbower", "smsbower"], ["BenOTP", "benotp"], ["LoggsPlug", "loggsplug"],
    ["SamehaSocialHub", "samehasocialhub"] ] },
];
export default function AdminDailyChanges() {
  const { token, user, authLoading } = useAuth();
  const [days, setDays] = useState(7);
  const [selectedDate, setSelectedDate] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (authLoading) return;
    if (!token || user?.role !== "admin") { setError("Admin authentication required"); return; }
    const api = String(process.env.NEXT_PUBLIC_API_URL || "").replace(/\/+$/, "");
    if (!api) { setError("NEXT_PUBLIC_API_URL is missing"); return; }
    const abort = new AbortController();
    setLoading(true); setError("");
    fetch(`${api}/admin/daily-changes?days=${days}`, {
      headers: { Authorization: `Bearer ${token}` }, credentials: "include", cache: "no-store", signal: abort.signal,
    }).then(async r => {
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.message || `HTTP ${r.status}`);
      return body;
    }).then(result => { if (!abort.signal.aborted) setData(result); })
      .catch(e => { if (!abort.signal.aborted) { setData(null); setError(e.message); } })
      .finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [days, refresh, token, user?.role, authLoading]);
  const activeDate = data?.daily?.some(r => r.date === selectedDate) ? selectedDate : data?.daily?.[0]?.date;
  const row = data?.daily?.find(r => r.date === activeDate);
  return <section className="space-y-6 pb-10">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-bold">Daily Changes</h1><p className="text-sm text-slate-400">Daily movements across the admin dashboard</p></div>
      <div className="flex items-center gap-2">{[7,14,30].map(d => <button key={d} type="button" onClick={() => setDays(d)} className={`rounded-lg border px-3 py-2 text-sm ${days === d ? "border-blue-600 bg-blue-600 text-white" : "border-slate-700"}`}>{d}d</button>)}
        <button type="button" aria-label="Refresh" onClick={() => setRefresh(v => v + 1)} className="rounded-lg border border-slate-700 p-2"><RefreshCw size={18}/></button></div>
    </div>
    {error && <div role="alert" className="rounded-xl border border-red-700 bg-red-950/30 p-4 text-red-300">{error}</div>}
    {loading && <p className="text-sm text-slate-400">Loading daily changes…</p>}
    {data && <>
      <div className="flex flex-wrap items-center gap-3"><label htmlFor="daily-change-date" className="text-sm font-semibold">Reporting date</label>
        <select id="daily-change-date" value={activeDate || ""} onChange={e => setSelectedDate(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white">{data.daily.map(r => <option key={r.date} value={r.date}>{r.date}</option>)}</select>
        <span className="text-xs text-slate-400">Africa/Lagos</span></div>
      {categories.map(section => <div key={section.key} className="space-y-3">
        <h2 className="font-semibold">{section.title}</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{section.fields.map(([label, field, kind]) => {
          const value = row?.[section.key]?.[field];
          const isProvider = section.key === "providers";
          return <div key={field} className="rounded-2xl border border-slate-700/70 bg-slate-900/80 p-5">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</div>
            <div className="mt-3 text-2xl font-extrabold">{isProvider ? providerFmt(value) : fmt(value, kind)}</div>
            <div className="mt-2 text-xs text-slate-400">{isProvider ? (value?.balance == null ? "No recorded snapshot for this date" : `Daily change: ${providerFmt(value, "change")}`) : (value == null ? "Historical data not connected" : `Change / value for ${activeDate}`)}</div>
          </div>;
        })}</div>
      </div>)}
      <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/80">
        <h2 className="border-b border-slate-700 p-4 font-semibold">Daily history</h2>
        <div className="overflow-x-auto"><table className="min-w-[2400px] w-full text-sm">
          <thead><tr className="text-left text-slate-400">{[
            "Date", "Overall Revenue", "Overall Profit", "Overall Cost", "Overall Orders",
            "Numbers Revenue", "Numbers Profit", "Numbers Cost", "Numbers Orders", "Received OTP",
            "Accounts Revenue", "Accounts Profit", "Accounts Cost", "Accounts Orders",
            "New Users", "Users' Balance Change", "Users' Closing Balance",
            "SMSBower Balance", "SMSBower Change", "BenOTP Balance", "BenOTP Change",
            "LoggsPlug Balance", "LoggsPlug Change", "SameehaSocialHub Balance", "SameehaSocialHub Change"
          ].map(t => <th key={t} className="whitespace-nowrap p-3">{t}</th>)}</tr></thead>
          <tbody>{data.daily.map(r => {
            const cells = [
              fmt(r.overall?.revenue),fmt(r.overall?.profit),fmt(r.overall?.cost),fmt(r.overall?.orders,"count"),
              fmt(r.numbers?.revenue),fmt(r.numbers?.profit),fmt(r.numbers?.cost),fmt(r.numbers?.orders,"count"),fmt(r.numbers?.receivedOtp,"count"),
              fmt(r.accounts?.revenue),fmt(r.accounts?.profit),fmt(r.accounts?.cost),fmt(r.accounts?.orders,"count"),
              fmt(r.platform?.users,"count"),fmt(r.platform?.usersBalanceChange),fmt(r.platform?.usersBalance),
              ...["smsbower","benotp","loggsplug","samehasocialhub"].flatMap(k => [providerFmt(r.providers?.[k]),providerFmt(r.providers?.[k],"change")]),
            ];
            return <tr key={r.date} className="border-t border-slate-700/60"><td className="whitespace-nowrap p-3">{r.date}</td>{cells.map((v,i) => <td key={i} className="whitespace-nowrap p-3">{v}</td>)}</tr>;
          })}</tbody></table></div>
      </div>
      <div className="space-y-1 text-xs text-slate-400"><p>Overall combines Numbers and completed, non-refunded Accounts & VPNs orders.</p><p>Provider daily changes require historical balance snapshots. “—” means unavailable, not zero.</p><p>Users' historical closing balances are estimates reconstructed from current live balances and completed wallet transactions.</p></div>
    </>}
  </section>;
}
