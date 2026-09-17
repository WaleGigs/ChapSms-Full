import { Search } from "lucide-react";

export default function TableSearch({ value, onChange, placeholder = "Search..." }) {
  return (
    <div className="flex w-full items-center rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 md:max-w-sm">
      <Search size={18} className="text-[var(--muted-foreground)]" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="ml-3 w-full bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]"
      />
    </div>
  );
}