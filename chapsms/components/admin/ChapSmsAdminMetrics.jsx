"use client";



import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";



/**

 * ChapSms Admin Metrics — drop-in Next.js client component.

 *

 * Backend contract (authenticated GET request):

 *   /api/admin/metrics?days=7 (also 14, 30)

 *   {

 *     rows: [

 *       {

 *         date: "2026-10-10", // YYYY-MM-DD in your reporting timezone

 *         orders: 124,        // completed/paid orders only

 *         turnover: 74000,    // NGN revenue from completed orders

 *         cost: 42000,        // NGN actual provider/service cost

 *         profit: 32000       // NGN; optional if cost supplied

 *       }

 *     ]

 *   }

 *

 * No synthetic figures are shown. API path, fetch and timezone are configurable.

 */

const WINDOWS = [7, 14, 30];

const money = new Intl.NumberFormat("en-NG", {

  style: "currency", currency: "NGN", maximumFractionDigits: 2,

});

const integer = new Intl.NumberFormat("en-NG");



function numberOrNull(value) {

  if (value === null || value === undefined || value === "") return null;

  const n = Number(value);

  return Number.isFinite(n) ? n : null;

}



function normalizeRows(data) {

  const list = Array.isArray(data) ? data : data?.rows ?? data?.daily ?? data?.dailyMetrics ?? data?.data?.rows;

  if (!Array.isArray(list)) throw new Error("Metrics API must return a daily or rows array.");

  return list.map((entry, index) => {

    const date = String(entry.date ?? "").slice(0, 10);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {

      throw new Error(`Invalid date in metrics row ${index + 1}.`);

    }

    const orders = numberOrNull(entry.orders);

    const turnover = numberOrNull(entry.turnover ?? entry.revenue);

    const cost = numberOrNull(entry.cost);

    const suppliedProfit = numberOrNull(entry.profit);

    const profit = suppliedProfit ?? (turnover !== null && cost !== null ? turnover - cost : null);

    return { date, orders, turnover, cost, profit };

  }).sort((a, b) => b.date.localeCompare(a.date));

}



function dateLabel(iso, timezone) {

  const [year, month, day] = iso.split("-").map(Number);

  const d = new Date(Date.UTC(year, month - 1, day, 12));

  return new Intl.DateTimeFormat("en-NG", {

    weekday: "short", day: "numeric", month: "short", timeZone: timezone,

  }).format(d);

}



function displayMoney(value) {

  return value === null ? "—" : money.format(value);

}



function displayNumber(value) {

  return value === null ? "—" : integer.format(value);

}



