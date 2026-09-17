"use client";

import { useCallback, useEffect, useState } from "react";
import {
  LoaderCircle,
  MoreVertical,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  UserX,
  WalletCards,
  Trash2,
} from "lucide-react";
import toast from "react-hot-toast";

import { api } from "@/lib/api";

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [openMenuId, setOpenMenuId] = useState(null);

  const loadUsers = useCallback(async (searchValue = "") => {
    try {
      setLoading(true);

      const query = searchValue.trim()
        ? `?search=${encodeURIComponent(searchValue.trim())}`
        : "";

      const response = await api(`/admin/users${query}`);

      setUsers(response.users || []);
    } catch (error) {
      console.error("Users loading failed:", error);
      toast.error(error.message || "Unable to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadUsers(search);
    }, 400);

    return () => clearTimeout(timeout);
  }, [search, loadUsers]);

  async function toggleStatus(user) {
    try {
      setActionLoading(user._id);
      setOpenMenuId(null);

      const response = await api(
        `/admin/users/${user._id}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({
            suspended: !user.suspended,
          }),
        }
      );

      setUsers((currentUsers) =>
        currentUsers.map((currentUser) =>
          currentUser._id === user._id
            ? response.user
            : currentUser
        )
      );

      toast.success(
        user.suspended
          ? "User activated successfully"
          : "User suspended successfully"
      );
    } catch (error) {
      toast.error(error.message || "Unable to update user status");
    } finally {
      setActionLoading("");
    }
  }

  async function toggleRole(user) {
    const nextRole = user.role === "admin" ? "user" : "admin";

    const confirmed = window.confirm(
      nextRole === "admin"
        ? `Promote ${user.firstName} to administrator?`
        : `Remove administrator access from ${user.firstName}?`
    );

    if (!confirmed) return;

    try {
      setActionLoading(user._id);
      setOpenMenuId(null);

      const response = await api(
        `/admin/users/${user._id}/role`,
        {
          method: "PATCH",
          body: JSON.stringify({
            role: nextRole,
          }),
        }
      );

      setUsers((currentUsers) =>
        currentUsers.map((currentUser) =>
          currentUser._id === user._id
            ? response.user
            : currentUser
        )
      );

      toast.success(
        nextRole === "admin"
          ? "User promoted to admin"
          : "Admin role removed"
      );
    } catch (error) {
      toast.error(error.message || "Unable to update user role");
    } finally {
      setActionLoading("");
    }
  }

  async function adjustWallet(user, adjustmentType) {
    const enteredAmount = window.prompt(
      adjustmentType === "credit"
        ? `Enter the amount to credit ${user.firstName}'s wallet:`
        : `Enter the amount to debit from ${user.firstName}'s wallet:`
    );

    if (enteredAmount === null) return;

    const numericAmount = Number(enteredAmount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      toast.error("Enter a valid amount greater than zero");
      return;
    }

    const amount =
      adjustmentType === "credit"
        ? numericAmount
        : -numericAmount;

    try {
      setActionLoading(user._id);
      setOpenMenuId(null);

      const response = await api(
        `/admin/users/${user._id}/wallet`,
        {
          method: "PATCH",
          body: JSON.stringify({
            amount,
          }),
        }
      );

      toast.success(
        adjustmentType === "credit"
          ? `Wallet credited. New balance: ₦${Number(
              response.balance || 0
            ).toLocaleString("en-NG")}`
          : `Wallet debited. New balance: ₦${Number(
              response.balance || 0
            ).toLocaleString("en-NG")}`
      );
    } catch (error) {
      toast.error(error.message || "Unable to update wallet");
    } finally {
      setActionLoading("");
    }
  }

  async function deleteUser(user) {
    const confirmed = window.confirm(
      `Delete ${user.firstName} ${user.lastName}? This will also delete their wallet, orders, and payments.`
    );

    if (!confirmed) return;

    try {
      setActionLoading(user._id);
      setOpenMenuId(null);

      await api(`/admin/users/${user._id}`, {
        method: "DELETE",
      });

      setUsers((currentUsers) =>
        currentUsers.filter(
          (currentUser) => currentUser._id !== user._id
        )
      );

      toast.success("User deleted successfully");
    } catch (error) {
      toast.error(error.message || "Unable to delete user");
    } finally {
      setActionLoading("");
    }
  }

  function formatDate(value) {
    if (!value) return "—";

    return new Intl.DateTimeFormat("en-NG", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(value));
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-950">
            Users
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Manage registered ChapsSmS accounts.
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadUsers(search)}
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
              placeholder="Search name or email..."
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
                Loading users...
              </p>
            </div>
          </div>
        ) : users.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="font-bold text-slate-700">
              No users found
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Try another search term.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left">
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">
                      User
                    </th>

                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">
                      Role
                    </th>

                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">
                      Status
                    </th>

                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">
                      Joined
                    </th>

                    <th className="w-16 px-6 py-4" />
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {users.map((user) => {
                    const isWorking =
                      actionLoading === user._id;

                    return (
                      <tr
                        key={user._id}
                        className="transition hover:bg-slate-50/70"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-sm font-black text-blue-700">
                              {user.firstName?.[0] || "U"}
                              {user.lastName?.[0] || ""}
                            </div>

                            <div className="min-w-0">
                              <p className="truncate font-bold text-slate-950">
                                {user.firstName} {user.lastName}
                              </p>

                              <p className="truncate text-sm text-slate-500">
                                {user.email}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex rounded-full px-3 py-1.5 text-xs font-bold ${
                              user.role === "admin"
                                ? "bg-purple-50 text-purple-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {user.role === "admin"
                              ? "Admin"
                              : "User"}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex rounded-full px-3 py-1.5 text-xs font-bold ${
                              user.suspended
                                ? "bg-red-50 text-red-700"
                                : "bg-green-50 text-green-700"
                            }`}
                          >
                            {user.suspended
                              ? "Suspended"
                              : "Active"}
                          </span>
                        </td>

                        <td className="px-6 py-4 text-sm font-semibold text-slate-500 dark:text-slate-400">
                          {formatDate(user.createdAt)}
                        </td>

                        <td className="relative px-6 py-4 text-right">
                          <button
                            type="button"
                            disabled={isWorking}
                            onClick={() =>
                              setOpenMenuId((current) =>
                                current === user._id
                                  ? null
                                  : user._id
                              )
                            }
                            aria-label="Open user actions"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 disabled:opacity-50"
                          >
                            {isWorking ? (
                              <LoaderCircle
                                className="animate-spin"
                                size={17}
                              />
                            ) : (
                              <MoreVertical size={18} />
                            )}
                          </button>

                          {openMenuId === user._id && (
                            <div className="absolute right-6 top-14 z-30 w-56 rounded-2xl border border-slate-200 bg-white p-2 text-left shadow-xl">
                              <button
                                type="button"
                                onClick={() =>
                                  adjustWallet(user, "credit")
                                }
                                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                              >
                                <WalletCards size={16} />
                                Credit wallet
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  adjustWallet(user, "debit")
                                }
                                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                              >
                                <WalletCards size={16} />
                                Debit wallet
                              </button>

                              <button
                                type="button"
                                onClick={() => toggleRole(user)}
                                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                              >
                                <ShieldCheck size={16} />
                                {user.role === "admin"
                                  ? "Make regular user"
                                  : "Promote to admin"}
                              </button>

                              <button
                                type="button"
                                onClick={() => toggleStatus(user)}
                                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                              >
                                {user.suspended ? (
                                  <UserCheck size={16} />
                                ) : (
                                  <UserX size={16} />
                                )}

                                {user.suspended
                                  ? "Activate user"
                                  : "Suspend user"}
                              </button>

                              <div className="my-1 border-t border-slate-100" />

                              <button
                                type="button"
                                onClick={() => deleteUser(user)}
                                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                              >
                                <Trash2 size={16} />
                                Delete user
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="divide-y divide-slate-100 md:hidden">
              {users.map((user) => {
                const isWorking =
                  actionLoading === user._id;

                return (
                  <div key={user._id} className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-sm font-black text-blue-700">
                          {user.firstName?.[0] || "U"}
                          {user.lastName?.[0] || ""}
                        </div>

                        <div className="min-w-0">
                          <p className="truncate font-bold text-slate-950">
                            {user.firstName} {user.lastName}
                          </p>

                          <p className="truncate text-sm text-slate-500">
                            {user.email}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={isWorking}
                        onClick={() =>
                          setOpenMenuId((current) =>
                            current === user._id
                              ? null
                              : user._id
                          )
                        }
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                      >
                        {isWorking ? (
                          <LoaderCircle
                            className="animate-spin"
                            size={17}
                          />
                        ) : (
                          <MoreVertical size={18} />
                        )}
                      </button>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">
                        {user.role === "admin"
                          ? "Admin"
                          : "User"}
                      </span>

                      <span
                        className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                          user.suspended
                            ? "bg-red-50 text-red-700"
                            : "bg-green-50 text-green-700"
                        }`}
                      >
                        {user.suspended
                          ? "Suspended"
                          : "Active"}
                      </span>

                      <span className="rounded-full bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-500">
                        {formatDate(user.createdAt)}
                      </span>
                    </div>

                    {openMenuId === user._id && (
                      <div className="mt-4 grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <button
                          type="button"
                          onClick={() =>
                            adjustWallet(user, "credit")
                          }
                          className="rounded-xl bg-white px-3 py-2.5 text-left text-sm font-semibold text-slate-700"
                        >
                          Credit wallet
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            adjustWallet(user, "debit")
                          }
                          className="rounded-xl bg-white px-3 py-2.5 text-left text-sm font-semibold text-slate-700"
                        >
                          Debit wallet
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleRole(user)}
                          className="rounded-xl bg-white px-3 py-2.5 text-left text-sm font-semibold text-slate-700"
                        >
                          {user.role === "admin"
                            ? "Make regular user"
                            : "Promote to admin"}
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleStatus(user)}
                          className="rounded-xl bg-white px-3 py-2.5 text-left text-sm font-semibold text-slate-700"
                        >
                          {user.suspended
                            ? "Activate user"
                            : "Suspend user"}
                        </button>

                        <button
                          type="button"
                          onClick={() => deleteUser(user)}
                          className="rounded-xl bg-red-50 px-3 py-2.5 text-left text-sm font-semibold text-red-600"
                        >
                          Delete user
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>
    </div>
  );
}