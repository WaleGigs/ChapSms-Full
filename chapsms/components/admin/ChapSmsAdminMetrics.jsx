'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';

const FIELDS = [
  ['date', 'Date', 'date'], ['signups', 'Signups', 'number'],
  ['toppedUp', 'Topped Up', 'toppedUp'], ['firstDayDeposit', 'First Day Deposit', 'money'],
  ['depositedToDate', 'Deposited to Date', 'money'],
  ['usersBalance', 'Users Balance', 'money'], ['boughtSameDay', 'Bought Same Day', 'number'],
  ['boughtToDate', 'Bought to Date', 'boughtToDate'], ['purchases', 'Purchases', 'number'],
  ['profitSameDay', 'Profit Same Day', 'money'], ['profitToDate', 'Profit to Date', 'money'],
];
const formatNumber = new Intl.NumberFormat('en-NG', { maximumFractionDigits: 1 });
const formatMoney = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });
// Reports already loaded this session, keyed by range, so switching ranges is instant.
const reportCache = new Map();
const CACHE_MS = 60000;
function display(row, field, kind) {
  const value = row?.[field];
  if (kind === 'date') return value || '—';
  if (value === null || value === undefined) return '—';
  if (kind === 'money') return formatMoney.format(value);
  if (kind === 'toppedUp' || kind === 'boughtToDate') {
    const percent = row?.[`${field}Percent`];
    return <>{formatNumber.format(value)} {percent == null ? null : <span className="csm-pct">{formatNumber.format(percent)}%</span>}</>;
  }
  return formatNumber.format(value);
}
export default function ChapSmsAdminMetrics({ title = 'Admin control panel' }) {
  const { token, user, authLoading } = useAuth();
  const [days, setDays] = useState(7);
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const forceRef = useRef(false);
  const reload = useCallback(() => { forceRef.current = true; setRefresh((n) => n + 1); }, []);
  const apiBase = String(process.env.NEXT_PUBLIC_API_URL || '').trim().replace(/\/+$/, '');
  useEffect(() => {
    if (authLoading) return;
    if (!token || user?.role !== 'admin') { setLoading(false); setError('Admin authentication required.'); return; }
    if (!apiBase) { setLoading(false); setError('Set NEXT_PUBLIC_API_URL in your frontend .env.local.'); return; }
    const forced = forceRef.current;
    forceRef.current = false;
    const hit = reportCache.get(days);
    if (hit) setPayload(hit.data);
    if (hit && !forced && Date.now() - hit.at < CACHE_MS) { setLoading(false); setError(''); return; }
    const controller = new AbortController();
    setLoading(true); setError('');
    (async () => {
      try {
        const response = await fetch(`${apiBase}/admin/metrics?days=${days}${forced ? '&fresh=1' : ''}`, {
          headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
          credentials: 'include', cache: 'no-store', signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || `Unable to load metrics (HTTP ${response.status}).`);
        if (!Array.isArray(data.daily)) throw new Error('Metrics API did not return a daily array.');
        reportCache.set(days, { data, at: Date.now() });
        if (!controller.signal.aborted) setPayload(data);
      } catch (err) {
        if (!controller.signal.aborted) { setPayload(null); setError(err.message || 'Unable to load metrics.'); }
      } finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [apiBase, authLoading, token, user?.role, days, refresh]);
  const rows = useMemo(() => [...(payload?.daily || [])].reverse(), [payload]);
  return <section className="csm-root">
    <header className="csm-heading"><div><h2>{title}</h2><p>Pricing, profit tracking, users, and order monitoring.</p></div></header>
    <div className="csm-panel">
      <div className="csm-toolbar"><strong>{days}d metric</strong><div className="csm-controls">
        {[7, 14, 30, 60].map((value) => <button key={value} type="button" aria-pressed={days === value} className={days === value ? 'active' : ''} onClick={() => setDays(value)}>{value}d</button>)}
        <button type="button" aria-label="Refresh metrics" onClick={reload} disabled={loading}>↻</button>
      </div></div>
      {error && <div className="csm-error" role="alert">{error}</div>}
      {loading && !payload && <div className="csm-info">Loading metrics…</div>}
      {!error && payload && <div className={`csm-scroll${loading ? ' csm-stale' : ''}`} tabIndex={0} aria-label="Scrollable daily metrics table">
        <table><thead><tr>{FIELDS.map(([key, label]) => <th key={key} scope="col">{label}</th>)}</tr></thead>
        <tbody>{rows.map((row) => <tr key={row.date}>{FIELDS.map(([key, , kind]) => <td key={key} className={key.startsWith('profit') ? 'csm-profit' : ''}>{display(row, key, kind)}</td>)}</tr>)}</tbody>
        <tfoot><tr>{FIELDS.map(([key, , kind]) => <td key={key} className={key.startsWith('profit') ? 'csm-profit' : ''}>{key === 'date' ? 'Total' : display(payload?.totals, key, kind)}</td>)}</tr></tfoot>
        </table></div>}
    </div>
    <p className="csm-note">NGN · Africa/Lagos. Each row tracks customers who signed up on that date; balances are their current live wallet balances. Swipe sideways on mobile to see all columns.</p>
    <style jsx>{`
      .csm-root{color:#e6edff;width:100%;min-width:0}.csm-heading{margin-bottom:22px}.csm-heading h2{font-size:clamp(21px,2.4vw,28px);margin:0 0 6px;font-weight:750}.csm-heading p,.csm-note{color:#93a3c2;font-size:12px;margin:0}.csm-panel{background:#111c33;border:1px solid #263958;border-radius:15px;overflow:hidden}.csm-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 18px;border-bottom:1px solid #263958}.csm-toolbar strong{font-size:15px}.csm-controls{display:flex;gap:6px}.csm-controls button{background:#15223d;color:#aebdd8;border:1px solid #2b3a59;border-radius:9px;padding:9px 12px;cursor:pointer}.csm-controls button.active{background:#315ef1;color:white;border-color:#315ef1}.csm-controls button:disabled{opacity:.5}.csm-scroll{width:100%;overflow-x:auto;overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch}.csm-scroll table{border-collapse:collapse;width:100%;min-width:1550px;font-size:13px}.csm-scroll th,.csm-scroll td{padding:15px 16px;text-align:right;white-space:nowrap;border-bottom:1px solid #273753}.csm-scroll th:first-child,.csm-scroll td:first-child{text-align:left;position:sticky;left:0;background:#111c33;z-index:1}.csm-scroll th{background:#0d192e;text-transform:uppercase;letter-spacing:.045em;color:#9daeca;font-size:11px}.csm-scroll th:first-child{background:#0d192e;z-index:2}.csm-scroll tbody tr:hover td{background:#182944}.csm-scroll tfoot td{background:#172744;font-weight:750;border-bottom:0}.csm-scroll tfoot td:first-child{background:#172744}.csm-stale{opacity:.55;transition:opacity .15s}.csm-profit{color:#71d6a7}.csm-pct{color:#879bbd;font-size:11px;margin-left:3px}.csm-info{padding:35px;text-align:center;color:#9bacc9}.csm-error{margin:15px;padding:15px;border:1px solid #8b354c;border-radius:9px;background:#391e2e;color:#ffb5c1}.csm-note{margin-top:12px;line-height:1.6}@media(max-width:640px){.csm-toolbar{padding:12px}.csm-controls button{padding:8px 10px}}
    `}</style>
  </section>;
}
