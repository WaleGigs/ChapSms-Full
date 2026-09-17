"use client";

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { cn } from "@/lib/utils";

export default function PasswordField({
  label = "Password",
  error = "",
  id,
  className = "",
  inputClassName = "",
  disabled = false,
  ...props
}) {
  const generatedId = useId();
  const inputId =
    id || `password-${generatedId.replace(/:/g, "")}`;
  const errorId = `${inputId}-error`;

  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className={cn("space-y-2", className)}>
      {label ? (
        <label
          htmlFor={inputId}
          className="block text-sm font-semibold text-[var(--foreground)]"
        >
          {label}
        </label>
      ) : null}

      <div className="relative">
        <input
          {...props}
          id={inputId}
          type={showPassword ? "text" : "password"}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            "h-12 w-full rounded-xl border bg-[var(--card)] px-4 pr-12 text-sm text-[var(--foreground)] outline-none transition",
            "placeholder:text-[var(--muted-foreground)]",
            "focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10",
            "disabled:cursor-not-allowed disabled:opacity-60",
            error
              ? "border-red-500 focus:border-red-500 focus:ring-red-500/10"
              : "border-[var(--border)]",
            inputClassName
          )}
        />

        <button
          type="button"
          onClick={() => setShowPassword((current) => !current)}
          disabled={disabled}
          aria-label={showPassword ? "Hide password" : "Show password"}
          aria-pressed={showPassword}
          className={cn(
            "absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg",
            "text-[var(--muted-foreground)] transition",
            "hover:bg-[var(--secondary)] hover:text-[var(--foreground)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600",
            "disabled:cursor-not-allowed disabled:opacity-50"
          )}
        >
          {showPassword ? (
            <EyeOff aria-hidden="true" size={18} />
          ) : (
            <Eye aria-hidden="true" size={18} />
          )}
        </button>
      </div>

      {error ? (
        <p
          id={errorId}
          role="alert"
          className="text-sm font-medium text-red-600 dark:text-red-400"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}