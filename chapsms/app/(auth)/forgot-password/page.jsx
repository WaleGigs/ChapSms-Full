"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";

import { forgotPassword } from "@/services/auth.service";

import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();

    if (loading) return;

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      toast.error("Please enter your email address");
      return;
    }

    try {
      setLoading(true);

      const response = await forgotPassword(normalizedEmail);

      toast.success(
        response.message ||
          "If an account exists, a password reset code has been sent."
      );

      router.push(
        `/reset-password?email=${encodeURIComponent(
          normalizedEmail
        )}`
      );
    } catch (error) {
      toast.error(
        error.message || "Unable to send password reset email"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="rounded-3xl p-8 shadow-xl">
      <h1 className="text-3xl font-black text-[var(--foreground)]">
        Forgot password?
      </h1>

      <p className="mt-2 text-[var(--muted-foreground)]">
        Enter your email address and we will send you a password reset code.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-8 space-y-5"
      >
        <Input
          label="Email Address"
          name="email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          value={email}
          onChange={(e) =>
            setEmail(e.target.value)
          }
          required
        />

        <Button
          type="submit"
          className="w-full"
          size="lg"
          disabled={loading}
        >
          {loading
            ? "Sending..."
            : "Send Reset Code"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--muted-foreground)]">
        Remembered your password?{" "}
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