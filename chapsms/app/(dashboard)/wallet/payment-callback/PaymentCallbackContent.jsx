"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import {
  CheckCircle2,
  LoaderCircle,
  XCircle,
} from "lucide-react";

import { api } from "@/lib/api";
import Button from "@/components/ui/Button";

export default function PaymentCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const verificationStarted = useRef(false);

  const [status, setStatus] = useState("verifying");
  const [message, setMessage] = useState(
    "Confirming your Flutterwave payment..."
  );

  useEffect(() => {
    if (verificationStarted.current) return;

    verificationStarted.current = true;

    async function verifyPayment() {
      const flutterwaveStatus = searchParams.get("status");
      const txRef = searchParams.get("tx_ref");
      const transactionId = searchParams.get("transaction_id");

      if (flutterwaveStatus !== "successful") {
        setStatus("failed");
        setMessage("The payment was not completed successfully.");
        toast.error("Payment was not successful");
        return;
      }

      if (!txRef || !transactionId) {
        setStatus("failed");
        setMessage("Payment reference or transaction ID is missing.");
        toast.error("Invalid payment callback");
        return;
      }

      try {
        const response = await api("/payment/verify", {
          method: "POST",
          body: JSON.stringify({
            txRef,
            transactionId,
          }),
        });

        setStatus("successful");
        setMessage(
          response.message || "Your wallet has been funded successfully."
        );

        toast.success("Wallet funded successfully");

        setTimeout(() => {
          router.replace("/wallet");
          router.refresh();
        }, 2500);
      } catch (error) {
        console.error("Payment verification failed:", error);

        setStatus("failed");
        setMessage(error.message || "Payment verification failed.");

        toast.error(error.message || "Payment verification failed");
      }
    }

    verifyPayment();
  }, [router, searchParams]);

  return (
    <div className="mx-auto flex min-h-[65vh] w-full max-w-xl items-center justify-center">
      <section className="w-full rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        {status === "verifying" && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <LoaderCircle className="animate-spin" size={30} />
            </div>

            <h1 className="mt-6 text-2xl font-black text-slate-950">
              Verifying payment
            </h1>
          </>
        )}

        {status === "successful" && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-green-50 text-green-600">
              <CheckCircle2 size={32} />
            </div>

            <h1 className="mt-6 text-2xl font-black text-slate-950">
              Payment successful
            </h1>
          </>
        )}

        {status === "failed" && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <XCircle size={32} />
            </div>

            <h1 className="mt-6 text-2xl font-black text-slate-950">
              Payment failed
            </h1>
          </>
        )}

        <p className="mt-3 text-sm leading-6 text-slate-500">
          {message}
        </p>

        {status === "successful" && (
          <p className="mt-3 text-xs text-slate-400">
            Redirecting you back to your wallet...
          </p>
        )}

        {status === "failed" && (
          <Button
            type="button"
            className="mt-6 w-full"
            onClick={() => router.replace("/wallet")}
          >
            Return to Wallet
          </Button>
        )}
      </section>
    </div>
  );
}