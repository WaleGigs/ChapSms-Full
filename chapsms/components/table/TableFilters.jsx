export default function TableFilters({ filters = [], values = {}, onChange }) {
  return (
    <div className="flex flex-wrap gap-3">
      {filters.map((filter) => (
        <select
          key={filter.key}
          value={values[filter.key] || "all"}
          onChange={(e) => onChange(filter.key, e.target.value)}
          className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm font-semibold text-[var(--foreground)] outline-none"
        >
          <option value="all">{filter.label}</option>

          {filter.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ))}
    </div>
  );
}