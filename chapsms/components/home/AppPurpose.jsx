import {
  BadgeCheck,
  CreditCard,
  MessageSquareText,
  ShieldCheck,
} from "lucide-react";

const purposeItems = [
  {
    icon: MessageSquareText,
    title: "Receive verification SMS",
    text:
      "Choose a supported country and service, purchase a temporary virtual number, and receive the SMS verification code in your dashboard.",
  },
  {
    icon: CreditCard,
    title: "Fund and control your wallet",
    text:
      "Add money through the supported payment gateway and use the wallet to pay for verification-number orders.",
  },
  {
    icon: ShieldCheck,
    title: "Secure account access",
    text:
      "Create an account with email and password or use Google Sign-In. Google profile data is used only to create and authenticate your ChapsSmS account.",
  },
];

export default function AppPurpose() {
  return (
    <section
      id="about"
      aria-labelledby="app-purpose-title"
      className="border-y border-[var(--border)] bg-[var(--muted)]/35 px-6 py-16 sm:py-20"
    >
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-blue-600 dark:text-blue-300">
            <BadgeCheck size={15} />
            What ChapsSmS does
          </div>

          <h2
            id="app-purpose-title"
            className="mt-5 text-3xl font-black tracking-tight text-[var(--foreground)] sm:text-4xl"
          >
            Virtual numbers and SMS verification from one account
          </h2>

          <p className="mt-4 text-base leading-8 text-[var(--muted-foreground)] sm:text-lg">
            ChapsSmS is an SMS verification platform that lets registered
            users fund a wallet, purchase temporary virtual numbers for
            supported services, receive OTP messages, and review order and
            wallet-funding history.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {purposeItems.map((item) => {
            const Icon = item.icon;

            return (
              <article
                key={item.title}
                className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white">
                  <Icon size={21} />
                </span>

                <h3 className="mt-5 text-lg font-black text-[var(--foreground)]">
                  {item.title}
                </h3>

                <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">
                  {item.text}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
