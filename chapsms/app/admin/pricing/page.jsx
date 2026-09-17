"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BadgeDollarSign, Boxes } from "lucide-react";

import NumberPricingPanel from "@/components/admin/NumberPricingPanel";
import SocialPricingPanel from "@/components/admin/SocialPricingPanel";

export default function AdminPricingPage() {
  const searchParams = useSearchParams();
  const [section, setSection] = useState("numbers");

  useEffect(() => {
    if (searchParams.get("section") === "socials") {
      setSection("socials");
    }
  }, [searchParams]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-1.5 sm:max-w-md">
        <button
          type="button"
          onClick={() => setSection("numbers")}
          className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-xs font-black transition min-[390px]:text-sm sm:px-4 ${
            section === "numbers"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
          }`}
        >
          <BadgeDollarSign size={17} />
          Numbers
        </button>

        <button
          type="button"
          onClick={() => setSection("socials")}
          className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-xs font-black transition min-[390px]:text-sm sm:px-4 ${
            section === "socials"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
          }`}
        >
          <Boxes size={17} />
          Accounts & VPNs
        </button>
      </div>

      {section === "numbers" ? <NumberPricingPanel /> : <SocialPricingPanel />}
    </div>
  );
}
