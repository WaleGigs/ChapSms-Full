import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Globe2,
  KeyRound,
  MessageSquareText,
  PackageCheck,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  WalletCards,
  Wifi,
} from "lucide-react";

import Badge from "@/components/ui/Badge";

const benefits = [
  { icon: MessageSquareText, text: "International virtual numbers" },
  { icon: ShoppingBag, text: "Accounts & digital products" },
  { icon: Wifi, text: "VPN & proxy options" },
  { icon: ShieldCheck, text: "One wallet for every service" },
];

const primaryLink =
  "focus-ring relative z-30 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm shadow-blue-600/20 transition duration-200 hover:bg-blue-700 active:scale-[0.98] min-[390px]:text-base sm:w-auto sm:px-6";

const secondaryLink =
  "focus-ring relative z-30 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-5 py-3 text-sm font-bold text-[var(--foreground)] shadow-sm transition duration-200 hover:border-blue-300 hover:bg-[var(--muted)] active:scale-[0.98] dark:hover:border-blue-800 min-[390px]:text-base sm:w-auto sm:px-6";

const serviceChips = [
  { label: "Facebook", badge: "f", className: "bg-[#1877F2]" },
  { label: "Instagram", badge: "◎", className: "bg-fuchsia-600" },
  { label: "X", badge: "𝕏", className: "bg-black" },
  { label: "TikTok", badge: "♪", className: "bg-black" },
  { label: "VPN", badge: "VPN", className: "bg-sky-600" },
  { label: "Proxy", badge: "IP", className: "bg-violet-600" },
];

export default function Hero() {
  return (
    <section className="relative isolate overflow-hidden border-b border-[var(--border)] bg-[var(--background)] py-10 min-[390px]:py-12 sm:py-20 lg:py-24">
      <div className="surface-grid pointer-events-none absolute inset-0 -z-20 opacity-65" />
      <div className="animate-pulse-soft pointer-events-none absolute -left-24 top-16 -z-10 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl sm:h-96 sm:w-96" />
      <div className="animate-pulse-soft animation-delay-300 pointer-events-none absolute -right-32 bottom-0 -z-10 h-72 w-72 rounded-full bg-violet-500/15 blur-3xl sm:h-96 sm:w-96" />

      <div className="site-container grid min-w-0 items-center gap-10 lg:grid-cols-[minmax(0,1.02fr)_minmax(420px,0.98fr)] lg:gap-14">
        <div className="animate-fade-up text-center lg:text-left">
          <Badge className="gap-2">
            <Sparkles size={14} />
            Numbers, accounts, VPNs and digital tools
          </Badge>

          <h1 className="text-balance mt-5 text-[clamp(2rem,10vw,5rem)] font-black leading-[1.02] tracking-[-0.04em] text-[var(--foreground)] sm:mt-6 sm:leading-[0.98] sm:tracking-[-0.045em]">
            Everything you need. One ChapsSmS platform.
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-6 text-[var(--muted-foreground)] min-[390px]:text-base min-[390px]:leading-7 sm:mt-6 sm:text-lg sm:leading-8 lg:mx-0 lg:max-w-xl">
            Buy international numbers for OTP verification and browse social accounts,
            VPN access, proxy-related tools and other digital products from one wallet.
          </p>

          <div className="relative z-30 mt-6 flex flex-col justify-center gap-2.5 min-[390px]:gap-3 sm:mt-8 sm:flex-row sm:flex-wrap lg:justify-start">
            <Link
              href="/buy-number"
              className={primaryLink}
            >
              Buy a Number
              <ArrowRight size={18} />
            </Link>

            <Link
              href="/buy-socials"
              className={secondaryLink}
            >
              Browse Accounts & VPNs
            </Link>
          </div>

          <p className="mt-4 text-xs font-medium text-[var(--muted-foreground)] min-[390px]:text-sm">
            New to ChapsSmS?{" "}
            <Link
              href="/signup"
              className="font-black text-blue-600 hover:text-blue-500"
            >
              Create an account
            </Link>
          </p>

          <div className="mt-7 grid gap-2.5 text-left min-[390px]:gap-3 sm:mt-9 sm:grid-cols-2">
            {benefits.map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.text}
                  className="flex items-center gap-3 rounded-xl border border-transparent px-1 py-1 text-sm font-semibold text-[var(--foreground)]"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300">
                    <Icon size={17} />
                  </span>
                  <span>{item.text}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="animate-fade-up animation-delay-150 relative mx-auto w-full max-w-xl lg:max-w-none">
          <div className="pointer-events-none absolute -left-4 top-10 z-20 hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 shadow-xl sm:block lg:-left-8">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 text-green-700 dark:bg-green-950/70 dark:text-green-300">
                <BadgeCheck size={20} />
              </span>
              <div>
                <p className="text-xs text-[var(--muted-foreground)]">One wallet</p>
                <p className="text-sm font-black text-[var(--foreground)]">Multiple services</p>
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[28px] border border-blue-200/70 bg-[var(--card)] p-3 shadow-[0_35px_90px_-35px_rgba(37,99,235,0.38)] dark:border-blue-900/60 sm:p-5">
            <div className="rounded-[22px] border border-[var(--border)] bg-[var(--background)] p-4 sm:p-6">
              <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                    ChapsSmS Wallet
                  </p>
                  <p className="mt-1 text-2xl font-black text-[var(--foreground)] sm:text-3xl">
                    ₦19,500
                  </p>
                </div>

                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
                  <WalletCards size={21} />
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Link
                  href="/buy-number"
                  className="group rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 transition hover:border-blue-300 hover:bg-[var(--muted)] dark:hover:border-blue-800"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
                    <MessageSquareText size={18} />
                  </span>
                  <p className="mt-4 font-black text-[var(--foreground)]">Buy Number</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">
                    International SMS verification numbers.
                  </p>
                </Link>

                <Link
                  href="/buy-socials"
                  className="group rounded-2xl border border-blue-500/30 bg-blue-600/5 p-4 transition hover:border-blue-500/60 hover:bg-blue-600/10"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white">
                    <ShoppingBag size={18} />
                  </span>
                  <p className="mt-4 font-black text-[var(--foreground)]">Accounts & VPNs</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">
                    Social accounts, VPNs and digital tools.
                  </p>
                </Link>
              </div>

              <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                      Available categories
                    </p>
                    <p className="mt-1 font-black text-[var(--foreground)]">
                      Numbers + digital marketplace
                    </p>
                  </div>

                  <PackageCheck className="shrink-0 text-blue-600" size={20} />
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {serviceChips.map((item) => (
                    <div
                      key={item.label}
                      className="flex min-w-0 flex-col items-center gap-1.5 rounded-xl bg-[var(--muted)] p-2 text-center"
                    >
                      <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-[10px] font-black text-white ${item.className}`}>
                        {item.badge}
                      </span>
                      <span className="w-full truncate text-[10px] font-bold text-[var(--muted-foreground)]">
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-100 text-green-700 dark:bg-green-950/70 dark:text-green-300">
                      <KeyRound size={17} />
                    </span>
                    <div>
                      <p className="text-xs text-[var(--muted-foreground)]">Delivery</p>
                      <p className="font-black text-[var(--foreground)]">Instant where available</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300">
                      <Globe2 size={17} />
                    </span>
                    <div>
                      <p className="text-xs text-[var(--muted-foreground)]">Access</p>
                      <p className="font-black text-[var(--foreground)]">One dashboard</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
