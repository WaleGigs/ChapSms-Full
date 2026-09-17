import {
  CheckCircle2,
  CreditCard,
  PackageCheck,
  UserPlus,
} from "lucide-react";

import Section from "@/components/ui/Section";
import Card from "@/components/ui/Card";

const steps = [
  {
    icon: UserPlus,
    title: "Create your account",
    text: "Sign up once and access both virtual numbers and the Accounts & VPN marketplace.",
  },
  {
    icon: CreditCard,
    title: "Fund your wallet",
    text: "Add funds securely and use the same ChapsSmS balance across available services.",
  },
  {
    icon: PackageCheck,
    title: "Choose what you need",
    text: "Buy a verification number or browse available accounts, VPNs and digital products.",
  },
  {
    icon: CheckCircle2,
    title: "Receive your order",
    text: "Get your OTP or eligible digital delivery, then review everything from your history.",
  },
];

export default function HowItWorks() {
  return (
    <Section
      className="bg-slate-50 dark:bg-gray-900"
      id="how-it-works"
    >
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">
          Simple from start to finish
        </p>

        <h2 className="mt-3 text-3xl font-black tracking-tight text-gray-950 dark:text-white md:text-4xl">
          How ChapsSmS Works
        </h2>

        <p className="mt-3 text-sm leading-6 text-gray-500 dark:text-gray-400 sm:text-base">
          One account gives you access to both number verification and available digital products.
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, index) => {
          const Icon = step.icon;

          return (
            <Card key={step.title}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-700 text-white">
                  <Icon size={19} />
                </div>

                <span className="text-3xl font-black text-blue-100 dark:text-blue-950">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </div>

              <h3 className="mt-5 font-black text-gray-900 dark:text-white">
                {step.title}
              </h3>

              <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
                {step.text}
              </p>
            </Card>
          );
        })}
      </div>
    </Section>
  );
}
