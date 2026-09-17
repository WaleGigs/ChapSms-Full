"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";

import AdminShell from "@/components/admin/AdminShell";
import { useAuth } from "@/context/AuthContext";

export default function AdminLayout({ children }) {
  const router = useRouter();
  const { user, authLoading } = useAuth();

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (user.role !== "admin") {
      router.replace("/dashboard");
    }
  }, [user, authLoading, router]);

  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <LoaderCircle
            className="mx-auto animate-spin text-blue-600"
            size={30}
          />

          <p className="mt-3 text-sm font-semibold text-slate-500 dark:text-slate-300">
            Loading your account...
          </p>
        </div>
      </main>
    );
  }

  if (!user || user.role !== "admin") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <LoaderCircle
          className="animate-spin text-blue-600"
          size={30}
        />
      </main>
    );
  }

  return <AdminShell>{children}</AdminShell>;
}