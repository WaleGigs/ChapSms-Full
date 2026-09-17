"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";

import { resetPassword } from "@/services/auth.service";

import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

export default function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialEmail = searchParams.get("email") || "";

  const [form, setForm] = useState({
    email: initialEmail,
    code: "",
    password: "",
    confirmPassword: "",
  });

  const [loading, setLoading] = useState(false);

  function updateField(e) {
    const { name, value } = e.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (loading) return;

    const email = form.email.trim().toLowerCase();

    if (
      !email ||
      !form.code ||
      !form.password ||
      !form.confirmPassword
    ) {
      toast.error("Please complete all fields");
      return;
    }

    if (form.password.length < 8) {
      toast.error(
        "Password must contain at least 8 characters"
      );
      return;
    }

    if (form.password !== form.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    try {
      setLoading(true);

      const response = await resetPassword({
        email,
        code: form.code.trim(),
        password: form.password,
        confirmPassword: form.confirmPassword,
      });

      toast.success(
        response.message ||
          "Password updated successfully"
      );

      router.replace("/login");
    } catch (error) {
      toast.error(
        error.message || "Unable to reset password"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="rounded-3xl p-8 shadow-xl">
      <h1 className="text-3xl font-black text-[var(--foreground)]">
        Reset password
      </h1>

      <p className="mt-2 text-[var(--muted-foreground)]">
        Enter the reset code that was sent to your email
        and choose a new password.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-8 space-y-5"
      >
        <Input
          label="Email Address"
          name="email"
          type="email"
          value={form.email}
          onChange={updateField}
          autoComplete="email"
          required
        />

        <Input
          label="Reset Code"
          name="code"
          placeholder="123456"
          value={form.code}
          onChange={updateField}
          required
        />

        <Input
          label="New Password"
          name="password"
          type="password"
          placeholder="New password"
          autoComplete="new-password"
          value={form.password}
          onChange={updateField}
          required
        />

        <Input
          label="Confirm Password"
          name="confirmPassword"
          type="password"
          placeholder="Confirm password"
          autoComplete="new-password"
          value={form.confirmPassword}
          onChange={updateField}
          required
        />

        <Button
          type="submit"
          className="w-full"
          size="lg"
          disabled={loading}
        >
          {loading
            ? "Updating Password..."
            : "Update Password"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--muted-foreground)]">
        Back to{" "}
        <Link
          href="/login"
          className="font-bold text-blue-600"
        >
          Login
        </Link>
      </p>
    </Card>
  );
}