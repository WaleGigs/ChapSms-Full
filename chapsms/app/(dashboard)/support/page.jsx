"use client";

import { useState } from "react";
import { ChevronDown, CircleHelp, MessageCircle } from "lucide-react";

const faqs = [
  {
    question: "I bought a number but did not receive an OTP. What should I do?",
    answer:
      "Enter the purchased number in the target application and request an SMS. Wait for the order page to update. When the provider returns an empty SMS list, no verification message has arrived yet.",
  },
  {
    question: "Why was my order cancelled automatically?",
    answer:
      "Orders can expire when no SMS arrives before the provider's time limit. They can also be cancelled when the selected service or operator rejects the number.",
  },
  {
    question: "My wallet was charged but the order failed. What should I do?",
    answer:
      "Refresh your wallet and order history first. When an order fails before a number is issued, the balance should be returned. Contact support if it is not restored.",
  },
  {
    question: "Can I receive a refund to my original payment method?",
    answer:
      "Wallet top-ups normally remain as account credit. Refund eligibility depends on the payment status and the reason for the failed order.",
  },
  {
    question: "How do I add money to my wallet?",
    answer:
      "Open Add Funds, select an amount, choose Bank or Card, then complete the Flutterwave checkout modal.",
  },
];

export default function SupportPage() {
  const [openQuestion, setOpenQuestion] = useState(0);
  const whatsappNumber = "2348138304888";
  const whatsappMessage = encodeURIComponent(
    "Hello ChapsSmS support, I need help with my account.",
  );

  return (
    <div className="mx-auto w-full max-w-[1050px]">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-[var(--foreground)]">
          Support <span className="text-blue-600">Center</span>
        </h1>
        <p className="mt-2 text-sm text-[var(--muted-foreground)] sm:text-base">
          Contact support or check the frequently asked questions.
        </p>
      </div>

      <section className="mt-8 rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm sm:p-8">
        <div className="flex flex-col items-start gap-4 sm:flex-row">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-green-50 text-green-600 dark:bg-green-950/40 dark:text-green-300">
            <MessageCircle size={27} />
          </div>

          <div>
            <h2 className="text-2xl font-black text-[var(--foreground)]">WhatsApp Support</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted-foreground)] sm:text-base">
              Message the ChapsSmS team for help with your account, wallet,
              orders or OTP delivery. Include your order ID for a specific purchase.
            </p>
            <a
              href={`https://wa.me/${whatsappNumber}?text=${whatsappMessage}`}
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-green-600 px-5 text-sm font-bold text-white transition hover:bg-green-700"
            >
              <MessageCircle size={18} />
              Chat on WhatsApp
            </a>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-3">
          <CircleHelp className="text-blue-600" size={21} />
          <h2 className="text-xl font-black text-[var(--foreground)]">Frequently asked questions</h2>
        </div>

        <div className="mt-6 divide-y divide-[var(--border)]">
          {faqs.map((faq, index) => {
            const open = openQuestion === index;

            return (
              <div key={faq.question}>
                <button
                  type="button"
                  onClick={() => setOpenQuestion(open ? null : index)}
                  className="flex w-full items-center justify-between gap-5 py-5 text-left"
                >
                  <span className="font-bold leading-6 text-[var(--foreground)]">{faq.question}</span>
                  <ChevronDown
                    size={18}
                    className={`shrink-0 text-[var(--muted-foreground)] transition ${open ? "rotate-180" : ""}`}
                  />
                </button>

                {open ? (
                  <p className="pb-5 pr-8 text-sm leading-7 text-[var(--muted-foreground)]">
                    {faq.answer}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
