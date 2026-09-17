"use client";

import Link from "next/link";
import { Menu, ShieldCheck } from "lucide-react";

import ThemeToggle from "@/components/ui/ThemeToggle";
import { useAuth } from "@/context/AuthContext";

export default function AdminTopbar({ onMenuClick }) {
  const { user } = useAuth();

  const fullName = [
    user?.firstName,
    user?.lastName,
  ]
    .filter(Boolean)
    .join(" ");

  const initials =
    `${user?.firstName?.[0] || ""}${
      user?.lastName?.[0] || ""
    }`.toUpperCase() || "A";

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-[var(--border)] bg-[var(--background)]/95 shadow-sm backdrop-blur-xl lg:left-[250px] xl:left-[280px]">
      <div className="mx-auto flex h-16 w-full max-w-[1700px] items-center justify-between gap-3 px-3 min-[375px]:px-4 sm:px-6 lg:px-8 xl:px-10">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onMenuClick}
            aria-label="Open admin navigation"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] transition hover:bg-[var(--muted)] lg:hidden"
          >
            <Menu size={20} />
          </button>

          <div className="min-w-0">
            <p className="truncate text-sm font-black text-[var(--foreground)] sm:text-base">
              Administration
            </p>
            <p className="hidden truncate text-xs text-[var(--muted-foreground)] sm:block">
              Pricing, sales and profit management
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/buy-number"
            className="hidden rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs font-bold text-[var(--foreground)] transition hover:bg-[var(--muted)] sm:inline-flex"
          >
            View customer site
          </Link>

          <ThemeToggle />

          <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] p-1.5 pr-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-xs font-black text-white">
              {initials}
            </div>

            <div className="hidden max-w-40 min-w-0 md:block">
              <p className="truncate text-xs font-black text-[var(--foreground)]">
                {fullName || "Administrator"}
              </p>
              <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-blue-600">
                <ShieldCheck size={11} /> Admin
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
