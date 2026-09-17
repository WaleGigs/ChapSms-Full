import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  Globe2,
  KeyRound,
  ShieldCheck,
  ShoppingBag,
  Users,
  Wifi,
} from "lucide-react";

const categories = [
  {
    icon: Users,
    title: "Social Accounts",
    text: "Browse available social media accounts and related digital products from one catalog.",
  },
  {
    icon: Wifi,
    title: "VPN Access",
    text: "Shop available VPN products with clear duration, stock and pricing before checkout.",
  },
  {
    icon: Globe2,
    title: "Proxy & Tools",
    text: "Access available proxy-related products and useful digital tools when they are in stock.",
  },
  {
    icon: KeyRound,
    title: "Instant Digital Delivery",
    text: "Eligible products are delivered directly to your account after a successful wallet purchase.",
  },
];

export default function AccountsAndVpns() {
  return (
    <section
      id="accounts-vpns"
      className="relative overflow-hidden border-y border-[var(--border)] bg-slate-950 py-14 text-white sm:py-20"
    >
      <div className="pointer-events-none absolute -left-20 top-10 h-64 w-64 rounded-full bg-blue-600/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-violet-600/15 blur-3xl" />

      <div className="site-container relative z-10">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-blue-300">
              <ShoppingBag size={14} />
              Accounts & VPN marketplace
            </div>

            <h2 className="mt-5 max-w-2xl text-3xl font-black tracking-[-0.03em] sm:text-4xl lg:text-5xl">
              More than numbers. Shop accounts, VPNs and digital tools too.
            </h2>

            <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
              ChapsSmS now gives you one place to buy verification numbers and browse
              available social accounts, VPN products, proxy-related tools and other
              digital inventory using the same wallet.
            </p>

            <div className="mt-6 flex flex-col gap-3 min-[420px]:flex-row">
              <Link
                href="/buy-socials"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-500 active:scale-[0.98]"
              >
                Browse Accounts & VPNs
                <ArrowRight size={17} />
              </Link>

              <Link
                href="/buy-number"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-black text-white transition hover:bg-white/10 active:scale-[0.98]"
              >
                Buy a Number
              </Link>
            </div>

            <div className="mt-6 flex flex-wrap gap-2 text-xs font-semibold text-slate-300">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                Live stock
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                Wallet checkout
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                Order history
              </span>
            </div>
          </div>

          <div className="grid gap-3 min-[520px]:grid-cols-2">
            {categories.map((item) => {
              const Icon = item.icon;

              return (
                <article
                  key={item.title}
                  className="rounded-3xl border border-white/10 bg-white/[0.045] p-5 backdrop-blur-sm transition hover:border-blue-500/40 hover:bg-white/[0.07] sm:p-6"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600/15 text-blue-300 ring-1 ring-blue-500/20">
                    <Icon size={20} />
                  </span>

                  <h3 className="mt-5 text-lg font-black">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{item.text}</p>
                </article>
              );
            })}
          </div>
        </div>

        <div className="mt-10 grid gap-3 rounded-3xl border border-white/10 bg-white/[0.04] p-4 sm:grid-cols-3 sm:p-5">
          <div className="flex items-center gap-3 rounded-2xl bg-black/10 p-3">
            <ShieldCheck className="text-green-300" size={19} />
            <span className="text-sm font-bold text-slate-200">Provider identities stay private</span>
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-black/10 p-3">
            <Boxes className="text-blue-300" size={19} />
            <span className="text-sm font-bold text-slate-200">Multiple product categories</span>
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-black/10 p-3">
            <ShoppingBag className="text-violet-300" size={19} />
            <span className="text-sm font-bold text-slate-200">One account, one wallet</span>
          </div>
        </div>
      </div>
    </section>
  );
}
