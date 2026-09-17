import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | ChapsSmS",
  description: "How ChapsSmS collects, uses, stores, and protects user information.",
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
          Privacy Policy
        </h1>

        <p className="mt-3 text-sm text-[var(--muted-foreground)]">
          Last updated: 6 August 2026
        </p>

        <div className="mt-8 space-y-8 text-sm leading-7 text-[var(--muted-foreground)] sm:text-base">

<section>
  <h2 className="text-xl font-black text-[var(--foreground)]">
    1. Information we collect
  </h2>

  <p className="mt-2">
    ChapsSmS may collect account information such as your username,
    email address, password hash, authentication provider, profile
    name, and profile picture. We also process wallet-funding
    references, transaction records, virtual-number orders, SMS
    verification results, support messages, device information, and
    security logs needed to operate the service.
  </p>
</section>

<section>
  <h2 className="text-xl font-black text-[var(--foreground)]">
    2. Google Sign-In data
  </h2>

  <p className="mt-2">
    When you choose Google Sign-In, ChapsSmS receives the basic
    identity information contained in the Google ID token, including
    your Google account identifier, verified email address, name,
    and profile picture when available. We use this information only
    to create, link, secure, and authenticate your ChapsSmS account.
  </p>

  <p className="mt-3">
    ChapsSmS does not request access to your Gmail messages, Google
    Drive files, contacts, calendar, or other private Google
    services. We do not sell Google user data.
  </p>
</section>

<section>
  <h2 className="text-xl font-black text-[var(--foreground)]">
    3. Payments
  </h2>

  <p className="mt-2">
    Payments are processed by the payment gateway shown during
    checkout. ChapsSmS stores payment references, amounts,
    currencies, status, and payment-method labels needed to verify
    and reconcile wallet funding. Raw card details are not collected
    or stored by the ChapsSmS frontend or backend.
  </p>
</section>

<section>
  <h2 className="text-xl font-black text-[var(--foreground)]">
    4. How information is used
  </h2>

  <p className="mt-2">
    We use information to create and secure accounts, deliver
    virtual-number and OTP services, maintain wallet and order
    records, prevent fraud and abuse, provide support, troubleshoot
    failures, comply with legal obligations, and improve the
    reliability of ChapsSmS.
  </p>
</section>

<section>
  <h2 className="text-xl font-black text-[var(--foreground)]">
    5. Sharing and service providers
  </h2>

  <p className="mt-2">
    Information may be shared only with infrastructure, email,
    payment, analytics, fraud-prevention, and SMS-number providers
    to the extent required to provide the service. We may also
    disclose information when required by law or to protect users,
    ChapsSmS, or the public from harm.
  </p>
</section>

<section>
  <h2 className="text-xl font-black text-[var(--foreground)]">
    6. Retention and security
  </h2>

  <p className="mt-2">
    We retain account, wallet, order, and security records for as
    long as reasonably required to provide the service, resolve
    disputes, prevent abuse, and meet legal or financial obligations.
    We use technical and organizational safeguards, but no online
    system can guarantee absolute security.
  </p>
</section>

<section>
  <h2 className="text-xl font-black text-[var(--foreground)]">
    7. Your choices
  </h2>

  <p className="mt-2">
    You may update available profile information, stop using Google
    Sign-In, or request account assistance and deletion through the
    ChapsSmS support page. Certain transaction and security records
    may be retained when required for fraud prevention, accounting,
    dispute resolution, or legal compliance.
  </p>
</section>

<section>
  <h2 className="text-xl font-black text-[var(--foreground)]">
    8. Contact
  </h2>

  <p className="mt-2">
    Questions about this policy or the use of your information can
    be submitted through the ChapsSmS support page.
  </p>

  <Link
    href="/support"
    className="mt-3 inline-flex font-bold text-blue-600 hover:text-blue-700"
  >
    Open support
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
