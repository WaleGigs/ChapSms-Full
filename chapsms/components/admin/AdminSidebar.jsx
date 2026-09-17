"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  BadgeDollarSign,
  CreditCard,
  LayoutDashboard,
  Package,
  ReceiptText,
  Settings,
  ShieldCheck,
  Users,
  WalletCards,
  X,
} from "lucide-react";

const links = [
  {
    href: "/admin",
    label: "Dashboard",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    href: "/admin/users",
    label: "Users",
    icon: Users,
  },
  {
    href: "/admin/orders",
    label: "Orders",
    icon: ReceiptText,
  },
  {
    href: "/admin/wallets",
    label: "Wallets",
    icon: WalletCards,
  },
  {
    href: "/admin/payments",
    label: "Payments",
    icon: CreditCard,
  },
  {
    href: "/admin/pricing",
    label: "Pricing Rules",
    icon: BadgeDollarSign,
  },
  {
    href: "/admin/socials",
    label: "Accounts & VPNs",
    icon: Package,
  },
  {
    href: "/admin/settings",
    label: "Settings",
    icon: Settings,
  },
];

export default function AdminSidebar({ open = false, onClose }) {
  const pathname = usePathname();

  function isActive(item) {
    if (item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }

  const content = (
    <div className="flex min-h-full flex-col">
      <div className="sticky top-0 z-20 -mx-4 flex items-center justify-between border-b border-[var(--border)] bg-[var(--card)] px-4 pb-5 pt-1 min-[375px]:-mx-5 min-[375px]:px-5">
        <Link href="/admin" onClick={onClose} className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
            <ShieldCheck size={21} />
          </div>

          <div>
            <p className="text-lg font-black tracking-tight text-[var(--foreground)]">
              Chaps<span className="text-blue-600">SmS</span>
            </p>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
              Admin Console
            </p>
          </div>
        </Link>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close admin navigation"
          className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--muted-foreground)] transition hover:bg-[var(--muted)] hover:text-[var(--foreground)] lg:hidden"
        >
          <X size={20} />
        </button>
      </div>

      <nav className="mt-5 space-y-1.5" aria-label="Admin navigation">
        {links.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-12 items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition active:scale-[0.98] ${
                active
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              <Icon size={18} className="shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="sticky bottom-0 z-20 -mx-4 mt-auto border-t border-[var(--border)] bg-[var(--card)] px-4 pb-3 pt-5 min-[375px]:-mx-5 min-[375px]:px-5">
        <Link
          href="/dashboard"
          onClick={onClose}
          className="flex min-h-12 items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-[var(--muted-foreground)] transition hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
        >
          <ArrowLeft size={18} />
          Customer dashboard
        </Link>
      </div>
    </div>
  );

  return (
    <>
      <aside className="sticky top-0 hidden h-screen overflow-y-auto border-r border-[var(--border)] bg-[var(--card)] lg:block">
        <div className="min-h-full px-5 py-4">{content}</div>
      </aside>

      <div
        className={`fixed inset-0 z-50 transition-opacity duration-300 lg:hidden ${
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden={!open}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close admin navigation overlay"
          className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        />

        <aside
          role="dialog"
          aria-modal="true"
          aria-label="Admin navigation"
          className={`relative h-full w-[86vw] max-w-[330px] overflow-y-auto border-r border-[var(--border)] bg-[var(--card)] shadow-2xl transition-transform duration-300 ease-out ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="min-h-full px-4 py-4 min-[375px]:px-5">{content}</div>
        </aside>
      </div>
    </>
  );
}
