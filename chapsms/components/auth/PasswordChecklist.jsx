import { Check, X } from "lucide-react";

import { getPasswordChecks, getPasswordStrength } from "@/lib/formValidation";

const strengthStyles = {
  0: "bg-slate-200 dark:bg-slate-700",
  1: "bg-red-500",
  2: "bg-amber-500",
  3: "bg-blue-500",
  4: "bg-green-500",
};

export default function PasswordChecklist({ password }) {
  const checks = getPasswordChecks(password);
  const strength = getPasswordStrength(password);

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--muted)]/45 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-black text-[var(--foreground)]">Password strength</p>
        <span className="text-xs font-bold text-[var(--muted-foreground)]">
          {strength.label}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-1.5" aria-hidden="true">
        {[1, 2, 3, 4].map((level) => (
          <span
            key={level}
            className={`h-1.5 rounded-full transition ${
              strength.score >= level
                ? strengthStyles[strength.score]
                : "bg-slate-200 dark:bg-slate-700"
            }`}
          />
        ))}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {checks.map((check) => (
          <div
            key={check.key}
            className={`flex items-center gap-2 text-xs font-semibold ${
              check.passed
                ? "text-green-700 dark:text-green-400"
                : "text-[var(--muted-foreground)]"
            }`}
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                check.passed
                  ? "bg-green-100 dark:bg-green-950/70"
                  : "bg-[var(--card)]"
              }`}
            >
              {check.passed ? <Check size={12} /> : <X size={12} />}
            </span>
            {check.label}
          </div>
        ))}
      </div>
    </div>
  );
}