// components/charts/OrdersChart.jsx
"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Card from "@/components/ui/Card";
import { ordersAnalytics } from "@/data/dashboard/analytics";

export default function OrdersChart() {
  return (
    <Card>
      <h3 className="text-lg font-black text-[var(--foreground)]">
        Orders Overview
      </h3>
      <p className="mt-1 text-sm text-[var(--muted-foreground)]">
        Weekly virtual number purchase activity.
      </p>

      <div className="mt-6 h-64 w-full overflow-hidden md:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={ordersAnalytics}>
            <defs>
              <linearGradient id="ordersGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
           <XAxis dataKey="day" stroke="var(--muted)" fontSize={12} />
<YAxis stroke="var(--muted)" fontSize={12} width={35} />
            <Tooltip />
            <Area
              type="monotone"
              dataKey="orders"
              stroke="#2563eb"
              fill="url(#ordersGradient)"
              strokeWidth={3}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}