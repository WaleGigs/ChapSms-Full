"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LoaderCircle,
  Minus,
  Plus,
  RefreshCw,
  Search,
  WalletCards,
} from "lucide-react";
import toast from "react-hot-toast";

import { api } from "@/lib/api";

function formatNaira(value) {
  return `₦${Number(value || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function AdminWalletsPage() {
  const [wallets, setWallets] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");

  const loadWallets = useCallback(async () => {
    try {
      setLoading(true);

      const response = await api("/admin/wallets");

      setWallets(response.wallets || []);
    } catch (error) {
      console.error("Wallet loading failed:", error);
      toast.error(error.message || "Unable to load wallets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWallets();
  }, [loadWallets]);

  const filteredWallets = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return wallets;
    }

    return wallets.filter((wallet) => {
      const fullName = [
        wallet.user?.firstName,
        wallet.user?.lastName,
      ]
        .filter(Boolean)
        .join(" ");

      return [
        fullName,
        wallet.user?.email,
        wallet.user?.role,
        wallet.currency,
        wallet.balance,
      ].some((value) =>
        String(value || "").toLowerCase().includes(query)
      );
    });
  }, [wallets, search]);

  async function adjustWallet(wallet, type) {
    if (!wallet.user?._id) {
      toast.error("This wallet has no linked user");
      return;
    }

    const enteredAmount = window.prompt(
      type === "credit"
        ? `Enter the amount to credit ${wallet.user.firstName || "this user"}:`
        : `Enter the amount to debit from ${wallet.user.firstName || "this user"}:`
    );

    if (enteredAmount === null) return;

    const numericAmount = Number(enteredAmount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      toast.error("Enter a valid amount greater than zero");
      return;
    }

    const amount = type === "credit" ? numericAmount : -numericAmount;

    try {
      setActionLoading(wallet._id);

      const response = await api(
        `/admin/users/${wallet.user._id}/wallet`,
        {
          method: "PATCH",
          body: JSON.stringify({
            amount,
          }),
        }
      );

      setWallets((currentWallets) =>
        currentWallets.map((currentWallet) =>
          currentWallet._id === wallet._id
            ? {
                ...currentWallet,
                balance: response.balance,
                updatedAt: new Date().toISOString(),
              }
            : currentWallet
        )
      );

      toast.success(
        type === "credit"
          ? `Wallet credited. New balance: ${formatNaira(
              response.balance
            )}`
          : `Wallet debited. New balance: ${formatNaira(
              response.balance
            )}`
      );
    } catch (error) {
      console.error("Wallet adjustment failed:", error);
      toast.error(error.message || "Unable to update wallet");
    } finally {
      setActionLoading("");
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl">
      <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-950">
            Wallets
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            View and manage user wallet balances.
          </p>
        </div>

        <button
          type="button"
          onClick={loadWallets}
          disabled={loading}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw
            size={16}
            className={loading ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </div>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <div className="relative max-w-md">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search user, email or balance..."
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-72 items-center justify-center">
            <div className="text-center">
              <LoaderCircle
                className="mx-auto animate-spin text-blue-600"
                size={28}
              />

              <p className="mt-3 text-sm text-slate-500">
                Loading wallets...
              </p>
            </div>
          </div>
        ) : filteredWallets.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <WalletCards
              className="mx-auto text-slate-300"
              size={30}
            />

            <p className="mt-4 font-bold text-slate-700">
              No wallets found
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Try another search term.
            </p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left">
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">
                      User
                    </th>

                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">
                      Balance
                    </th>

                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">
                      Currency
                    </th>

                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">
                      Updated
                    </th>

                    <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-400">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredWallets.map((wallet) => {
                    const isWorking = actionLoading === wallet._id;

                    const fullName =
                      [
                        wallet.user?.firstName,
                        wallet.user?.lastName,
                      ]
                        .filter(Boolean)
                        .join(" ") || "Unknown user";

                    return (
                      <tr
                        key={wallet._id}
                        className="transition hover:bg-slate-50/70"
                      >
                        <td className="px-6 py-4">
                          <p className="font-bold text-slate-950">
                            {fullName}
                          </p>

                          <p className="mt-1 text-sm text-slate-500">
                            {wallet.user?.email || "No email"}
                          </p>
                        </td>

                        <td className="px-6 py-4">
                          <p className="text-lg font-black text-slate-950">
                            {formatNaira(wallet.balance)}
                          </p>
                        </td>

                        <td className="px-6 py-4 text-sm font-bold text-slate-600">
                          {wallet.currency || "NGN"}
                        </td>

                        <td className="px-6 py-4 text-sm font-semibold text-slate-500">
                          {formatDate(wallet.updatedAt)}
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              disabled={isWorking}
                              onClick={() =>
                                adjustWallet(wallet, "credit")
                              }
                              className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-green-50 px-3 text-sm font-bold text-green-700 transition hover:bg-green-100 disabled:opacity-50"
                            >
                              {isWorking ? (
                                <LoaderCircle
                                  className="animate-spin"
                                  size={15}
                                />
                              ) : (
                                <Plus size={15} />
                              )}
                              Credit
                            </button>

                            <button
                              type="button"
                              disabled={isWorking}
                              onClick={() =>
                                adjustWallet(wallet, "debit")
                              }
                              className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-red-50 px-3 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                            >
                              <Minus size={15} />
                              Debit
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-slate-100 md:hidden">
              {filteredWallets.map((wallet) => {
                const isWorking = actionLoading === wallet._id;

                const fullName =
                  [
                    wallet.user?.firstName,
                    wallet.user?.lastName,
                  ]
                    .filter(Boolean)
                    .join(" ") || "Unknown user";

                return (
                  <article key={wallet._id} className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-black text-slate-950">
                          {fullName}
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          {wallet.user?.email || "No email"}
                        </p>
                      </div>

                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                        <WalletCards size={18} />
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Balance
                      </p>

                      <p className="mt-2 text-2xl font-black text-slate-950">
                        {formatNaira(wallet.balance)}
                      </p>

                      <p className="mt-2 text-xs text-slate-500">
                        Updated {formatDate(wallet.updatedAt)}
                      </p>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        disabled={isWorking}
                        onClick={() =>
                          adjustWallet(wallet, "credit")
                        }
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-green-50 text-sm font-bold text-green-700 disabled:opacity-50"
                      >
                        <Plus size={16} />
                        Credit
                      </button>

                      <button
                        type="button"
                        disabled={isWorking}
                        onClick={() =>
                          adjustWallet(wallet, "debit")
                        }
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-red-50 text-sm font-bold text-red-700 disabled:opacity-50"
                      >
                        <Minus size={16} />
                        Debit
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>
    </div>
  );
}