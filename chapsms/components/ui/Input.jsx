import {
  createElement,
  isValidElement,
} from "react";

import { cn } from "@/lib/utils";

function renderIcon(icon, defaultSize = 18) {
  if (!icon) {
    return null;
  }

  /*
   * Supports both:
   * leftIcon={Mail}
   * leftIcon={<Mail size={18} />}
   *
   * Lucide icons are forwardRef component objects, so rendering
   * the object directly as {leftIcon} causes:
   * "Objects are not valid as a React child".
   */
  if (isValidElement(icon)) {
    return icon;
  }

  return createElement(icon, {
    size: defaultSize,
    "aria-hidden": true,
  });
}

export default function Input({
  label,
  id,
  name,
  leftIcon,
  rightIcon,
  error = "",
  helperText = "",
  className = "",
  wrapperClassName = "",
  disabled = false,
  ...props
}) {
  const inputId = id || name;
  const messageId = inputId
    ? `${inputId}-message`
    : undefined;

  const renderedLeftIcon =
    renderIcon(leftIcon);

  const renderedRightIcon =
    renderIcon(rightIcon);

  return (
    <div
      className={cn(
        "space-y-2",
        wrapperClassName
      )}
    >
      {label ? (
        <label
          htmlFor={inputId}
          className="block text-sm font-semibold text-[var(--foreground)]"
        >
          {label}
        </label>
      ) : null}

      <div className="relative">
        {renderedLeftIcon ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-1/2 flex -translate-y-1/2 items-center text-[var(--muted-foreground)]"
          >
            {renderedLeftIcon}
          </span>
        ) : null}

        <input
          {...props}
          id={inputId}
          name={name}
          disabled={disabled}
          aria-invalid={
            Boolean(error)
          }
          aria-describedby={
            error || helperText
              ? messageId
              : undefined
          }
          className={cn(
            "h-12 w-full rounded-xl border bg-[var(--card)] px-4 text-sm text-[var(--foreground)] outline-none transition",
            "placeholder:text-[var(--muted-foreground)]",
            "focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10",
            "disabled:cursor-not-allowed disabled:opacity-60",
            renderedLeftIcon &&
              "pl-11",
            renderedRightIcon &&
              "pr-11",
            error
              ? "border-red-500 focus:border-red-500 focus:ring-red-500/10"
              : "border-[var(--border)]",
            className
          )}
        />

        {renderedRightIcon ? (
          <span className="pointer-events-none absolute right-4 top-1/2 flex -translate-y-1/2 items-center text-[var(--muted-foreground)]">
            {renderedRightIcon}
          </span>
        ) : null}
      </div>

      {error ? (
        <p
          id={messageId}
          role="alert"
          className="text-sm font-medium text-red-600 dark:text-red-400"
        >
          {error}
        </p>
      ) : helperText ? (
        <p
          id={messageId}
          className="text-sm text-[var(--muted-foreground)]"
        >
          {helperText}
        </p>
      ) : null}
    </div>
  );
}