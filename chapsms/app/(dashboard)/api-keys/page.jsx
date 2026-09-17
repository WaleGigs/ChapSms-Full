"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import {
  ChevronDown,
  Copy,
  KeyRound,
  ListChecks,
  Phone,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Terminal,
  XCircle,
} from "lucide-react";

import Button from "@/components/ui/Button";

const apiKey = "chp_live_9x82ksl092msk29s82k";

const endpoints = [
  {
    id: "balance",
    number: "1",
    title: "Get Balance",
    method: "GET",
    path: "/api/v1/balance",
    description: "Retrieve the current wallet balance for your account.",
    example: `curl "https://api.chapssms.com/api/v1/balance" \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
  },
  {
    id: "services",
    number: "2",
    title: "List Services",
    method: "GET",
    path: "/api/v1/services",
    description:
      "Retrieve supported verification services and their current prices.",
    example: `curl "https://api.chapssms.com/api/v1/services?country=US" \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
  },
  {
    id: "number",
    number: "3",
    title: "Buy Number",
    method: "POST",
    path: "/api/v1/orders",
    description: "Reserve a phone number for a selected country and service.",
    example: `curl -X POST "https://api.chapssms.com/api/v1/orders" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "country": "United States",
    "service": "telegram"
  }'`,
  },
  {
    id: "status",
    number: "4",
    title: "Check Order",
    method: "GET",
    path: "/api/v1/orders/:id",
    description:
      "Check the latest status, phone number, SMS message and OTP code.",
    example: `curl "https://api.chapssms.com/api/v1/orders/ORDER_ID" \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
  },
  {
    id: "cancel",
    number: "5",
    title: "Cancel Order",
    method: "POST",
    path: "/api/v1/orders/:id/cancel",
    description: "Cancel an active order that has not received an OTP.",
    example: `curl -X POST "https://api.chapssms.com/api/v1/orders/ORDER_ID/cancel" \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
  },
];

