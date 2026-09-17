// data/search.js
import { orders } from "@/data/orders/orders";
import { countries } from "@/data/orders/countries";
import { services } from "@/data/orders/services";
import { transactions } from "@/data/transactions/transactions";
import { apiKeys } from "@/data/api/apiKeys";

export const searchItems = [
  ...orders.map((item) => ({
    title: item.id,
    subtitle: `${item.service} • ${item.country} • ${item.status}`,
    href: "/orders",
    type: "Order",
  })),

  ...countries.map((item) => ({
    title: `${item.flag} ${item.name}`,
    subtitle: `${item.available.toLocaleString()} numbers • From $${item.price}`,
    href: "/buy-number",
    type: "Country",
  })),

  ...services.map((item) => ({
    title: `${item.icon} ${item.name}`,
    subtitle: `Delivery: ${item.delivery}`,
    href: "/buy-number",
    type: "Service",
  })),

  ...transactions.map((item) => ({
    title: item.id,
    subtitle: `${item.type} • ${item.amount} • ${item.status}`,
    href: "/transactions",
    type: "Transaction",
  })),

  ...apiKeys.map((item) => ({
    title: item.name,
    subtitle: `${item.key} • ${item.status}`,
    href: "/api-keys",
    type: "API Key",
  })),
];