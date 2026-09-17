export default function AdminSummaryCard({
  label,
  value,
  delta = "",
  icon: Icon,
  loading = false,
}) {
  return (
    <section className="rounded-[22px] border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm sm:rounded-3xl sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted-foreground)] sm:text-xs sm:tracking-[0.16em]">
            {label}
          </p>

          <p className="mt-3 break-words text-[24px] font-black leading-none tracking-tight text-[var(--foreground)] sm:text-3xl">
            {loading ? "..." : value}
          </p>
        </div>

        {Icon && (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
            <Icon size={21} />
          </div>
        )}
      </div>

      {!loading && delta ? (
        <div className="mt-4 flex justify-end">
          <span className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--muted)] px-2.5 py-1 text-[10px] font-black tabular-nums text-[var(--muted-foreground)] sm:text-xs">
            {delta}
          </span>
        </div>
      ) : null}
    </section>
  );
}
