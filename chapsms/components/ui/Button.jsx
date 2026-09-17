"use client";

import { cn } from "@/lib/utils";

function isModifiedClick(event) {
  return (
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    event.button !== 0
  );
}

export default function Button({
  children,
  href,
  variant = "primary",
  size = "md",
  className = "",
  disabled = false,
  onClick,
  target,
  rel,
  ...props
}) {
  const base =
    "focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl font-semibold transition duration-200 active:scale-[0.98]";

  const variants = {
    primary:
      "bg-blue-600 text-white shadow-sm shadow-blue-600/20 hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-600/20",
    secondary:
      "border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] shadow-sm hover:border-blue-300 hover:bg-[var(--muted)] dark:hover:border-blue-800",
    ghost:
      "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]",
    danger:
      "bg-red-600 text-white shadow-sm hover:bg-red-700",
    white:
      "bg-white text-blue-700 shadow-lg hover:bg-blue-50",
  };

  const sizes = {
    sm: "min-h-10 px-4 py-2 text-sm",
    md: "px-5 py-3 text-sm",
    lg: "min-h-13 px-6 py-3.5 text-base sm:px-7",
  };

  const classes = cn(
    base,
    variants[variant] || variants.primary,
    sizes[size] || sizes.md,
    disabled
      ? "pointer-events-none cursor-not-allowed opacity-55"
      : "",
    className
  );

  if (href) {
    function handleAnchorClick(event) {
      if (disabled) {
        event.preventDefault();
        return;
      }

      onClick?.(event);

      if (
        event.defaultPrevented ||
        isModifiedClick(event) ||
        target === "_blank"
      ) {
        return;
      }

      if (href.startsWith("#")) {
        event.preventDefault();

        const targetElement = document.getElementById(
          decodeURIComponent(href.slice(1))
        );

        if (targetElement) {
          targetElement.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });

          window.history.replaceState(
            null,
            "",
            href
          );
        }

        return;
      }

      if (href.startsWith("/")) {
        event.preventDefault();
        window.location.assign(href);
      }
    }

    return (
      <a
        href={href}
        target={target}
        rel={rel}
        className={classes}
        onClick={handleAnchorClick}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : undefined}
        {...props}
      >
        {children}
      </a>
    );
  }

  return (
    <button
      type={props.type || "button"}
      className={classes}
      disabled={disabled}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
}
