import StatusBadge from "@/components/table/StatusBadge";

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

function capitalize(value) {
  const text = String(value || "");
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "—";
}

export default function AdminOrderCard({ sale }) {
  const customerName = [
    sale?.customer?.firstName,
    sale?.customer?.lastName,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article className="min-w-0 max-w-full overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm min-[390px]:p-5">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="break-words text-lg font-black text-[var(--foreground)]">
            {sale.serviceName || capitalize(sale.service)}
          </p>
          <p className="mt-1 break-words text-sm text-[var(--muted-foreground)]">
            {sale.countryName || sale.country} ·{" "}
            {sale.server === "server1"
              ? "Server 1"
              : sale.server === "server2"
                ? "Server 2"
                : "Unknown server"}
          </p>
        </div>
        <div className="shrink-0">
          <StatusBadge status={sale.status} />
        </div>
      </div>

      <div className="mt-5 space-y-3 text-sm">
        <div className="flex min-w-0 justify-between gap-3">
          <span className="shrink-0 text-[var(--muted-foreground)]">Customer</span>
          <span className="min-w-0 max-w-[68%] break-words text-right font-bold text-[var(--foreground)]">
            {customerName || sale?.customer?.email || "Unknown"}
          </span>
        </div>
        <div className="flex min-w-0 justify-between gap-3">
          <span className="shrink-0 text-[var(--muted-foreground)]">Email</span>
          <span className="min-w-0 max-w-[68%] break-all text-right font-semibold text-[var(--foreground)]">
            {sale?.customer?.email || "—"}
          </span>
        </div>
        <div className="flex min-w-0 justify-between gap-3">
          <span className="shrink-0 text-[var(--muted-foreground)]">Phone</span>
          <span className="min-w-0 max-w-[68%] break-all text-right font-bold text-[var(--foreground)]">
            {sale.phoneNumber || "—"}
          </span>
        </div>
        <div className="flex min-w-0 justify-between gap-3">
          <span className="shrink-0 text-[var(--muted-foreground)]">OTP</span>
          <span className="min-w-0 max-w-[68%] break-all text-right font-black tracking-wider text-blue-600">
            {sale.otpCode || "Waiting"}
          </span>
        </div>
      </div>

      <div className="mt-5 grid min-w-0 grid-cols-3 gap-1.5 min-[390px]:gap-2">
        <div className="min-w-0 rounded-xl bg-[var(--muted)] px-1.5 py-3 text-center min-[390px]:px-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
            Cost
          </p>
          <p className="mt-1 break-words text-[11px] font-black leading-4 text-[var(--foreground)] min-[390px]:text-sm">
            {formatNaira(sale.providerCostNgn)}
          </p>
        </div>
        <div className="min-w-0 rounded-xl bg-blue-50 px-1.5 py-3 text-center dark:bg-blue-950/30 min-[390px]:px-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-600">
            Sale
          </p>
          <p className="mt-1 break-words text-[11px] font-black leading-4 text-blue-600 min-[390px]:text-sm">
            {formatNaira(sale.sellingPrice)}
          </p>
        </div>
        <div className="min-w-0 rounded-xl bg-green-50 px-1.5 py-3 text-center dark:bg-green-950/30 min-[390px]:px-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-green-600">
            Profit
          </p>
          <p className="mt-1 break-words text-[11px] font-black leading-4 text-green-600 min-[390px]:text-sm">
            {formatNaira(sale.profit)}
          </p>
        </div>
      </div>

      <div className="mt-5 border-t border-[var(--border)] pt-4 text-xs text-[var(--muted-foreground)]">
        <div className="flex justify-between gap-3">
          <span>Created</span>
          <span className="min-w-0 break-words text-right font-semibold">
            {formatDateTime(sale.createdAt)}
          </span>
        </div>
        {sale.otpReceivedAt && (
          <div className="mt-2 flex justify-between gap-3">
            <span>OTP received</span>
            <span className="min-w-0 break-words text-right font-semibold">
              {formatDateTime(sale.otpReceivedAt)}
            </span>
          </div>
        )}
      </div>
    </article>
  );
}
