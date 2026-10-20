"use client";

import { useEffect, useRef, useState } from "react";
import {
  CalendarDays, ChevronLeft, ChevronRight, CreditCard, MessageSquare, RefreshCw,
  Server, ShoppingCart, TrendingUp, UserPlus, Wallet, X,
} from "lucide-react";
import { api } from "@/lib/api";

const TREND_DAYS = 14;

const naira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 2 });
const formatNGN = (value) => naira.format(Number(value) || 0);
const providerMoney = (value, currency) => new Intl.NumberFormat(currency === "USD" ? "en-US" : "en-NG", {
  style: "currency", currency: currency === "USD" ? "USD" : "NGN", minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(Number(value) || 0);

/** Today's date in Lagos as YYYY-MM-DD — the backend's day boundary. */
const lagosToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
const shiftDay = (ymd, n) => new Date(Date.parse(`${ymd}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
// "2026-05-05" → "5/5/26" (day/month/year, as Nigeria writes it).
const shortDayLabel = (ymd) => {
  const [y, m, d] = ymd.split("-");
  return `${Number(d)}/${Number(m)}/${y.slice(2)}`;
};
const longDayLabel = (ymd) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-GB", {
  weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
});
/** "Today" / "Yesterday" / "Thu, 8 Oct" from a Lagos YYYY-MM-DD. */
function trendDayLabel(ymd) {
  const today = lagosToday();
  if (ymd === today) return "Today";
  if (ymd === shiftDay(today, -1)) return "Yesterday";
  return new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short",
    ...(ymd.slice(0, 4) === today.slice(0, 4) ? {} : { year: "numeric" }), timeZone: "UTC",
  });
}

const PROVIDERS = [
  ["smsbower", "SMSBower"], ["benotp", "BenOTP"], ["loggsplug", "LoggsPlug"], ["samehasocialhub", "SamehaSocialHub"],
];

/**
 * "+25%" vs the compared day, plus a tone. `invert` flips the tone for
 * metrics where going up is bad (cost).
 */
function dayDelta(cur, prev, { money = false, invert = false } = {}) {
  const c = Number(cur || 0);
  const p = Number(prev || 0);
  const diff = c - p;
  if (diff === 0) return { text: "No change", tone: null };
  const sign = diff < 0 ? "−" : "+";
  // Nothing the day before: a percentage is meaningless, so show the amount.
  const text = p !== 0
    ? `${sign}${Math.abs((diff / Math.abs(p)) * 100).toFixed(0)}%`
    : `${sign}${money ? formatNGN(Math.abs(diff)) : Math.abs(diff).toLocaleString()}`;
  const good = invert ? diff < 0 : diff > 0;
  return { text, tone: good ? "up" : "down" };
}

const FOOT_TONES = {
  up: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
  down: "border-red-500/30 bg-red-500/10 text-red-500",
};
const ICON_TONES = {
  emerald: "bg-emerald-500/10 text-emerald-500",
  blue: "bg-blue-500/10 text-blue-500",
  red: "bg-red-500/10 text-red-500",
  amber: "bg-amber-500/10 text-amber-500",
  sky: "bg-sky-500/10 text-sky-500",
};
const deltaPill = (delta) => (
  <span className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold tabular-nums sm:px-2 sm:text-[11px] ${FOOT_TONES[delta.tone] || "border-[var(--border)] bg-[var(--muted)] text-[var(--muted-foreground)]"}`}>
    {delta.text}
  </span>
);

function Stat({ label, value, icon: Icon, tone = "blue", accent = false, delta, deltaTitle, note }) {
  return (
    <div className={`rounded-2xl border bg-[var(--card)] p-3 sm:p-5 ${accent ? "border-blue-500/40 shadow-lg shadow-blue-500/10" : "border-[var(--border)]"}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)] sm:text-xs">{label}</div>
        {Icon && <span className={`hidden h-8 w-8 shrink-0 items-center justify-center rounded-xl sm:flex ${ICON_TONES[tone]}`}><Icon size={16} /></span>}
      </div>
      <div className={`mt-1.5 truncate text-base font-black tabular-nums sm:mt-2 sm:text-2xl ${accent ? "text-blue-500" : "text-[var(--foreground)]"}`}>{value}</div>
      {(delta || note) && (
        <div className="mt-1 flex items-center justify-between gap-2" title={deltaTitle}>
          <span className="truncate text-[10px] text-[var(--muted-foreground)] sm:text-xs">{note}</span>
          {delta && deltaPill(delta)}
        </div>
      )}
    </div>
  );
}

/**
 * Card in Compare mode: the picked day (A) on top, the compare day (B) under
 * it, and the % change beside A.
 */
function CompareStat({ label, a, b, delta, accent = false }) {
  return (
    <div className={`rounded-2xl border bg-[var(--card)] p-3 sm:p-5 ${accent ? "border-blue-500/40 shadow-lg shadow-blue-500/10" : "border-[var(--border)]"}`}>
      <div className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)] sm:text-xs">{label}</div>
      <div className={`mt-1.5 truncate text-base font-black tabular-nums sm:mt-2 sm:text-2xl ${accent ? "text-blue-500" : "text-[var(--foreground)]"}`}>{a.value}</div>
      <div className="mt-0.5 flex items-center justify-between gap-2">
        <span className="text-[10px] tabular-nums text-[var(--muted-foreground)] sm:text-xs">{shortDayLabel(a.date)}</span>
        {deltaPill(delta)}
      </div>
      <div className="mt-2 border-t border-[var(--border)] pt-2">
        <div className="truncate text-sm font-semibold tabular-nums text-[var(--muted-foreground)] sm:text-base">{b.value}</div>
        <div className="text-[10px] tabular-nums text-[var(--muted-foreground)] sm:text-xs">{shortDayLabel(b.date)}</div>
      </div>
    </div>
  );
}

const SectionTitle = ({ children }) => (
  <h2 className="mb-2.5 mt-6 text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted-foreground)] first:mt-0 sm:mb-3">{children}</h2>
);

// Reports already loaded this session, keyed by day, so stepping back and
// forth between days is instant. Refresh skips it.
const reportCache = new Map();
const CACHE_MS = 60000;

async function fetchDaily(date, days, fresh = false) {
  const key = `${date}:${days}`;
  const hit = reportCache.get(key);
  if (hit && !fresh && Date.now() - hit.at < CACHE_MS) return hit.rows;
  const params = new URLSearchParams({ date, days: String(days) });
  if (fresh) params.set("fresh", "1");
  const response = await api(`/admin/daily-changes?${params.toString()}`);
  const rows = Array.isArray(response?.rows) ? response.rows : [];
  reportCache.set(key, { rows, at: Date.now() });
  return rows;
}

/**
 * Daily changes: every dashboard metric for one Lagos day of the admin's
 * choosing, plus a trend table of the 14 days ending on it. Change pills
 * compare against a second day the admin picks with Compare; with none
 * picked, today is compared with yesterday and a past day with the day before.
 */
export default function AdminDailyChanges() {
  const [date, setDate] = useState(lagosToday);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [compare, setCompare] = useState(""); // "" = no compare day picked
  const [compareRow, setCompareRow] = useState(null);
  const forceRef = useRef(false);
  const today = lagosToday();

  useEffect(() => {
    let cancelled = false;
    const fresh = forceRef.current;
    forceRef.current = false;
    setLoading(true); // eslint-disable-line react-hooks/set-state-in-effect
    fetchDaily(date, TREND_DAYS, fresh)
      .then((next) => { if (!cancelled) { setRows(next); setErr(""); } })
      .catch((e) => { if (!cancelled) setErr(e.message || "Failed to load daily changes"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [date, refreshKey]);

  useEffect(() => {
    if (!compare) { setCompareRow(null); return; } // eslint-disable-line react-hooks/set-state-in-effect
    let cancelled = false;
    fetchDaily(compare, 1)
      .then((next) => { if (!cancelled) setCompareRow(next.length ? next[next.length - 1] : null); })
      .catch(() => { if (!cancelled) setCompareRow(null); });
    return () => { cancelled = true; };
  }, [compare]);

  const refresh = () => { forceRef.current = true; setRefreshKey((n) => n + 1); };

  // While another day loads, the last one stays up, dimmed.
  const day = rows.length ? rows[rows.length - 1] : null;
  const dayBefore = rows.length > 1 ? rows[rows.length - 2] : null;
  // What the pills compare against: the picked day, else the day before.
  const prev = compare ? (compareRow?.date === compare ? compareRow : null) : dayBefore;
  // The first row only exists to give the oldest visible day its comparison.
  const trend = rows.slice(1).reverse();

  const sum = (r, k) => (r ? Number(r.numbers[k] || 0) + Number(r.socials[k] || 0) : 0);
  const card = (label, cur, before, { money = false, invert = false, signed = false, icon, tone, accent = false } = {}) => {
    const d = dayDelta(cur, before, { money, invert });
    const fmt = (v) => {
      const n = Number(v || 0);
      if (signed) return `${n < 0 ? "−" : "+"}${formatNGN(Math.abs(n))}`;
      return money ? formatNGN(n) : n.toLocaleString();
    };
    if (compare && prev) {
      return <CompareStat key={label} label={label} accent={accent} a={{ date, value: fmt(cur) }} b={{ date: prev.date, value: fmt(before) }} delta={d} />;
    }
    return (
      <Stat
        key={label} label={label} value={fmt(cur)} icon={icon} tone={tone} accent={accent}
        delta={prev ? d : null}
        deltaTitle={prev ? `vs ${longDayLabel(prev.date)}: ${fmt(before)}` : undefined}
      />
    );
  };
  const providerCard = ([key, label]) => {
    const p = day?.providers?.[key];
    const before = prev?.providers?.[key];
    if (!p) return <Stat key={key} label={label} value="—" icon={Server} tone="sky" note="Not recorded yet" />;
    if (p.asOf !== day.date) {
      return <Stat key={key} label={label} value={providerMoney(p.balance, p.currency)} icon={Server} tone="sky" note={`Last recorded ${shortDayLabel(p.asOf)}`} />;
    }
    const change = compare
      ? (before && before.currency === p.currency ? p.balance - before.balance : null)
      : p.change;
    const delta = change == null ? null : {
      text: change === 0 ? "No change" : `${change < 0 ? "−" : "+"}${providerMoney(Math.abs(change), p.currency)}`,
      tone: change === 0 ? null : change > 0 ? "up" : "down",
    };
    const vs = compare ? before && prev.date : p.since;
    return (
      <Stat
        key={key} label={label} value={providerMoney(p.balance, p.currency)} icon={Server} tone="sky" delta={delta}
        note={vs ? `vs ${shortDayLabel(vs)}` : "First snapshot"}
      />
    );
  };

  const th = "whitespace-nowrap px-3 py-2.5 text-right font-semibold";
  const td = "whitespace-nowrap px-3 py-2.5 text-right tabular-nums";
  const netTone = (n) => (n < 0 ? "text-red-500" : n > 0 ? "text-emerald-500" : "");
  const signedNGN = (n) => `${n < 0 ? "−" : "+"}${formatNGN(Math.abs(n))}`;
  const datePickerClick = (e) => { try { e.currentTarget.showPicker?.(); } catch { /* not supported */ } };

  return (
    <main className="space-y-6 pb-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-black text-[var(--foreground)]"><CalendarDays className="text-blue-500" /> Daily Changes</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {longDayLabel(date)}{prev ? ` · compared with ${longDayLabel(prev.date)}` : compare ? " · loading comparison…" : ""}
          </p>
        </div>
        <div className="flex w-full items-center gap-1.5 sm:w-auto sm:gap-2">
          <button type="button" onClick={() => setDate(shiftDay(date, -1))} className="shrink-0 rounded-xl border border-[var(--border)] bg-[var(--card)] p-2.5 hover:bg-[var(--muted)]" aria-label="Previous day">
            <ChevronLeft size={16} />
          </button>
          {/* The native date box clips on phones, so show our own label and
              lay the real (invisible) input over it to open the picker. */}
          <label className="relative flex flex-1 cursor-pointer items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm font-semibold text-[var(--foreground)] focus-within:border-blue-500 sm:w-32 sm:flex-none">
            <span className="whitespace-nowrap tabular-nums">{shortDayLabel(date)}</span>
            <input
              type="date" value={date} max={today}
              onChange={(e) => e.target.value && setDate(e.target.value > today ? today : e.target.value)}
              onClick={datePickerClick}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              aria-label="Pick a day"
            />
          </label>
          <button type="button" onClick={() => setDate(shiftDay(date, 1))} disabled={date >= today} className="shrink-0 rounded-xl border border-[var(--border)] bg-[var(--card)] p-2.5 hover:bg-[var(--muted)] disabled:opacity-40" aria-label="Next day">
            <ChevronRight size={16} />
          </button>
          {/* Compare: pick a second day; every card shows the change against it. */}
          <label className={`relative inline-flex shrink-0 cursor-pointer items-center rounded-xl border px-3 py-2 text-sm font-semibold tabular-nums transition ${
            compare ? "border-blue-500/50 bg-blue-500/10 text-blue-500" : "border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          }`}>
            {compare ? shortDayLabel(compare) : "Compare"}
            <input
              type="date" value={compare} max={today}
              onChange={(e) => setCompare(e.target.value > today ? today : e.target.value)}
              onClick={datePickerClick}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              aria-label="Pick a day to compare with"
            />
          </label>
          {compare && (
            <button type="button" onClick={() => setCompare("")} className="shrink-0 rounded-xl border border-[var(--border)] bg-[var(--card)] p-2.5 hover:bg-[var(--muted)]" aria-label="Stop comparing">
              <X size={14} />
            </button>
          )}
          <button type="button" onClick={refresh} className="shrink-0 rounded-xl border border-[var(--border)] bg-[var(--card)] p-2.5 hover:bg-[var(--muted)]" aria-label="Refresh">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {err ? (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <span>{err}</span>
          <button type="button" onClick={refresh} className="rounded-lg border border-red-500/30 px-2 py-1 text-xs">Retry</button>
        </div>
      ) : !day ? (
        <p className="text-sm text-[var(--muted-foreground)]">Loading daily changes…</p>
      ) : (
        <div className={`transition-opacity ${loading ? "opacity-60" : ""}`}>
          <SectionTitle>Total (Numbers + Accounts &amp; VPNs)</SectionTitle>
          <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
            {card("Revenue", sum(day, "revenue"), sum(prev, "revenue"), { money: true, icon: Wallet, tone: "emerald", accent: true })}
            {card("Profit", sum(day, "profit"), sum(prev, "profit"), { money: true, icon: TrendingUp, tone: "blue", accent: true })}
            {card("Cost", sum(day, "cost"), sum(prev, "cost"), { money: true, invert: true, icon: CreditCard, tone: "red" })}
            {card("Orders", sum(day, "orders"), sum(prev, "orders"), { icon: ShoppingCart, tone: "blue" })}
          </div>

          <SectionTitle>Numbers</SectionTitle>
          <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
            {card("Numbers revenue", day.numbers.revenue, prev?.numbers.revenue, { money: true, icon: Wallet, tone: "emerald" })}
            {card("Numbers profit", day.numbers.profit, prev?.numbers.profit, { money: true, icon: TrendingUp, tone: "blue" })}
            {card("Numbers cost", day.numbers.cost, prev?.numbers.cost, { money: true, invert: true, icon: CreditCard, tone: "red" })}
            {card("Received OTPs", day.numbers.received, prev?.numbers.received, { icon: MessageSquare, tone: "emerald" })}
          </div>

          <SectionTitle>Accounts &amp; VPNs</SectionTitle>
          <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
            {card("Accounts revenue", day.socials.revenue, prev?.socials.revenue, { money: true, icon: Wallet, tone: "emerald" })}
            {card("Accounts profit", day.socials.profit, prev?.socials.profit, { money: true, icon: TrendingUp, tone: "blue" })}
            {card("Accounts cost", day.socials.cost, prev?.socials.cost, { money: true, invert: true, icon: CreditCard, tone: "red" })}
            {card("Accounts orders", day.socials.orders, prev?.socials.orders, { icon: ShoppingCart, tone: "blue" })}
          </div>

          <SectionTitle>Platform</SectionTitle>
          <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
            {card("New users", day.newUsers, prev?.newUsers, { icon: UserPlus, tone: "sky" })}
            {card("Deposits", day.balance.deposits, prev?.balance.deposits, { money: true, icon: CreditCard, tone: "emerald" })}
            {card("Spent by users", day.balance.spent, prev?.balance.spent, { money: true, icon: ShoppingCart, tone: "amber" })}
            {card("Users' balance change", day.balance.net, prev?.balance.net, { money: true, signed: true, icon: Wallet, tone: "amber" })}
            {card("Users' closing balance", day.balance.closing, prev?.balance.closing, { money: true, icon: Wallet, tone: "amber" })}
            {card("Total users", day.usersTotal, prev?.usersTotal, { icon: UserPlus, tone: "sky" })}
            {card("Deposits to date", day.balance.totalDeposits, prev?.balance.totalDeposits, { money: true, icon: CreditCard, tone: "emerald" })}
          </div>

          <SectionTitle>Provider balances</SectionTitle>
          <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
            {PROVIDERS.map(providerCard)}
          </div>

          <div className="mt-8">
            <h2 className="mb-3 text-lg font-bold text-[var(--foreground)] sm:mb-4">Last {TREND_DAYS} days</h2>
            {/* Mobile: card list */}
            <ul className="space-y-3 md:hidden">
              {trend.map((r) => (
                <li key={r.date}>
                  <button
                    type="button"
                    onClick={() => setDate(r.date)}
                    className={`w-full rounded-xl border p-3.5 text-left transition ${r.date === date ? "border-blue-500/40 bg-blue-500/10" : "border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)]/40"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-[var(--foreground)]">{trendDayLabel(r.date)}</span>
                      <span className="text-sm font-semibold tabular-nums text-emerald-500">{formatNGN(sum(r, "profit"))}</span>
                    </div>
                    <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs tabular-nums">
                      <div><dt className="text-[var(--muted-foreground)]">New users</dt><dd className="mt-0.5 text-[var(--foreground)]">{r.newUsers.toLocaleString()}</dd></div>
                      <div><dt className="text-[var(--muted-foreground)]">Deposits</dt><dd className="mt-0.5 text-[var(--foreground)]">{formatNGN(r.balance.deposits)}</dd></div>
                      <div><dt className="text-[var(--muted-foreground)]">Orders</dt><dd className="mt-0.5 text-[var(--foreground)]">{sum(r, "orders").toLocaleString()}</dd></div>
                      <div><dt className="text-[var(--muted-foreground)]">Received OTPs</dt><dd className="mt-0.5 text-[var(--foreground)]">{r.numbers.received.toLocaleString()}</dd></div>
                      <div><dt className="text-[var(--muted-foreground)]">Revenue</dt><dd className="mt-0.5 text-[var(--foreground)]">{formatNGN(sum(r, "revenue"))}</dd></div>
                      <div><dt className="text-[var(--muted-foreground)]">Balance change</dt><dd className={`mt-0.5 ${netTone(r.balance.net) || "text-[var(--foreground)]"}`}>{signedNGN(r.balance.net)}</dd></div>
                    </dl>
                  </button>
                </li>
              ))}
            </ul>

            {/* Tablet/desktop: table. Click a day to open it. */}
            <div className="hidden overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--card)] md:block">
              <table className="min-w-full text-sm">
                <thead className="border-b border-[var(--border)] bg-[var(--muted)]/40 text-[11px] uppercase tracking-wider text-[var(--muted-foreground)]">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-semibold">Day</th>
                    <th className={th}>New users</th>
                    <th className={th}>Deposits</th>
                    <th className={th}>Orders</th>
                    <th className={th}>Received OTPs</th>
                    <th className={th}>Revenue</th>
                    <th className={th}>Profit</th>
                    <th className={th}>Balance change</th>
                    <th className={th}>Closing balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {trend.map((r) => (
                    <tr
                      key={r.date}
                      onClick={() => setDate(r.date)}
                      className={`cursor-pointer transition ${r.date === date ? "bg-blue-500/10" : "hover:bg-[var(--muted)]/40"}`}
                    >
                      <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-[var(--foreground)]">{trendDayLabel(r.date)}</td>
                      <td className={td}>{r.newUsers.toLocaleString()}</td>
                      <td className={td}>{formatNGN(r.balance.deposits)}</td>
                      <td className={td}>{sum(r, "orders").toLocaleString()}</td>
                      <td className={td}>{r.numbers.received.toLocaleString()}</td>
                      <td className={td}>{formatNGN(sum(r, "revenue"))}</td>
                      <td className={`${td} text-emerald-500`}>{formatNGN(sum(r, "profit"))}</td>
                      <td className={`${td} ${netTone(r.balance.net)}`}>{signedNGN(r.balance.net)}</td>
                      <td className={td}>{formatNGN(r.balance.closing)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 space-y-1 text-xs text-[var(--muted-foreground)]">
            <p>Days run midnight to midnight, Africa/Lagos. Revenue, cost and profit count delivered orders that weren&apos;t refunded.</p>
            <p>Users&apos; closing balances are worked back from today&apos;s live balances and wallet movements, so they&apos;re close estimates.</p>
            <p>Provider balances are saved each time the admin Dashboard is opened. A day with none saved shows the last saved balance.</p>
          </div>
        </div>
      )}
    </main>
  );
}
