// components/table/SkeletonTable.jsx
export default function SkeletonTable({ rows = 5, columns = 6 }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="grid gap-4 rounded-2xl bg-[var(--background)] p-4"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <div
              key={colIndex}
              className="h-4 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800"
            />
          ))}
        </div>
      ))}
    </div>
  );
}