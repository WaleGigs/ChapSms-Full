"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  Building2,
  Copy,
  Landmark,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Zap,
} from "lucide-react";

import Button from "@/components/ui/Button";
import { useWallet } from "@/hooks/useWallet";
import { neurapayService } from "@/services/neurapayService";
import { trackInitiateCheckout } from "@/lib/tiktokEvents";

const presetAmounts = [500, 1000, 2000, 5000, 10000, 20000];

function formatNaira(value) {
  return `₦${Number(value || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

async function copyText(value) {
  const text = String(value || "");
  if (!text) throw new Error("Nothing to copy");

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function AccountValue({ label, value, copyable = false, onCopy }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--muted)] p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
        {label}
      </p>

      <div className="mt-2 flex items-center gap-3">
        <p className="min-w-0 flex-1 break-words text-base font-black text-[var(--foreground)] sm:text-lg">
          {value || "—"}
        </p>

        {copyable && value ? (
          <button
            type="button"
            onClick={onCopy}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] transition hover:border-blue-500"
            aria-label={`Copy ${label}`}
          >
            <Copy size={17} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function WalletPage() {
  const { wallet, refreshWallet } = useWallet();

  const [amount, setAmount] = useState(5000);
  const [account, setAccount] = useState(null);
  const [accountLoading, setAccountLoading] = useState(false);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [checkingBalance, setCheckingBalance] = useState(false);
  const [neurapayLoaded, setNeurapayLoaded] = useState(false);

  const checkoutTrackedRef = useRef(new Set());
  const numericAmount = useMemo(() => Number(amount) || 0, [amount]);

  function trackCheckoutOnce(key, details) {
    if (checkoutTrackedRef.current.has(key)) return;
    checkoutTrackedRef.current.add(key);
    trackInitiateCheckout(details);
  }

  const loadNeuraPayAccount = useCallback(async () => {
    try {
      setAccountLoading(true);
      const existing = await neurapayService.getAccount({
        providerChannel: "Paga",
      });
      setAccount(existing);
      return existing;
    } catch (error) {
      console.error("NeuraPay account loading failed:", error);
      return null;
    } finally {
      setAccountLoading(false);
      setNeurapayLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!neurapayLoaded) loadNeuraPayAccount();
  }, [neurapayLoaded, loadNeuraPayAccount]);

  useEffect(() => {
    if (!account) return undefined;

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        refreshWallet().catch(() => {});
      }
    }, 12000);

    return () => window.clearInterval(interval);
  }, [account, refreshWallet]);

  useEffect(() => {
    if (!account || numericAmount < 100) return;

    trackCheckoutOnce(`neurapay:${numericAmount}`, {
      value: numericAmount,
      currency: "NGN",
      description: "ChapsSms NeuraPay bank-transfer funding started",
    });
  }, [account, numericAmount]);

  async function handleCreateNeuraPayAccount() {
    if (creatingAccount) return;

    if (!Number.isFinite(numericAmount) || numericAmount < 100) {
      toast.error("Minimum funding amount is ₦100");
      return;
    }

    try {
      setCreatingAccount(true);
      const response = await neurapayService.createAccount({
        providerChannel: "Paga",
      });

      const nextAccount = response?.account || null;
      if (!nextAccount) {
        throw new Error("ChapsSms did not receive the NeuraPay account details");
      }

      setAccount(nextAccount);

      trackCheckoutOnce(`neurapay:${numericAmount}`, {
        value: numericAmount,
        currency: "NGN",
        description: "ChapsSms NeuraPay bank-transfer funding started",
      });

      toast.success(response?.message || "NeuraPay funding account ready");
    } catch (error) {
      console.error("NeuraPay account creation failed:", error);
      toast.error(error?.message || "Unable to create your NeuraPay funding account");
    } finally {
      setCreatingAccount(false);
    }
  }

  async function handleCopy(value) {
    try {
      await copyText(value);
      toast.success("Copied");
    } catch {
      toast.error("Could not copy");
    }
  }

  async function handleCheckNeuraPayPayment() {
    if (checkingBalance) return;

    try {
      setCheckingBalance(true);
      await refreshWallet();
      toast.success("Wallet balance refreshed");
    } catch (error) {
      toast.error(error?.message || "Unable to refresh wallet");
    } finally {
      setCheckingBalance(false);
    }
  }


  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-7">
        <h1 className="text-3xl font-black tracking-tight text-[var(--foreground)]">
          Add <span className="text-blue-600">Funds</span>
        </h1>
        <p className="mt-2 text-sm text-[var(--muted-foreground)] sm:text-base">
          Fund your ChapsSms wallet securely through NeuraPay bank transfer.
        </p>
      </div>

      <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm sm:p-8">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-[var(--muted-foreground)]">
            Amount to add
          </p>
          <p className="mt-5 text-5xl font-black tracking-tight text-[var(--foreground)]">
            {numericAmount > 0 ? formatNaira(numericAmount) : "₦"}
          </p>
        </div>

        <div className="mt-8 grid grid-cols-3 gap-2.5 sm:gap-3">
          {presetAmounts.map((value) => {
            const selected = numericAmount === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setAmount(value)}
                className={`min-h-12 rounded-2xl border px-2 text-xs font-black transition sm:text-sm ${
                  selected
                    ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                    : "border-[var(--border)] bg-[var(--muted)] text-[var(--foreground)] hover:border-blue-400"
                }`}
              >
                ₦{value.toLocaleString("en-NG")}
              </button>
            );
          })}
        </div>

        <div className="mt-6">
          <label htmlFor="amount" className="mb-2 block text-sm font-bold text-[var(--foreground)]">
            Custom amount
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-black text-[var(--muted-foreground)]">
              ₦
            </span>
            <input
              id="amount"
              name="amount"
              type="number"
              min="100"
              step="1"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="Enter amount"
              className="h-16 w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] pl-10 pr-4 text-2xl font-black text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted-foreground)] focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20"
            />
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-blue-500/25 bg-blue-500/5 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
              <Landmark size={19} />
            </div>
            <div>
              <p className="font-black text-[var(--foreground)]">NeuraPay bank transfer</p>
              <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">
                Transfer <strong className="text-[var(--foreground)]">{formatNaira(numericAmount)}</strong> to the reserved account below. Your verified transfer amount is what gets credited.
              </p>
            </div>
          </div>
        </div>

        {accountLoading ? (
          <div className="mt-6 flex min-h-44 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--muted)]">
            <div className="text-center">
              <LoaderCircle size={28} className="mx-auto animate-spin text-blue-600" />
              <p className="mt-3 text-sm font-semibold text-[var(--muted-foreground)]">
                Loading your NeuraPay account...
              </p>
            </div>
          </div>
        ) : account ? (
          <div className="mt-6">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-black text-[var(--foreground)]">Your funding account</p>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  Powered by NeuraPay • {account.bankName || "Paga"}
                </p>
              </div>
              <span className="w-fit rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-600 dark:text-emerald-300">
                {String(account.status || "active").toUpperCase()}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <AccountValue label="Bank" value={account.bankName} />
              <AccountValue
                label="Account number"
                value={account.accountNumber}
                copyable
                onCopy={() => handleCopy(account.accountNumber)}
              />
              <div className="sm:col-span-2">
                <AccountValue
                  label="Account name"
                  value={account.accountName}
                  copyable
                  onCopy={() => handleCopy(account.accountName)}
                />
              </div>
            </div>

            <div className="mt-5">
              <Button
                type="button"
                className="h-14 w-full"
                onClick={handleCheckNeuraPayPayment}
                disabled={checkingBalance}
              >
                {checkingBalance ? (
                  <LoaderCircle size={19} className="animate-spin" />
                ) : (
                  <RefreshCw size={19} />
                )}
                {checkingBalance ? "Checking balance..." : "I have paid — check wallet"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--muted)] p-5 text-center">
            <Building2 size={30} className="mx-auto text-blue-600" />
            <p className="mt-3 font-black text-[var(--foreground)]">Create your personal funding account</p>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[var(--muted-foreground)]">
              ChapsSms uses NeuraPay&apos;s Paga channel for wallet funding.
            </p>

            <Button
              type="button"
              className="mt-5 h-14 w-full"
              onClick={handleCreateNeuraPayAccount}
              disabled={creatingAccount}
            >
              {creatingAccount ? (
                <LoaderCircle size={19} className="animate-spin" />
              ) : (
                <Landmark size={19} />
              )}
              {creatingAccount ? "Creating secure account..." : "Generate NeuraPay account"}
            </Button>
          </div>
        )}

        <p className="mt-6 flex items-center justify-center gap-2 text-xs text-[var(--muted-foreground)]">
          <ShieldCheck size={15} />
          Wallet credit is verified by the ChapsSms backend before your balance is updated.
        </p>
      </section>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        {[
          {
            icon: Zap,
            title: "Automatic credit",
            text: "Verified NeuraPay transfers update your ChapsSms wallet automatically.",
          },
          {
            icon: Landmark,
            title: "Bank transfer",
            text: "Fund directly through your reserved NeuraPay/Paga account.",
          },
          {
            icon: ShieldCheck,
            title: "Server verified",
            text: "The browser never decides whether a payment should credit your wallet.",
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.title}
              className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent)] text-[var(--accent-foreground)]">
                <Icon size={18} />
              </div>
              <p className="mt-4 font-black text-[var(--foreground)]">{item.title}</p>
              <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">{item.text}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 text-center shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
          Current wallet balance
        </p>
        <p className="mt-2 text-3xl font-black text-[var(--foreground)]">
          {formatNaira(wallet?.balance)}
        </p>
      </div>
    </div>
  );
}
