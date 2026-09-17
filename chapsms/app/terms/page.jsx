import Link from "next/link";

export const metadata = {
  title: "Terms of Service | ChapsSmS",
  description: "Terms governing access to and use of the ChapsSmS platform.",
};

export default function Page() {
  return (
    <main className="min-h-screen bg-[var(--background)] px-5 py-12 text-[var(--foreground)] sm:px-6">
      <article className="mx-auto max-w-3xl rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm sm:p-10">
        <Link
          href="/"
          className="text-xl font-black"
        >
          Chaps
          <span className="text-blue-600">
            SmS
          </span>
        </Link>

        <h1 className="mt-8 text-3xl font-black tracking-tight sm:text-4xl">
          Terms of Service
        </h1>

        <p className="mt-3 text-sm text-[var(--muted-foreground)]">
          Last updated: 6 August 2026
        </p>

        <div className="mt-8 space-y-8 text-sm leading-7 text-[var(--muted-foreground)] sm:text-base">

<section>
  <h2 className="text-xl font-black text-[var(--foreground)]">
    1. Acceptance
  </h2>

  <p className="mt-2">
    By creating an account, signing in, funding a wallet, purchasing
    a virtual number, or otherwise using ChapsSmS, you agree to
    these Terms of Service and the Privacy Policy.
  </p>
</section>

<section>
  <h2 className="text-xl font-black text-[var(--foreground)]">
    2. Permitted use
  </h2>

  <p className="mt-2">
    ChapsSmS may be used only for lawful SMS-verification activities
    for accounts and services that you are authorized to access. You
    must not use ChapsSmS for fraud, spam, harassment, impersonation,
    evasion of platform restrictions, illegal account creation,
    unauthorized access, or any activity that violates applicable
    law or a third-party service&apos;s terms.
  </p>
</section>

<section>
  <h2 className="text-xl font-black text-[var(--foreground)]">
    3. Accounts and security
  </h2>

  <p className="mt-2">
    You are responsible for providing accurate information,
    protecting your credentials, and all activity under your
    account. ChapsSmS may suspend or terminate accounts associated
    with abuse, fraud, chargebacks, security risks, or violations of
    these terms.
  </p>
</section>

<section>
  <h2 className="text-xl font-black text-[var(--foreground)]">
    4. Wallet funding and orders
  </h2>

  <p className="mt-2">
    Wallet funding is credited only after backend verification by
    the configured payment gateway. Prices, availability, supported
    countries, supported services, and provider inventory may change
    without notice. A number order is not guaranteed until the
    provider confirms it.
  </p>
</section>

<section>
  <h2 className="text-xl font-black text-[var(--foreground)]">
    5. OTP delivery
  </h2>

  <p className="mt-2">
    Delivery depends on third-party mobile networks, SMS providers,
    and the external service sending the message. ChapsSmS cannot
    guarantee that every number will receive an OTP or that every
    external platform will accept a supplied number.
  </p>
</section>

<section>
  <h2 className="text-xl font-black text-[var(--foreground)]">
    6. Refunds
  </h2>

  <p className="mt-2">
    Refund eligibility is governed by the published Refund Policy.
    Approved refunds may be returned to the ChapsSmS wallet rather
    than the original payment method, depending on the transaction
    and provider status.
  </p>
</section>

<section>
  <h2 className="text-xl font-black text-[var(--foreground)]">
    7. Service availability
  </h2>

  <p className="mt-2">
    We may modify, pause, restrict, or discontinue any feature to
    maintain security, comply with law, respond to provider changes,
    or protect the platform. Planned or unplanned downtime may occur.
  </p>
</section>

<section>
  <h2 className="text-xl font-black text-[var(--foreground)]">
    8. Limitation of liability
  </h2>

  <p className="mt-2">
    To the maximum extent permitted by law, ChapsSmS is not liable
    for indirect or consequential loss, rejected verification
    attempts, third-party service decisions, provider outages,
    carrier delays, or misuse of an account.
  </p>
</section>

<section>
  <h2 className="text-xl font-black text-[var(--foreground)]">
    9. Contact
  </h2>

  <Link
    href="/support"
    className="mt-2 inline-flex font-bold text-blue-600 hover:text-blue-700"
  >
    Contact ChapsSmS support
  </Link>
</section>
        </div>

        <div className="mt-10 border-t border-[var(--border)] pt-6">
          <Link
            href="/"
            className="font-bold text-blue-600 hover:text-blue-700"
          >
            Return to ChapsSmS
          </Link>
        </div>
      </article>
    </main>
  );
}
