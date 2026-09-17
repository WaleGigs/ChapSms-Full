"use client";

import {
  useEffect,
  useState,
} from "react";
import {
  usePathname,
} from "next/navigation";

import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminTopbar from "@/components/admin/AdminTopbar";

export default function AdminShell({
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
      document.body.style.overflow =
        "";

      return undefined;
    }

    document.body.style.overflow =
      "hidden";

    return () => {
      document.body.style.overflow =
        "";
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

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, []);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[var(--background)] text-[var(--foreground)]">
      <div className="min-h-screen lg:grid lg:grid-cols-[250px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)]">
        <AdminSidebar
          open={sidebarOpen}
          onClose={() =>
            setSidebarOpen(false)
          }
        />

        <section className="min-w-0 pt-16">
          <AdminTopbar
            onMenuClick={() =>
              setSidebarOpen(true)
            }
          />

          <div className="mx-auto w-full max-w-[1600px] px-3 pb-10 pt-4 min-[375px]:px-4 sm:px-6 sm:pt-6 lg:px-8 xl:px-10">
            <div className="admin-theme-scope min-w-0">
              {children}
            </div>
          </div>
        </section>
      </div>

      <style jsx global>{`
        /*
         * ChapsSmS uses data-theme="dark" on <html>.
         * This compatibility layer fixes older admin pages that
         * still contain hard-coded light Tailwind utilities.
         */

        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope {
          color-scheme: dark;
        }

        /*
         * Main white/light surfaces.
         */
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          .bg-white {
          background-color: var(
            --card
          ) !important;
        }

        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          [class*="bg-white/"] {
          background-color: var(
            --card
          ) !important;
        }

        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          .bg-slate-50,
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          .bg-slate-100,
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          .bg-gray-50,
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          .bg-gray-100,
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          [class*="bg-slate-50/"],
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          [class*="bg-slate-100/"],
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          [class*="bg-gray-50/"],
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          [class*="bg-gray-100/"] {
          background-color: var(
            --muted
          ) !important;
        }

        /*
         * Search boxes / text fields / selects.
         *
         * Structural selectors are intentional. They work even if
         * a page uses bg-white, bg-slate-50/80, or a different old
         * light utility.
         */
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          input:not(
            [type="checkbox"]
          ):not(
            [type="radio"]
          ):not(
            [type="range"]
          ),
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          select,
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          textarea {
          background-color: #0b1220 !important;
          color: var(
            --foreground
          ) !important;
          border-color: var(
            --input
          ) !important;
          color-scheme: dark;
        }

        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          input::placeholder,
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          textarea::placeholder {
          color: var(
            --muted-foreground
          ) !important;
          opacity: 1;
        }

        /*
         * Table headers.
         *
         * This is the remaining large light strip visible in
         * Users, Wallets and Payments.
         */
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          thead,
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          thead
          tr,
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          thead
          th {
          background-color: #111c2e !important;
          color: var(
            --muted-foreground
          ) !important;
          border-color: var(
            --border
          ) !important;
        }

        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          table,
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          tbody,
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          tbody
          tr,
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          td {
          border-color: var(
            --border
          ) !important;
        }

        /*
         * Old light text utilities.
         */
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          .text-slate-950,
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          .text-slate-900,
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          .text-gray-950,
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          .text-gray-900 {
          color: var(
            --foreground
          ) !important;
        }

        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          .text-slate-800,
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          .text-slate-700,
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          .text-slate-600,
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          .text-slate-500,
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          .text-slate-400,
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          .text-gray-800,
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          .text-gray-700,
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          .text-gray-600,
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          .text-gray-500,
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          .text-gray-400 {
          color: var(
            --muted-foreground
          ) !important;
        }

        /*
         * Old light borders.
         */
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          .border-slate-50,
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          .border-slate-100,
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          .border-slate-200,
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          .border-slate-300,
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          .border-gray-50,
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          .border-gray-100,
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          .border-gray-200,
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          .border-gray-300 {
          border-color: var(
            --border
          ) !important;
        }

        /*
         * Neutral role/avatar pills.
         */
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          .bg-slate-200 {
          background-color: #1e293b !important;
        }

        /*
         * Success / active / credit pills.
         */
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          .bg-green-50,
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          .bg-green-100,
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          [class*="bg-green-50/"],
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          [class*="bg-green-100/"] {
          background-color: rgb(
            20 83 45 / 0.35
          ) !important;
        }

        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          .text-green-700,
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          .text-green-600 {
          color: #86efac !important;
        }

        /*
         * Failed / debit pills.
         */
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          .bg-red-50,
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          .bg-red-100,
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          [class*="bg-red-50/"],
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          [class*="bg-red-100/"] {
          background-color: rgb(
            127 29 29 / 0.35
          ) !important;
        }

        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          .text-red-700,
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          .text-red-600 {
          color: #fca5a5 !important;
        }

        /*
         * Pending pills.
         */
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          .bg-amber-50,
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          .bg-amber-100,
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          .bg-yellow-50,
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          .bg-yellow-100 {
          background-color: rgb(
            120 53 15 / 0.35
          ) !important;
        }

        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          .text-amber-700,
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          .text-amber-600,
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          .text-yellow-700,
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          .text-yellow-600 {
          color: #fcd34d !important;
        }

        /*
         * Admin / blue / purple information pills.
         */
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          .bg-blue-50,
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          .bg-blue-100 {
          background-color: rgb(
            30 64 175 / 0.3
          ) !important;
        }

        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          .bg-purple-50,
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          .bg-purple-100,
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          .bg-violet-50,
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          .bg-violet-100 {
          background-color: rgb(
            88 28 135 / 0.32
          ) !important;
        }

        /*
         * Hover states from old light-only admin pages.
         */
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          .hover\\:bg-slate-50:hover,
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          .hover\\:bg-slate-100:hover,
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          .hover\\:bg-gray-50:hover,
        :is(
            html[data-theme="dark"],
            html.dark
          )
          .admin-theme-scope
          .hover\\:bg-gray-100:hover {
          background-color: var(
            --muted
          ) !important;
        }
      `}</style>
    </main>
  );
}
