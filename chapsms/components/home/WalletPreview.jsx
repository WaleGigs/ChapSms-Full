import {
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  Wallet,
} from "lucide-react";

import Section from "@/components/ui/Section";
import Card from "@/components/ui/Card";
import SectionHeader from "@/components/ui/SectionHeader";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";

const transactions = [
  {
    type: "Deposit",
    amount: "+₦10,000",
    status: "Successful",
    icon: ArrowDownLeft,
  },
  {
    type: "Telegram OTP",
    amount: "-₦320",
    status: "Completed",
    icon: ArrowUpRight,
  },
  {
    type: "Refund",
    amount: "+₦280",
    status: "Returned",
    icon: ArrowDownLeft,
  },
];

export default function WalletPreview() {
  return (
    <Section
      className="bg-slate-50 dark:bg-slate-950"
      id="wallet-preview"
    >
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <SectionHeader
          badge="Smart wallet"
          title="Control spending with a clear wallet and transaction history"
          text="Fund your account, purchase numbers, receive refunds, and monitor wallet activity from one financial-style interface."
        />

        <Card className="rounded-3xl p-5 shadow-2xl sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                <Wallet size={26} />
              </div>

              <p className="text-sm text-[var(--muted-foreground)]">
                Available balance
              </p>
              <h3 className="mt-2 text-4xl font-black text-[var(--foreground)] sm:text-5xl">
                ₦9,419
              </h3>
            </div>

            <Badge variant="success">Active</Badge>
          </div>

          <div className="relative z-10 mt-8 grid gap-3 sm:grid-cols-2">
            <Button href="/wallet" className="w-full">
              <Plus size={18} />
              Fund wallet
            </Button>

            <Button
              href="/orders"
              variant="secondary"
              className="w-full"
            >
              View history
            </Button>
          </div>

          <div className="mt-8">
            <h4 className="mb-4 font-bold text-[var(--foreground)]">
              Recent transactions
            </h4>

            <div className="space-y-3">
              {transactions.map((transaction) => {
                const Icon = transaction.icon;

                return (
                  <div
                    key={transaction.type}
                    className="flex items-center justify-between gap-4 rounded-2xl bg-[var(--background)] p-4"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--card)] text-blue-600">
                        <Icon size={18} />
                      </div>

                      <div className="min-w-0">
                        <p className="truncate font-semibold text-[var(--foreground)]">
                          {transaction.type}
                        </p>
                        <p className="text-sm text-[var(--muted-foreground)]">
                          {transaction.status}
                        </p>
                      </div>
                    </div>

                    <p className="shrink-0 font-black text-[var(--foreground)]">
                      {transaction.amount}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      </div>
    </Section>
  );
}