"use client";

import { useState } from "react";
import { MessageSquareText, PackageCheck } from "lucide-react";

import NumberOrdersPanel from "@/components/admin/NumberOrdersPanel";
import SocialOrdersPanel from "@/components/admin/SocialOrdersPanel";

export default function AdminOrdersPage() {
  const [tab, setTab] = useState("numbers");

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-1.5 sm:max-w-md">
        <button
          type="button"
          onClick={() => setTab("numbers")}
          className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black ${
            tab === "numbers"
              ? "bg-blue-600 text-white"
              : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
          }`}
        >
          <MessageSquareText size={17} />
          Number Orders
        </button>
        <button
          type="button"
          onClick={() => setTab("socials")}
          className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black ${
            tab === "socials"
              ? "bg-blue-600 text-white"
              : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
          }`}
        >
          <PackageCheck size={17} />
          Logs & Socials
        </button>
      </div>

      {tab === "numbers" ? <NumberOrdersPanel /> : <SocialOrdersPanel />}
    </div>
  );
}