export default function ApiKeysPage() {
  const [visibleKey, setVisibleKey] = useState(false);
  const [openEndpoint, setOpenEndpoint] = useState(null);
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);

  async function copyText(value, message) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(message);
    } catch {
      toast.error("Could not copy");
    }
  }

  function regenerateKey() {
    setShowRegenerateModal(false);
    toast.success("API key regeneration prepared");
  }

  return (
    <div className="mx-auto w-full max-w-[1080px]">
      <div className="text-center">
        <h1 className="text-3xl font-black tracking-tight text-[var(--foreground)] sm:text-4xl">
          API <span className="text-blue-600">Documentation</span>
        </h1>

        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)] dark:text-[var(--muted-foreground)] sm:text-base">
          Integrate ChapsSmS into your application and automate verification
          number purchases.
        </p>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {[
          {
            icon: Sparkles,
            title: "Fast",
            text: "Reserve numbers and check OTP delivery within seconds.",
          },
          {
            icon: ShieldCheck,
            title: "Secure",
            text: "Every request is authenticated using your private API key.",
          },
          {
            icon: Terminal,
            title: "Simple",
            text: "Clear JSON responses that are easy to integrate.",
          },
        ].map((item) => {
          const Icon = item.icon;

          return (
            <div
              key={item.title}
              className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent)] text-[var(--accent-foreground)]">
                <Icon size={21} />
              </div>

              <h2 className="mt-5 text-lg font-black text-[var(--foreground)]">
                {item.title}
              </h2>

              <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)] dark:text-[var(--muted-foreground)]">
                {item.text}
              </p>
            </div>
          );
        })}
      </div>

      <section className="mt-8 rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm sm:p-8">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white">
              <KeyRound size={21} />
            </div>

            <div>
              <h2 className="text-xl font-black text-[var(--foreground)]">
                Getting started
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)] dark:text-[var(--muted-foreground)]">
                Include your API key in the Authorization header of every
                request.
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="secondary"
            onClick={() => setShowRegenerateModal(true)}
          >
            <RefreshCcw size={17} />
            Regenerate
          </Button>
        </div>

        <div className="mt-7 space-y-5">
          <div>
            <p className="mb-2 text-sm font-bold text-[var(--foreground)]">Base URL</p>

            <CopyBlock
              value="https://api.chapssms.com/api/v1"
              onCopy={() =>
                copyText(
                  "https://api.chapssms.com/api/v1",
                  "Base URL copied"
                )
              }
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-bold text-[var(--foreground)]">
              Authorization header
            </p>

            <CopyBlock
              value="Authorization: Bearer YOUR_API_KEY"
              onCopy={() =>
                copyText(
                  "Authorization: Bearer YOUR_API_KEY",
                  "Authorization header copied"
                )
              }
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-bold text-[var(--foreground)]">
              Your API key
            </p>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex min-h-12 flex-1 items-center rounded-xl border border-[var(--border)] bg-[var(--muted)] px-4 font-mono text-sm font-bold text-[var(--foreground)]">
                {visibleKey ? apiKey : "••••••••••••••••••••••••••••••"}
              </div>

              <button
                type="button"
                onClick={() => setVisibleKey((current) => !current)}
                className="h-12 rounded-xl border border-[var(--border)] px-4 text-sm font-bold text-[var(--foreground)] transition hover:bg-[var(--muted)]"
              >
                {visibleKey ? "Hide" : "Show"}
              </button>

              <button
                type="button"
                onClick={() => copyText(apiKey, "API key copied")}
                className="flex h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white transition hover:bg-blue-700"
              >
                <Copy size={17} />
                Copy
              </button>
            </div>

            <p className="mt-2 text-xs leading-5 text-red-500">
              Never expose your API key in browser code or public repositories.
            </p>
          </div>
        </div>
      </section>

      <div className="mt-10">
        <h2 className="text-2xl font-black text-[var(--foreground)]">API reference</h2>

        <p className="mt-2 text-sm text-[var(--muted-foreground)] dark:text-[var(--muted-foreground)]">
          Expand an endpoint to view its request format and example.
        </p>
      </div>

      <div className="mt-5 space-y-3">
        {endpoints.map((endpoint) => {
          const open = openEndpoint === endpoint.id;

          return (
            <div
              key={endpoint.id}
              className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm"
            >
              <button
                type="button"
                onClick={() =>
                  setOpenEndpoint(open ? null : endpoint.id)
                }
                className="flex w-full items-center justify-between gap-4 p-5 text-left transition hover:bg-[var(--muted)]"
              >
                <div className="flex min-w-0 items-center gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-[var(--accent-foreground)]">
                    {endpoint.id === "services" ? (
                      <ListChecks size={19} />
                    ) : endpoint.id === "number" ? (
                      <Phone size={19} />
                    ) : endpoint.id === "cancel" ? (
                      <XCircle size={19} />
                    ) : (
                      <KeyRound size={19} />
                    )}
                  </div>

                  <div className="min-w-0">
                    <h3 className="font-black text-[var(--foreground)]">
                      <span className="mr-2 text-[var(--muted-foreground)]">
                        {endpoint.number}.
                      </span>
                      {endpoint.title}
                    </h3>

                    <p className="mt-1 truncate font-mono text-xs text-[var(--muted-foreground)]">
                      {endpoint.method} {endpoint.path}
                    </p>
                  </div>
                </div>

                <ChevronDown
                  size={18}
                  className={`shrink-0 text-[var(--muted-foreground)] transition ${
                    open ? "rotate-180" : ""
                  }`}
                />
              </button>

              {open && (
                <div className="border-t border-[var(--border)] p-5">
                  <p className="text-sm leading-6 text-[var(--muted-foreground)]">
                    {endpoint.description}
                  </p>

                  <pre className="mt-4 overflow-x-auto rounded-2xl bg-slate-950 p-5 text-xs leading-6 text-slate-100">
                    <code>{endpoint.example}</code>
                  </pre>

                  <button
                    type="button"
                    onClick={() =>
                      copyText(endpoint.example, "Example copied")
                    }
                    className="mt-3 flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-700"
                  >
                    <Copy size={16} />
                    Copy example
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <section className="mt-8 rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <h2 className="text-xl font-black text-[var(--foreground)]">Rate limits</h2>

        <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)] dark:text-[var(--muted-foreground)]">
          API clients are currently limited to 60 requests per minute per API
          key. Space repeated order-status checks by at least five seconds.
        </p>
      </section>

      {showRegenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4">
          <div className="w-full max-w-md rounded-3xl bg-[var(--card)] p-6 shadow-2xl sm:p-8">
            <h2 className="text-2xl font-black text-[var(--foreground)]">
              Regenerate API key?
            </h2>

            <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)] dark:text-[var(--muted-foreground)]">
              Your existing key will stop working. Applications using it must
              be updated.
            </p>

            <div className="mt-7 flex gap-3">
              <Button
                type="button"
                variant="danger"
                className="flex-1"
                onClick={regenerateKey}
              >
                Regenerate
              </Button>

              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => setShowRegenerateModal(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CopyBlock({ value, onCopy }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--muted)] px-4 py-3">
      <code className="min-w-0 flex-1 overflow-x-auto font-mono text-sm text-[var(--foreground)]">
        {value}
      </code>

      <button
        type="button"
        onClick={onCopy}
        aria-label="Copy"
        className="shrink-0 rounded-lg p-2 text-[var(--muted-foreground)] transition hover:bg-[var(--card)] hover:text-[var(--foreground)]"
      >
        <Copy size={17} />
      </button>
    </div>
  );
}
