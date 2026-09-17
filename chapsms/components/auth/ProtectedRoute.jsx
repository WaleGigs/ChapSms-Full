"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/context/AuthContext";

export default function ProtectedRoute({
  children,
}) {
  const router = useRouter();

  const {
    user,
    authLoading,
  } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [
    authLoading,
    user,
    router,
  ]);

  /*
   * CRITICAL:
   * If a successful login already put the user in AuthContext, render
   * immediately even if an older session-restore operation had not yet
   * finished. The authenticated user is the strongest signal here.
   */
  if (user) {
    return children;
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />

          <p className="mt-4 text-sm text-[var(--muted-foreground)]">
            Loading your account...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
      <div className="text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />

        <p className="mt-4 text-sm text-[var(--muted-foreground)]">
          Redirecting to login...
        </p>
      </div>
    </div>
  );
}
