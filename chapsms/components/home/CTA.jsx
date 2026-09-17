import {
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

import Section from "@/components/ui/Section";

const points = [
  "Create an account in minutes",
  "Review the final price before buying",
  "Track every order from one dashboard",
];

const whiteLink =
  "focus-ring relative z-30 inline-flex min-h-13 w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-white px-6 py-3.5 text-base font-semibold text-blue-700 shadow-lg transition duration-200 hover:bg-blue-50 active:scale-[0.98] sm:px-7";

const glassLink =
  "focus-ring relative z-30 inline-flex min-h-13 w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-white/25 bg-white/10 px-6 py-3.5 text-base font-semibold text-white transition duration-200 hover:bg-white/20 active:scale-[0.98] sm:px-7";

export default function CTA() {
  return (
    <Section className="bg-[var(--background)]">
      <div className="relative overflow-hidden rounded-[30px] bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 px-5 py-12 text-white shadow-[0_35px_80px_-35px_rgba(37,99,235,0.65)] sm:px-8 sm:py-16 lg:px-14">
        <div className="pointer-events-none absolute -left-20 -top-24 h-64 w-64 rounded-full bg-white/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 -right-16 h-72 w-72 rounded-full bg-violet-300/20 blur-3xl" />

        <div className="relative z-20 grid items-center gap-9 lg:grid-cols-[1fr_auto] lg:gap-14">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-blue-100">
              Start with ChapsSmS
            </p>

            <h2 className="text-balance mt-4 max-w-3xl text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
              A sharper way to manage virtual numbers and verification codes.
            </h2>

            <p className="mt-5 max-w-2xl text-base leading-7 text-blue-100 sm:text-lg sm:leading-8">
              Create your account, fund your wallet, select the right server and
              operator, and follow every order from one responsive workspace.
            </p>

            <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:max-w-2xl">
              {points.map((point) => (
                <div
                  key={point}
                  className="flex items-center gap-2 text-sm font-semibold text-blue-50"
                >
                  <CheckCircle2 size={17} className="shrink-0" />
                  {point}
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-30 flex flex-col gap-3 sm:flex-row lg:flex-col">
            <a href="/signup" className={whiteLink}>
              Create free account
              <ArrowRight size={18} />
            </a>

            <a href="/login" className={glassLink}>
              Login
            </a>
          </div>
        </div>
      </div>
    </Section>
  );
}
