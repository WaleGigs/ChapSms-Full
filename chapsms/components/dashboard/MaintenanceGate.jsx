"use client";

import { useEffect, useState } from "react";
import { Wrench } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { settingsService } from "@/services/settingsService";

const RECHECK_INTERVAL_MS = 60 * 1000;

/*
 * Shows a maintenance screen to customers while the admin "Maintenance mode"
 * setting is on. The API blocks their requests either way; this just replaces
 * a dashboard full of errors with a clear notice. Admins pass through.
 */
export default function MaintenanceGate({ children }) {
  const { user } = useAuth();
  const [maintenance, setMaintenance] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const settings = await settingsService.getPublicSettings({
          forceRefresh: true,
        });

        if (!cancelled) setMaintenance(settings?.maintenanceMode === true);
      } catch {
        // Keep the last known state if the check fails.
      }
    }

    check();
    const interval = window.setInterval(check, RECHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  if (!maintenance || user?.role === "admin") {
    return children;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
      <div className="max-w-md text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
          <Wrench size={26} />
        </span>

        <h1 className="mt-5 text-2xl font-black text-[var(--foreground)]">
          We&apos;ll be right back
        </h1>

        <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">
          ChapsSmS is undergoing maintenance. Your wallet balance and orders
          are safe. This page will update automatically when we are back.
        </p>
      </div>
    </div>
  );
}