export default function ChapSmsAdminMetrics({

  apiUrl,

  fetcher = fetch,

  timezone = "Africa/Lagos",

  title = "Admin control panel",

}) {

  const { token, user, authLoading } = useAuth();
  // NEXT_PUBLIC_API_URL is the same /api base used by auth.service.js.
  const apiBase = String(process.env.NEXT_PUBLIC_API_URL || "").trim().replace(/\/+$/, "");
  const resolvedUrl = apiUrl || (apiBase ? `${apiBase}/admin/metrics` : "");
  const isAdmin = user?.role === "admin";
  const [days, setDays] = useState(7);

  const [rows, setRows] = useState([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [expandedDate, setExpandedDate] = useState(null);

  const [refreshIndex, setRefreshIndex] = useState(0);



  const reload = useCallback(() => setRefreshIndex((n) => n + 1), []);



  useEffect(() => {

    const controller = new AbortController();

    async function load() {
      if (authLoading) return;
      if (!token || !isAdmin) {
        setLoading(false);
        setRows([]);
        setError("Admin authentication is required to view metrics.");
        return;
      }
      if (!resolvedUrl) {
        setLoading(false);
        setError("NEXT_PUBLIC_API_URL is missing. Set it to http://localhost:5050/api in .env.local.");
        return;
      }

      setLoading(true);

      setError("");

      try {

        const separator = resolvedUrl.includes("?") ? "&" : "?";

        const response = await fetcher(`${resolvedUrl}${separator}days=${days}`, {

          method: "GET", credentials: "include", signal: controller.signal,

          headers: { Accept: "application/json", Authorization: `Bearer ${token}` },

        });

        if (!response.ok) {

          throw new Error(response.status === 401 || response.status === 403

            ? "You are not authorized to view admin metrics."

            : `Unable to load metrics (HTTP ${response.status}).`);

        }

        const payload = await response.json();

        const parsed = normalizeRows(payload);

        if (!controller.signal.aborted) {

          setRows(parsed);

          setExpandedDate(null);

        }

      } catch (err) {

        if (!controller.signal.aborted) {

          setRows([]);

          setError(err?.message || "Unable to load metrics.");

        }

      } finally {

        if (!controller.signal.aborted) setLoading(false);

      }

    }

    load();

    return () => controller.abort();

  }, [resolvedUrl, days, fetcher, refreshIndex, token, isAdmin, authLoading]);



  const totals = useMemo(() => {

    const sum = (key) => rows.every((r) => r[key] !== null)

      ? rows.reduce((acc, r) => acc + r[key], 0) : null;

    return { orders: sum("orders"), turnover: sum("turnover"), profit: sum("profit") };

  }, [rows]);



  return (

    <section className="csm-metrics" aria-label="Admin sales and profit metrics">

      <div className="csm-heading">

        <div>

          <h2>{title}</h2>

          <p>Pricing, profit tracking, users, and order monitoring</p>

        </div>

        <button className="csm-refresh" type="button" onClick={reload} disabled={loading}>

          {loading ? "Loading…" : "↻ Refresh"}

        </button>

      </div>



      <div className="csm-panel">

        <div className="csm-toolbar">

          <span className="csm-toolbar-label">Daily metrics</span>

          <div className="csm-tabs" role="group" aria-label="Reporting period">

            {WINDOWS.map((windowDays) => (

              <button key={windowDays} type="button"

                className={days === windowDays ? "csm-tab active" : "csm-tab"}

                aria-pressed={days === windowDays}

                onClick={() => setDays(windowDays)}>

                {windowDays}d

              </button>

            ))}

          </div>

        </div>



        {error ? <div className="csm-error" role="alert">{error}<br /><small>Connect the component to an authenticated admin reporting endpoint.</small></div> : null}

        {loading ? <div className="csm-empty" role="status">Loading real transaction metrics…</div> : null}

        {!loading && !error && rows.length === 0 ? (

          <div className="csm-empty">No completed-order metrics were returned for this period.</div>

        ) : null}



        {!loading && !error && rows.length > 0 ? (

          <div className="csm-scroll">

            <table>

              <thead>

                <tr><th>Date</th><th>Orders</th><th>Turnover</th><th>Profit</th><th aria-label="Expand row" /></tr>

              </thead>

              <tbody>

                {rows.map((row) => {

                  const expanded = expandedDate === row.date;

                  return (

                    <ReactFragment key={row.date}>

                      <tr className="csm-data-row">

                        <td>{dateLabel(row.date, timezone)}</td>

                        <td>{displayNumber(row.orders)}</td>

                        <td>{displayMoney(row.turnover)}</td>

                        <td className={row.profit !== null && row.profit < 0 ? "csm-negative" : ""}>{displayMoney(row.profit)}</td>

                        <td><button type="button" className="csm-expand" aria-label={`${expanded ? "Collapse" : "Expand"} ${row.date}`} aria-expanded={expanded} onClick={() => setExpandedDate(expanded ? null : row.date)}>{expanded ? "⌃" : "›"}</button></td>

                      </tr>

                      {expanded ? (

                        <tr className="csm-details-row"><td colSpan={5}>

                          <div className="csm-details">

                            <div><span>Reporting date</span><strong>{row.date}</strong></div>

                            <div><span>Completed orders</span><strong>{displayNumber(row.orders)}</strong></div>

                            <div><span>Turnover</span><strong>{displayMoney(row.turnover)}</strong></div>

                            <div><span>Provider cost</span><strong>{displayMoney(row.cost)}</strong></div>

                            <div><span>Profit</span><strong>{displayMoney(row.profit)}</strong></div>

                            <div><span>Profit margin</span><strong>{row.profit !== null && row.turnover > 0 ? `${((row.profit / row.turnover) * 100).toFixed(1)}%` : "—"}</strong></div>

                          </div>

                        </td></tr>

                      ) : null}

                    </ReactFragment>

                  );

                })}

              </tbody>

              <tfoot>

                <tr><td>Total</td><td>{displayNumber(totals.orders)}</td><td>{displayMoney(totals.turnover)}</td><td>{displayMoney(totals.profit)}</td><td /></tr>

              </tfoot>

            </table>

          </div>

        ) : null}

      </div>

      <p className="csm-footnote">All amounts in NGN. Totals include only rows supplied by your backend. Profit should exclude refunds and account for actual provider costs.</p>

      <style jsx>{`

        .csm-metrics{color:#e6edff;font-family:inherit;width:100%}

        .csm-heading{display:flex;justify-content:space-between;align-items:start;gap:16px;margin-bottom:22px}

        .csm-heading h2{font-size:clamp(20px,2.4vw,28px);font-weight:750;margin:0 0 5px}

        .csm-heading p,.csm-footnote{font-size:12px;color:#95a3c1;margin:0}

        .csm-refresh{background:#172541;border:1px solid #304161;border-radius:9px;padding:9px 12px;color:#d8e5ff;cursor:pointer;white-space:nowrap}

        .csm-refresh:disabled{opacity:.55;cursor:wait}

        .csm-panel{border:1px solid #243657;border-radius:14px;background:#111c33;overflow:hidden}

        .csm-toolbar{display:flex;align-items:center;justify-content:space-between;padding:16px;gap:12px;border-bottom:1px solid #253451}

        .csm-toolbar-label{font-size:13px;font-weight:700}

        .csm-tabs{display:flex;gap:4px;background:#0a1428;border:1px solid #253451;padding:3px;border-radius:9px}

        .csm-tab{background:transparent;color:#9aaaca;border:0;border-radius:6px;padding:7px 12px;font-size:12px;cursor:pointer}

        .csm-tab.active{background:#325ff0;color:white;font-weight:700}

        .csm-scroll{overflow-x:auto}

        table{width:100%;border-collapse:collapse;min-width:550px;font-size:12px;text-align:left}

        th{color:#8ea0bf;text-transform:uppercase;font-size:10px;letter-spacing:.07em;font-weight:700;background:#0c162b}

        th,td{padding:13px 15px;border-bottom:1px solid #26334d;white-space:nowrap}

        td:nth-child(n+2),th:nth-child(n+2){text-align:right}

        .csm-data-row:hover{background:#162540}

        .csm-expand{background:#1c2d4b;border:1px solid #354768;color:#dce6ff;border-radius:6px;width:25px;height:25px;cursor:pointer;font-size:17px;line-height:1}

        .csm-negative{color:#ff9292}

        .csm-details-row td{white-space:normal;text-align:left;background:#0c162b;padding:16px}

        .csm-details{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}

        .csm-details div{display:flex;flex-direction:column;gap:4px;min-width:0}

        .csm-details span{color:#8da0be;font-size:11px}

        .csm-details strong{font-size:12px;overflow-wrap:anywhere}

        tfoot td{font-weight:800;background:#142342;border-bottom:0}

        .csm-empty{padding:38px 16px;text-align:center;color:#aab8d1;font-size:13px}

        .csm-error{margin:16px;padding:14px;border:1px solid #85444e;border-radius:9px;color:#ffb4ba;background:#3a1c2b;font-size:13px}

        .csm-error small{display:inline-block;margin-top:7px}

        .csm-footnote{margin-top:12px;line-height:1.6}

        @media(max-width:650px){.csm-heading{flex-direction:column}.csm-toolbar{padding:12px}.csm-details{grid-template-columns:repeat(2,minmax(0,1fr))}th,td{padding:11px 12px}}

      `}</style>

    </section>

  );

}



// A local fragment alias avoids an additional React default import.

import { Fragment as ReactFragment } from "react";
