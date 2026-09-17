// components/home/FAQ.jsx
"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import Section from "@/components/ui/Section";
import Card from "@/components/ui/Card";
import SectionHeader from "@/components/ui/SectionHeader";

const faqs = [
  {
    question: "How long does a virtual number stay active?",
    answer:
      "A number stays active for the duration of the order window. If no SMS arrives within the allowed time, the order can expire or be cancelled based on your provider rules.",
  },
  {
    question: "Do I get refunded if the OTP does not arrive?",
    answer:
      "Yes. ChapsSmS should support automatic or manual refunds for eligible failed, expired, or cancelled orders.",
  },
  {
    question: "Can developers use ChapsSmS through an API?",
    answer:
      "Yes. Developers can generate an API key and use REST endpoints for balance checks, number purchases, SMS retrieval, and order cancellation.",
  },
  {
    question: "Can I choose a country and service?",
    answer:
      "Yes. Users can select the preferred country and supported service before purchasing a virtual number.",
  },
  {
    question: "Is ChapsSmS a subscription service?",
    answer:
      "No. The recommended model is wallet-based pay-as-you-go pricing, so users only pay when they purchase numbers.",
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <Section className="bg-slate-50 dark:bg-slate-950" id="faq">
      <SectionHeader
        badge="FAQ"
        title="Questions users usually ask before getting started"
        text="Give visitors clear answers about orders, OTP delivery, wallet refunds, and API access."
        center
      />

      <div className="mx-auto max-w-3xl space-y-4">
        {faqs.map((faq, index) => {
          const isOpen = openIndex === index;

          return (
            <Card key={faq.question} className="p-0">
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : index)}
                className="flex w-full items-center justify-between gap-4 p-5 text-left"
              >
                <span className="font-bold text-[var(--foreground)]">
                  {faq.question}
                </span>

                <ChevronDown
                  size={20}
                  className={`shrink-0 text-[var(--muted-foreground)] transition ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {isOpen && (
                <div className="border-t border-[var(--border)] px-5 pb-5 pt-4">
                  <p className="leading-7 text-[var(--muted-foreground)]">{faq.answer}</p>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </Section>
  );
}