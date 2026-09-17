"use client";

import {
  useEffect,
  useState,
} from "react";
import {
  usePathname,
} from "next/navigation";

import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import DashboardTopbar from "@/components/dashboard/DashboardTopbar";

export default function DashboardShell({
  children,
}) {
  const pathname =
    usePathname();

  const [
    sidebarOpen,
    setSidebarOpen,
  ] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!sidebarOpen) {
      return undefined;
    }

    const previousOverflow =
      document.body.style
        .overflow;

    document.body.style.overflow =
      "hidden";

    return () => {
      document.body.style.overflow =
        previousOverflow;
    };
  }, [sidebarOpen]);

  useEffect(() => {
    function handleKeyDown(
      event,
    ) {
      if (
        event.key === "Escape"
      ) {
        setSidebarOpen(false);
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () =>
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
  }, []);

  return (
    <main className="mobile-app-scope min-h-dvh w-full overflow-x-clip bg-[var(--background)] text-[var(--foreground)]">
      <div className="min-h-dvh w-full lg:grid lg:grid-cols-[250px_minmax(0,1fr)] xl:grid-cols-[270px_minmax(0,1fr)]">
        <DashboardSidebar
          open={sidebarOpen}
          onClose={() =>
            setSidebarOpen(false)
          }
        />

        <section className="min-w-0 w-full pt-[60px] sm:pt-16">
          <DashboardTopbar
            onMenuClick={() =>
              setSidebarOpen(true)
            }
          />

          <div
            className="mx-auto w-full min-w-0 max-w-[1440px] px-3 pb-7 pt-4 min-[375px]:px-4 sm:px-6 sm:pb-10 sm:pt-6 lg:px-8 xl:px-10"
            style={{
              paddingBottom:
                "max(1.75rem, env(safe-area-inset-bottom))",
            }}
          >
            <div className="min-w-0 max-w-full">
              {children}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
