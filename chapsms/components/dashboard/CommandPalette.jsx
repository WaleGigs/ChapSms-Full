// components/dashboard/CommandPalette.jsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Smartphone,
  ShoppingCart,
  Wallet,
  ReceiptText,
  KeyRound,
  Settings,
  Search,
  X,
} from "lucide-react";

const commands = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/buy-number", label: "Buy Number", icon: Smartphone },
  { href: "/orders", label: "Orders", icon: ShoppingCart },
  { href: "/wallet", label: "Wallet", icon: Wallet },
  { href: "/transactions", label: "Transactions", icon: ReceiptText },
  { href: "/api-keys", label: "API Keys", icon: KeyRound },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }

      if (e.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const filteredCommands = commands.filter((item) =>
    item.label.toLowerCase().includes(query.toLowerCase())
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 px-4 pt-24">
      <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)] shadow-2xl">
        <div className="flex items-center gap-3 border-b border-[var(--border)] px-5 py-4">
          <Search size={20} className="text-[var(--muted-foreground)]" />

          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages, actions, orders..."
            className="w-full bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]"
          />

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-[var(--muted-foreground)]"
          >
            <X size={20} />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto p-3">
          {filteredCommands.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-2xl px-4 py-4 text-sm font-bold text-[var(--foreground)] transition hover:bg-[var(--background)]"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-950">
                  <Icon size={18} />
                </span>
                {item.label}
              </Link>
            );
          })}

          {filteredCommands.length === 0 && (
            <div className="p-8 text-center text-sm text-[var(--muted-foreground)]">
              No result found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}