"use client";

import Link from "next/link";

import ChapsSmsLogo from "@/components/brand/ChapsSmsLogo";
import ThemeToggle from "@/components/ui/ThemeToggle";

export default function AuthNavbar() {
  return (
    <header
      className="
        fixed inset-x-0 top-0 z-[100]
        border-b border-[var(--border)]
        bg-[var(--background)]/90
        backdrop-blur-xl
      "
    >
      <nav
        className="
          mx-auto flex h-16 w-full
          max-w-7xl items-center
          justify-between px-4
          sm:h-[72px] sm:px-6
          lg:px-8
        "
      >
        <Link
          href="/"
          aria-label="ChapsSmS homepage"
          className="shrink-0"
        >
          <ChapsSmsLogo
            priority
            className="h-9 w-auto sm:h-10"
          />
        </Link>

        <ThemeToggle />
      </nav>
    </header>
  );
}