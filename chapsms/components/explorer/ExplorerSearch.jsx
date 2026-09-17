// components/explorer/ExplorerSearch.jsx
"use client";

import { Search } from "lucide-react";

export default function ExplorerSearch({ value, onChange, placeholder }) {
  return (
    <div className="flex items-center rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3">
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