export default function Select({ label, children, className = "", ...props }) {
  return (
    <div className="space-y-2">
      {label && (
        <label className="text-sm font-medium text-[var(--foreground)]">
          {label}
        </label>
      )}

      <select
        className={`w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-blue-600 ${className}`}
        {...props}
      >
        {children}
      </select>
    </div>
  );
}