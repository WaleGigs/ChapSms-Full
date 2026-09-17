"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";

import { useAuth } from "@/context/AuthContext";

export default function AdminProtectedRoute({ children }) {
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (user && user.role !== "admin") {
      router.replace("/buy-number");
    }
  }, [router, user]);

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="mt-4 text-sm font-semibold text-[var(--muted-foreground)]">
            Verifying admin access...
          </p>
        </div>
      </div>
    );
  }

  if (user.role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
        <div className="max-w-md rounded-3xl border border-[var(--border)] bg-[var(--card)] p-8 text-center shadow-sm">
          <ShieldAlert className="mx-auto text-red-500" size={36} />
          <h1 className="mt-4 text-xl font-black text-[var(--foreground)]">
            Admin access required
          </h1>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            This section is available only to ChapsSmS administrators.
          </p>
        </div>
      </div>
    );
  }

  return children;
}