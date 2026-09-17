// components/charts/WalletChart.jsx
"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Card from "@/components/ui/Card";
import { walletAnalytics } from "@/data/dashboard/analytics";

export default function WalletChart() {
  return (
    <Card>
      <h3 className="text-lg font-black text-[var(--foreground)]">
        Wallet Spending
      </h3>

      <p className="mt-1 text-sm text-[var(--muted-foreground)]">
        Weekly wallet activity and spending pattern.
      </p>

     <div className="mt-6 h-64 w-full overflow-hidden md:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={walletAnalytics}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="day" stroke="var(--muted)" fontSize={12} />
<YAxis stroke="var(--muted)" fontSize={12} width={35} />
            <Tooltip />
            <Bar dataKey="amount" fill="#2563eb" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}