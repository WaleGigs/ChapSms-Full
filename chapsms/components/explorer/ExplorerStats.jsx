// components/explorer/ExplorerStats.jsx
import { Clock3, Hash, WalletCards } from "lucide-react";
import Card from "@/components/ui/Card";

export default function ExplorerStats({ country, service, total }) {
  const stats = [
    {
      label: "Available Numbers",
      value: country.available.toLocaleString(),
      icon: Hash,
    },
    {
      label: "Price Per Number",
      value: `$${country.price}`,
      icon: WalletCards,
    },
    {
      label: "Estimated Delivery",
      value: service.delivery,
      icon: Clock3,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {stats.map((item) => {
        const Icon = item.icon;

        return (
          <Card key={item.label}>
            <Icon className="text-blue-600" size={22} />
            <p className="mt-4 text-sm text-[var(--muted)]">{item.label}</p>
            <h3 className="mt-1 text-xl font-black text-[var(--foreground)]">
              {item.value}
            </h3>
          </Card>
        );
      })}

      <Card className="sm:col-span-3">
        <p className="text-sm text-[var(--muted)]">Estimated Total</p>
        <h3 className="mt-1 text-4xl font-black text-blue-600">${total}</h3>
      </Card>
    </div>
  );
}