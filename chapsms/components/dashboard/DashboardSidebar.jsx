"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  History,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  MessageSquareText,
  Settings,
  ShieldCheck,
  ShoppingBag,
  WalletCards,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

import { useWallet } from "@/hooks/useWallet";
import { useAuth } from "@/context/AuthContext";

const primaryLinks = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    href: "/buy-number",
    label: "Buy Number",
    icon: MessageSquareText,
  },
  {
    href: "/buy-socials",
    label: "Buy Account & VPNs",
    icon: ShoppingBag,
  },
  {
    href: "/wallet",
    label: "Top Up Balance",
    icon: WalletCards,
  },
  {
    href: "/transactions",
    label: "History",
    icon: History,
  },
  {
    href: "/api-keys",
    label: "API",
    icon: KeyRound,
  },
];

const secondaryLinks = [
  {
    href: "/support",
    label: "Support Center",
    icon: LifeBuoy,
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
  },
];

function formatNaira(value) {
  return `₦${Number(value || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function DashboardSidebar({ open = false, onClose }) {
  const pathname = usePathname();
  const router = useRouter();

  const { user, logout } = useAuth();
  const { wallet, loading } = useWallet();

  const [loggingOut, setLoggingOut] = useState(false);

  function isActive(href) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  async function handleLogout() {
    if (loggingOut) return;

    try {
      setLoggingOut(true);
      logout();
      toast.success("Logged out successfully");
      onClose?.();
      router.replace("/login");
    } catch (error) {
      toast.error(error?.message || "Logout failed");
      setLoggingOut(false);
    }
  }

  function handleNavigation() {
    onClose?.();
  }

  const SidebarContent = (
    <div className="flex min-h-full min-w-0 flex-col">
      <div className="sticky top-0 z-20 -mx-4 flex items-center justify-between border-b border-[var(--border)] bg-[var(--card)] px-4 pb-4 pt-1 min-[375px]:-mx-5 min-[375px]:px-5">
        <Link
          href="/dashboard"
          onClick={handleNavigation}
          className="text-lg font-black tracking-tight text-[var(--foreground)] min-[390px]:text-xl"
        >
          Chaps<span className="text-blue-600">SmS</span>
        </Link>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close dashboard navigation"
          className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--muted-foreground)] transition hover:bg-[var(--muted)] hover:text-[var(--foreground)] active:scale-95 lg:hidden"
        >
          <X size={20} />
        </button>
      </div>

      <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--muted)] p-3.5 min-[390px]:p-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
          Current balance
        </p>

        <div className="mt-2 flex min-w-0 items-center justify-between gap-3">
          <p className="min-w-0 truncate text-lg font-black tabular-nums text-[var(--foreground)] min-[390px]:text-xl xl:text-2xl">
            {loading ? "..." : formatNaira(wallet?.balance)}
          </p>

          <Link
            href="/wallet"
            onClick={handleNavigation}
            className="shrink-0 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-blue-700 active:scale-95"
          >
            Top up
          </Link>
        </div>
      </div>

      {user?.role === "admin" && (
        <Link
          href="/admin"
          onClick={handleNavigation}
          className="mt-4 flex min-h-12 items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-black text-blue-700 transition hover:bg-blue-100 active:scale-[0.98] dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300 dark:hover:bg-blue-950/50"
        >
          <ShieldCheck size={18} className="shrink-0" />
          <span>Admin Dashboard</span>
        </Link>
      )}

      <nav aria-label="Primary dashboard navigation" className="mt-6 space-y-1.5">
        {primaryLinks.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleNavigation}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-12 items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition active:scale-[0.98] ${
                active
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              <Icon size={18} className="shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div
        className="sticky bottom-0 z-20 -mx-4 mt-auto border-t border-[var(--border)] bg-[var(--card)] px-4 pb-3 pt-5 min-[375px]:-mx-5 min-[375px]:px-5"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <nav aria-label="Secondary dashboard navigation" className="space-y-1.5">
          {secondaryLinks.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleNavigation}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-12 items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition active:scale-[0.98] ${
                  active
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                <Icon size={18} className="shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="mt-1.5 flex min-h-12 w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-red-500 transition hover:bg-red-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-red-950/30"
        >
          <LogOut size={18} className="shrink-0" />
          {loggingOut ? "Logging out..." : "Log out"}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="sticky top-0 hidden h-dvh overflow-y-auto overscroll-contain border-r border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] lg:block">
        <div className="min-h-full px-5 py-4">{SidebarContent}</div>
      </aside>

      <div
        className={`fixed inset-0 z-50 transition-opacity duration-300 lg:hidden ${
          open
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
        aria-hidden={!open}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dashboard navigation overlay"
          className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        />

        <aside
          role="dialog"
          aria-modal="true"
          aria-label="Dashboard navigation"
          className={`relative h-dvh w-[88vw] max-w-[300px] overflow-y-auto overscroll-contain border-r border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] shadow-2xl transition-transform duration-250 ease-out ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="min-h-full px-3.5 py-3 min-[375px]:px-4 min-[390px]:px-5">
            {SidebarContent}
          </div>
        </aside>
      </div>
    </>
  );
}
