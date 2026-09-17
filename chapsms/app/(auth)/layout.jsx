import Link from "next/link";

import ThemeToggle from "@/components/ui/ThemeToggle";

export default function AuthLayout({
  children,
}) {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="fixed inset-x-0 top-0 z-[100] border-b border-[var(--border)] bg-[var(--background)]/90 backdrop-blur-xl supports-[backdrop-filter]:bg-[var(--background)]/78">
        <nav className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:h-[72px] sm:px-6 lg:px-8">
          <Link
            href="/"
            aria-label="ChapsSmS homepage"
            className="focus-ring rounded-lg text-2xl font-black tracking-tight text-[var(--foreground)]"
          >
            Chaps
            <span className="text-blue-600">
              SmS
            </span>
          </Link>

          <ThemeToggle />
        </nav>
      </header>

      <main className="pt-16 sm:pt-[72px]">
        <div className="grid min-h-[calc(100vh-4rem)] sm:min-h-[calc(100vh-72px)] lg:grid-cols-2">
          <section className="hidden bg-blue-600 p-10 text-white lg:flex lg:flex-col lg:justify-between">
            <div>
              <p className="mb-4 text-sm font-bold uppercase tracking-widest text-blue-100">
                SMS Verification Platform
              </p>

              <h1 className="max-w-xl text-5xl font-black leading-tight">
                Receive OTPs from hundreds of services in seconds.
              </h1>

              <p className="mt-6 max-w-md text-lg leading-8 text-blue-100">
                Secure virtual numbers, wallet management, instant delivery,
                and API access for users and developers.
              </p>
            </div>

            <div className="rounded-3xl bg-white/10 p-6 backdrop-blur-xl">
              <p className="text-sm text-blue-100">
                Live OTP Preview
              </p>

              <div className="mt-4 rounded-2xl bg-white p-5 text-slate-950">
                <div className="flex items-center justify-between">
                  <p className="font-bold">
                    Telegram OTP
                  </p>

                  <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">
                    Received
                  </span>
                </div>

                <p className="mt-3 text-sm text-slate-500">
                  +44 7584 293010
                </p>

                <p className="mt-4 text-4xl font-black tracking-widest text-blue-600">
                  482913
                </p>
              </div>
            </div>
          </section>

          <section className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-8 sm:min-h-[calc(100vh-72px)] sm:px-6 sm:py-10">
            <div className="w-full max-w-md">
              {children}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
