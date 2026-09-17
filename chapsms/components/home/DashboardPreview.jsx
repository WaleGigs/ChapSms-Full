// components/home/DashboardPreview.jsx
import {
  Activity,
  CheckCircle2,
  Clock3,
  CreditCard,
  Smartphone,
  TrendingUp,
} from "lucide-react";
import Section from "@/components/ui/Section";
import Card from "@/components/ui/Card";
import SectionHeader from "@/components/ui/SectionHeader";
import Badge from "@/components/ui/Badge";

const orders = [
  { service: "Telegram", country: "United Kingdom", status: "Received" },
  { service: "WhatsApp", country: "United States", status: "Waiting" },
  { service: "Google", country: "Canada", status: "Completed" },
];

export default function DashboardPreview() {
  return (
    <Section className="bg-[var(--background)]" id="dashboard-preview">
      <SectionHeader
        badge="Dashboard Preview"
        title="Manage numbers, OTPs, wallet, and API keys from one clean dashboard"
        text="ChapsSmS gives users a simple dashboard for buying numbers, tracking SMS codes, checking balances, and reviewing transactions."
      />

      <Card className="overflow-hidden rounded-3xl p-0 shadow-2xl">
        <div className="border-b border-[var(--border)] p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-black text-[var(--foreground)]">
                ChapsSmS Dashboard
              </h3>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                Live user workspace preview
              </p>
            </div>

            <Badge variant="success">Online</Badge>
          </div>
        </div>

        <div className="grid gap-0 lg:grid-cols-[260px_1fr]">
          <aside className="border-r border-[var(--border)] bg-[var(--background)] p-5">
            <div className="space-y-3">
              {["Overview", "Buy Number", "Orders", "Wallet", "API Keys"].map(
                (item, index) => (
                  <div
                    key={item}
                    className={`rounded-xl px-4 py-3 text-sm font-semibold ${
                      index === 0
                        ? "bg-blue-600 text-white"
                        : "text-[var(--muted-foreground)]"
                    }`}
                  >
                    {item}
                  </div>
                )
              )}
            </div>
          </aside>

          <div className="p-5">
            <div className="grid gap-5 md:grid-cols-4">
              <Card>
                <CreditCard className="text-blue-600" size={22} />
                <p className="mt-4 text-sm text-[var(--muted-foreground)]">Balance</p>
                <h4 className="mt-1 text-2xl font-black text-[var(--foreground)]">
                  $248.50
                </h4>
              </Card>

              <Card>
                <Smartphone className="text-blue-600" size={22} />
                <p className="mt-4 text-sm text-[var(--muted-foreground)]">Orders</p>
                <h4 className="mt-1 text-2xl font-black text-[var(--foreground)]">
                  1,284
                </h4>
              </Card>

              <Card>
                <CheckCircle2 className="text-green-600" size={22} />
                <p className="mt-4 text-sm text-[var(--muted-foreground)]">Success</p>
                <h4 className="mt-1 text-2xl font-black text-[var(--foreground)]">
                  98.7%
                </h4>
              </Card>

              <Card>
                <Activity className="text-amber-600" size={22} />
                <p className="mt-4 text-sm text-[var(--muted-foreground)]">API Calls</p>
                <h4 className="mt-1 text-2xl font-black text-[var(--foreground)]">
                  32K
                </h4>
              </Card>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_320px]">
              <Card>
                <div className="mb-5 flex items-center justify-between">
                  <h4 className="font-bold text-[var(--foreground)]">
                    Recent Orders
                  </h4>
                  <Badge>Live</Badge>
                </div>

                <div className="space-y-4">
                  {orders.map((order) => (
                    <div
                      key={order.service}
                      className="flex items-center justify-between rounded-xl bg-[var(--background)] p-4"
                    >
                      <div>
                        <p className="font-semibold text-[var(--foreground)]">
                          {order.service}
                        </p>
                        <p className="text-sm text-[var(--muted-foreground)]">
                          {order.country}
                        </p>
                      </div>

                      <span className="text-sm font-bold text-blue-600">
                        {order.status}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card>
                <TrendingUp className="text-blue-600" size={26} />
                <h4 className="mt-4 text-lg font-black text-[var(--foreground)]">
                  Order Activity
                </h4>
                <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                  Track SMS delivery status and wallet spending in real time.
                </p>

                <div className="mt-6 space-y-3">
                  {[80, 55, 92, 68].map((width, index) => (
                    <div key={index} className="h-3 rounded-full bg-[var(--background)]">
                      <div
                        className="h-3 rounded-full bg-blue-600"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                  <Clock3 size={16} />
                  Updated moments ago
                </div>
              </Card>
            </div>
          </div>
        </div>
      </Card>
    </Section>
  );
}