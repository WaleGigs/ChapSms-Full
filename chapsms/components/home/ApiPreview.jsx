"use client";

import {
  useState,
} from "react";
import {
  Check,
  Copy,
  KeyRound,
  Server,
  ShieldCheck,
} from "lucide-react";

import Section from "@/components/ui/Section";
import Card from "@/components/ui/Card";
import SectionHeader from "@/components/ui/SectionHeader";

const apiCode = `POST /api/orders
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{
  "server": "server1",
  "country": "12",
  "service": "wa",
  "operator": "3170"
}

Response
{
  "success": true,
  "order": {
    "status": "waiting",
    "phoneNumber": "+12025550184",
    "price": 4000
  }
}`;

const apiFeatures = [
  {
    icon: KeyRound,
    title: "Authenticated requests",
  },
  {
    icon: Server,
    title: "Server-aware ordering",
  },
  {
    icon: ShieldCheck,
    title: "Protected order access",
  },
];

const primaryLink =
  "focus-ring relative z-30 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition duration-200 hover:bg-blue-700 active:scale-[0.98] sm:w-auto";

const secondaryLink =
  "focus-ring relative z-30 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] px-5 py-3 text-sm font-semibold text-[var(--foreground)] shadow-sm transition duration-200 hover:border-blue-300 hover:bg-[var(--muted)] active:scale-[0.98] dark:hover:border-blue-800 sm:w-auto";

async function copyText(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea =
    document.createElement("textarea");

  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";

  document.body.appendChild(textarea);

  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

export default function ApiPreview() {
  const [
    copied,
    setCopied,
  ] = useState(false);

  async function handleCopy() {
    try {
      await copyText(apiCode);
      setCopied(true);

      window.setTimeout(
        () => setCopied(false),
        1800,
      );
    } catch {
      setCopied(false);
    }
  }

  return (
    <Section
      className="bg-[var(--background)]"
      id="api"
    >
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <div>
          <SectionHeader
            badge="Developer API"
            title="Connect SMS verification to your own product"
            text="Use authenticated requests to create orders, retrieve status updates, and build your own customer-facing workflow on top of ChapsSmS."
          />

          <div className="grid gap-3 sm:grid-cols-3">
            {apiFeatures.map((item) => {
              const Icon = item.icon;

              return (
                <Card
                  key={item.title}
                  className="p-4"
                >
                  <Icon
                    className="text-blue-600"
                    size={20}
                  />

                  <p className="mt-3 text-sm font-black leading-5 text-[var(--foreground)]">
                    {item.title}
                  </p>
                </Card>
              );
            })}
          </div>

          <div className="relative z-30 mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <a
              href="/login?next=/api-keys"
              className={primaryLink}
            >
              View API docs
            </a>

            <a
              href="/login?next=/api-keys"
              className={secondaryLink}
            >
              Create API key
            </a>
          </div>
        </div>

        <Card className="overflow-hidden rounded-[28px] border-slate-800 bg-slate-950 p-0 text-white shadow-2xl">
          <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-3.5 sm:px-5 sm:py-4">
            <div className="flex min-w-0 items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-500" />
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-400" />
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-green-500" />

              <p className="ml-2 truncate text-xs text-slate-400 sm:text-sm">
                api.chapssms.dev
              </p>
            </div>

            <button
              type="button"
              onClick={handleCopy}
              className="focus-ring flex min-h-9 shrink-0 items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300 transition hover:bg-slate-800 hover:text-white"
              aria-label="Copy API example"
            >
              {copied ? (
                <Check size={15} />
              ) : (
                <Copy size={15} />
              )}

              <span className="hidden min-[400px]:inline">
                {copied
                  ? "Copied"
                  : "Copy"}
              </span>
            </button>
          </div>

          <pre className="max-h-[470px] overflow-auto p-4 text-xs leading-6 text-slate-200 sm:p-6 sm:text-sm sm:leading-7">
            <code>{apiCode}</code>
          </pre>
        </Card>
      </div>
    </Section>
  );
}
