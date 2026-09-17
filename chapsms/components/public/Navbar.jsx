"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import ThemeToggle from "@/components/ui/ThemeToggle";
import { useAuth } from "@/context/AuthContext";

const links = [
  { href: "#services", label: "Numbers" },
  { href: "#accounts-vpns", label: "Accounts & VPNs" },
  { href: "#countries", label: "Countries" },
  { href: "#features", label: "Features" },
  { href: "#api", label: "API" },
  { href: "#faq", label: "FAQ" },
];

const primaryAction =
  "focus-ring inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2 text-[13px] font-bold text-white shadow-sm shadow-blue-600/20 transition hover:bg-blue-700 active:scale-[0.98] min-[390px]:px-4 min-[390px]:text-sm";

export default function Navbar() {
  const { user, authLoading } = useAuth();

  const dashboardHref =
    user?.role === "admin"
      ? "/admin"
      : "/dashboard";

  return (
    <header className="sticky top-0 z-[100] w-full max-w-full border-b border-[var(--border)] bg-white/95 shadow-sm backdrop-blur-xl dark:bg-slate-950/95">
      <nav className="site-container flex h-[60px] min-w-0 items-center justify-between gap-2 min-[390px]:gap-3 sm:h-[72px]">
        <Link
          href="/"
          className="focus-ring min-w-0 shrink rounded-lg text-[17px] font-black tracking-tight text-[var(--foreground)] min-[390px]:text-lg sm:shrink-0 sm:text-2xl"
          aria-label="ChapsSmS homepage"
        >
          Chaps
          <span className="text-blue-600">SmS</span>
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="focus-ring rounded-lg px-3 py-2 text-sm font-semibold text-[var(--muted-foreground)] transition hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex min-w-0 shrink-0 items-center gap-1.5 min-[390px]:gap-2 sm:gap-3">
          <ThemeToggle />

          {!authLoading && user ? (
            <Link
              href={dashboardHref}
              className={primaryAction}
            >
              <span className="sm:hidden">Dashboard</span>
              <span className="hidden sm:inline">Open dashboard</span>
              <ArrowRight
                size={15}
                className="hidden min-[390px]:block"
              />
            </Link>
          ) : !authLoading ? (
            <Link
              href="/login"
              className={primaryAction}
            >
              Sign in
            </Link>
          ) : null}
        </div>
      </nav>
    </header>
  );
}
