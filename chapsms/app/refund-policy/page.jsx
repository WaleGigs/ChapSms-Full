import Link from "next/link";

export const metadata = {
  title: "Refund Policy | ChapsSmS",
  description: "Refund eligibility and review procedures for ChapsSmS transactions.",
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
          Refund Policy
        </h1>

        <p className="mt-3 text-sm text-[var(--muted-foreground)]">
          Last updated: 6 August 2026
        </p>

        <div className="mt-8 space-y-8 text-sm leading-7 text-[var(--muted-foreground)] sm:text-base">

<section>
  <h2 className="text-xl font-black text-[var(--foreground)]">
    1. Wallet funding
  </h2>

  <p className="mt-2">
    A completed wallet-funding transaction is generally final once
    the payment gateway confirms it and the corresponding value is
    credited. Duplicate charges, incorrect gateway captures, or
    unauthorized payments should be reported promptly through
    support with the payment reference.
  </p>
</section>

<section>
  <h2 className="text-xl font-black text-[var(--foreground)]">
    2. Virtual-number orders
  </h2>

  <p className="mt-2">
    An order may qualify for an automatic wallet refund when the
    provider fails to supply a number, the order is cancelled within
    an allowed cancellation period, or the backend confirms that the
    provider transaction failed before service delivery.
  </p>
</section>

<section>
  <h2 className="text-xl font-black text-[var(--foreground)]">
    3. Non-refundable situations
  </h2>

  <p className="mt-2">
    A refund may be refused after an OTP or SMS has been received,
    after a number has been used, when the external service rejects
    an otherwise valid number, when the user enters incorrect order
    details, or when the activity violates ChapsSmS policies or law.
  </p>
</section>

<section>
  <h2 className="text-xl font-black text-[var(--foreground)]">
    4. Refund destination
  </h2>

  <p className="mt-2">
    Approved order refunds are normally returned to the same
    ChapsSmS wallet balance used for the purchase. A return to the
    original payment method is available only when required or
    approved through the relevant payment process.
  </p>
</section>

<section>
  <h2 className="text-xl font-black text-[var(--foreground)]">
    5. Requesting review
  </h2>

  <p className="mt-2">
    Submit the order ID, payment reference, amount, date, and a clear
    explanation through support. Reviews may require information
    from the payment gateway or SMS provider.
  </p>

  <Link
    href="/support"
    className="mt-3 inline-flex font-bold text-blue-600 hover:text-blue-700"
  >
    Request a refund review
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
