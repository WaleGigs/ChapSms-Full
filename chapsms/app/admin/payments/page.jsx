"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  CreditCard,
  RefreshCw,
  Search,
} from "lucide-react";

import { adminPricingService } from "@/services/adminPricingService";

function money(value) {
  return `₦${Number(value || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function dateTime(value) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function title(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) =>
      char.toUpperCase()
    );
}

const LEGACY_SERVICE_NAMES = {
  wa: "WhatsApp",
  ig: "Instagram",
  tg: "Telegram",
  fb: "Facebook",
  go: "Google",
  am: "Amazon",
  ds: "Discord",
  tt: "TikTok",
  tw: "X / Twitter",
  nf: "Netflix",
};

function serviceDisplayName(
  value,
  explicitName = ""
) {
  const friendly = String(
    explicitName || ""
  ).trim();

  if (friendly) {
    return friendly;
  }

  const raw = String(
    value || ""
  ).trim();

  if (!raw) {
    return "";
  }

  return (
    LEGACY_SERVICE_NAMES[
      raw.toLowerCase()
    ] ||
    title(raw)
  );
}

function countryDisplayName(
  value,
  explicitName = ""
) {
  const friendly = String(
    explicitName || ""
  ).trim();

  if (friendly) {
    return friendly;
  }

  const raw = String(
    value || ""
  ).trim();

  /*
   * Old provider IDs such as "58" are internal catalog identifiers,
   * not customer-facing country names. Never show them as WA-58.
   */
  if (
    !raw ||
    /^\\d+$/.test(raw)
  ) {
    return "";
  }

  return title(raw);
}

function gatewayLabel(payment) {
  const gateway = String(
    payment?.gateway || ""
  ).toLowerCase();

  const method = String(
    payment?.method || ""
  ).toLowerCase();

  if (gateway === "neurapay") {
    return "NeuraPay Bank Transfer";
  }

  if (gateway === "flutterwave") {
    return method === "card"
      ? "Flutterwave Card"
      : "Flutterwave";
  }

  if (
    payment?.type === "purchase"
  ) {
    const service =
      serviceDisplayName(
        payment?.service,
        payment?.serviceName
      );

    const country =
      countryDisplayName(
        payment?.country,
        payment?.countryName
      );

    return [
      service ||
        "Number purchase",
      country,
      payment?.server === "server1"
        ? "Server 1"
        : payment?.server === "server2"
          ? "Server 2"
          : "",
    ]
      .filter(Boolean)
      .join(" • ");
  }

  if (
    /admin/i.test(
      payment?.description || ""
    )
  ) {
    const type = String(
      payment?.type || ""
    ).toLowerCase();

    if (type === "withdraw") {
      return "Admin wallet debit";
    }

    if (type === "deposit") {
      return "Admin wallet credit";
    }

    return "Admin wallet adjustment";
  }

  return (
    title(method) ||
    title(gateway) ||
    title(payment?.type) ||
    "Wallet"
  );
}

function paymentDirection(payment) {
  const type = String(
    payment?.type || ""
  ).toLowerCase();

  if (
    type === "purchase" ||
    type === "withdraw"
  ) {
    return "debit";
  }

  if (
    type === "deposit" ||
    type === "refund"
  ) {
    return "credit";
  }

  return "neutral";
}

function signedPaymentAmount(payment) {
  const direction =
    paymentDirection(payment);

  if (direction === "debit") {
    return `-${money(payment?.amount)}`;
  }

  if (direction === "credit") {
    return `+${money(payment?.amount)}`;
  }

  return money(payment?.amount);
}

function amountClass(payment) {
  const direction =
    paymentDirection(payment);

  if (direction === "debit") {
    return "text-red-600 dark:text-red-300";
  }

  if (direction === "credit") {
    return "text-emerald-600 dark:text-emerald-300";
  }

  return "text-[var(--foreground)]";
}

function purchaseAttemptLabel(payment) {
  if (
    String(
      payment?.type || ""
    ).toLowerCase() !==
    "purchase"
  ) {
    return "";
  }

  const service =
    serviceDisplayName(
      payment?.service,
      payment?.serviceName
    );

  const country =
    countryDisplayName(
      payment?.country,
      payment?.countryName
    );

  if (service || country) {
    return [
      service ||
        "Number purchase",
      country,
    ]
      .filter(Boolean)
      .join(" · ");
  }

  const description =
    String(
      payment?.description ||
        ""
    ).trim();

  if (!description) {
    return "Number purchase";
  }

  const legacyReservation =
    description.match(
      /^Reserved for\s+(.+?)\s+\((.+?)\)\s+-\s+(server\d+)/i
    );

  const legacyCompleted =
    description.match(
      /^(.+?)\s+\((.+?)\)\s+-\s+(server\d+)$/i
    );

  const match =
    legacyReservation ||
    legacyCompleted;

  if (match) {
    const parsedService =
      serviceDisplayName(
        match[1]
      );

    const parsedCountry =
      countryDisplayName(
        match[2]
      );

    return [
      parsedService ||
        "Number purchase",
      parsedCountry,
    ]
      .filter(Boolean)
      .join(" · ");
  }

  /*
   * Last-resort legacy cleanup:
   * convert a bare "wa" to WhatsApp and never expose strings such as WA-58.
   */
  const compact =
    description.match(
      /^([a-z]{1,8})[-_](\d+)$/i
    );

  if (compact) {
    return (
      serviceDisplayName(
        compact[1]
      ) ||
      "Number purchase"
    );
  }

  return description
    .replace(
      /^Reserved for\s+/i,
      ""
    )
    .replace(
      /^Number purchase\s*-?\s*/i,
      ""
    )
    .trim();
}

function statusClass(status) {
  const value = String(
    status || ""
  ).toLowerCase();

  if (value === "completed") {
    return "bg-emerald-500/10 text-emerald-600 ring-emerald-500/30 dark:text-emerald-300";
  }

  if (value === "failed") {
    return "bg-red-500/10 text-red-600 ring-red-500/30 dark:text-red-300";
  }

  return "bg-amber-500/10 text-amber-600 ring-amber-500/30 dark:text-amber-300";
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] =
    useState([]);
  const [loading, setLoading] =
    useState(true);
  const [refreshing, setRefreshing] =
    useState(false);
  const [error, setError] =
    useState("");
  const [search, setSearch] =
    useState("");

  const load = useCallback(
    async ({ refresh = false } = {}) => {
      try {
        refresh
          ? setRefreshing(true)
          : setLoading(true);

        setError("");

        const response =
          await adminPricingService.getPayments({
            limit: 100,
          });

        setPayments(
          Array.isArray(
            response?.payments
          )
            ? response.payments
            : []
        );
      } catch (loadError) {
        console.error(
          "Admin payment history failed:",
          loadError
        );

        setError(
          loadError?.message ||
            "Unable to load payment history"
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    load();
  }, [load]);

  const filtered =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      if (!query) {
        return payments;
      }

      return payments.filter(
        (payment) =>
          [
            payment?.customer
              ?.username,
            payment?.customer
              ?.firstName,
            payment?.customer
              ?.lastName,
            payment?.customer
              ?.email,
            payment?.reference,
            payment?.transactionId,
            payment?.type,
            payment?.status,
            payment?.gateway,
            payment?.method,
            payment?.description,
            payment?.serviceName,
            payment?.countryName,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(query)
      );
    }, [payments, search]);

  return (
    <div className="mx-auto min-w-0 w-full max-w-6xl overflow-x-hidden">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white">
              <CreditCard size={20} />
            </div>

            <div>
              <h1 className="text-2xl font-black tracking-tight text-[var(--foreground)] sm:text-3xl">
                Payment History
              </h1>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                Latest real wallet activity across NeuraPay, Flutterwave, admin wallet adjustments, purchases and refunds.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() =>
            load({
              refresh: true,
            })
          }
          disabled={
            loading || refreshing
          }
          className="flex h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-4 text-sm font-bold text-[var(--foreground)] transition hover:bg-[var(--muted)] disabled:opacity-50"
        >
          <RefreshCw
            size={17}
            className={
              refreshing
                ? "animate-spin"
                : ""
            }
          />
          Refresh
        </button>
      </div>

      <section className="mt-6 overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
        <div className="border-b border-[var(--border)] p-4 sm:p-6">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
            />
            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search user, email, reference, gateway..."
              className="h-12 w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] pl-11 pr-4 text-sm font-semibold text-[var(--foreground)] outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-64 items-center justify-center text-sm font-semibold text-[var(--muted-foreground)]">
            Loading latest payments...
          </div>
        ) : error ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
            <p className="font-bold text-red-500">
              {error}
            </p>
            <button
              type="button"
              onClick={() =>
                load()
              }
              className="mt-4 rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-bold"
            >
              Try again
            </button>
          </div>
        ) : filtered.length ===
          0 ? (
          <div className="flex min-h-64 items-center justify-center text-sm font-semibold text-[var(--muted-foreground)]">
            No payment records found.
          </div>
        ) : (
          <>
            <div className="space-y-3 p-4 md:hidden">
              {filtered.map(
                (payment) => {
                  const customerName =
                    payment?.customer
                      ?.username ||
                    [
                      payment
                        ?.customer
                        ?.firstName,
                      payment
                        ?.customer
                        ?.lastName,
                    ]
                      .filter(Boolean)
                      .join(" ") ||
                    "Unknown user";

                  return (
                    <article
                      key={
                        payment.id
                      }
                      className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--muted)]/45 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-black text-[var(--foreground)]">
                            {customerName}
                          </p>
                          <p className="mt-1 truncate text-xs text-[var(--muted-foreground)]">
                            {payment
                              ?.customer
                              ?.email ||
                              "—"}
                          </p>
                        </div>

                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ring-1 ${statusClass(
                            payment.status
                          )}`}
                        >
                          {payment.status ||
                            "completed"}
                        </span>
                      </div>

                      <div className="mt-4 rounded-xl bg-[var(--background)] p-3">
                        <div className="flex items-end justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                              Method
                            </p>
                            <p className="mt-1 truncate text-sm font-bold text-[var(--foreground)]">
                              {gatewayLabel(
                                payment
                              )}
                            </p>
                          </div>

                          <p
                            className={`shrink-0 text-lg font-black ${amountClass(
                              payment
                            )}`}
                          >
                            {signedPaymentAmount(
                              payment
                            )}
                          </p>
                        </div>
                      </div>

                      {payment.type === "purchase" ? (
                        <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                            Order attempt
                          </p>
                          <p className="mt-1 break-words text-sm font-bold text-[var(--foreground)]">
                            {purchaseAttemptLabel(payment)}
                          </p>
                          {payment.status === "pending" ? (
                            <p className="mt-1 text-xs leading-5 text-amber-600 dark:text-amber-300">
                              Pending reservation. ChapsSms will reconcile it with an order or refund it automatically if the purchase was interrupted.
                            </p>
                          ) : null}
                        </div>
                      ) : null}

                      <p className="mt-3 truncate text-xs font-semibold text-[var(--muted-foreground)]">
                        {payment.reference ||
                          payment.transactionId ||
                          "—"}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                        {dateTime(
                          payment.createdAt
                        )}
                      </p>
                    </article>
                  );
                }
              )}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="border-b border-[var(--border)] bg-[var(--muted)]/40 text-xs uppercase tracking-wider text-[var(--muted-foreground)]">
                  <tr>
                    <th className="px-6 py-4">
                      User
                    </th>
                    <th className="px-6 py-4">
                      Method
                    </th>
                    <th className="px-6 py-4">
                      Reference
                    </th>
                    <th className="px-6 py-4">
                      Status
                    </th>
                    <th className="px-6 py-4 text-right">
                      Amount
                    </th>
                    <th className="px-6 py-4 text-right">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(
                    (payment) => (
                      <tr
                        key={
                          payment.id
                        }
                        className="border-b border-[var(--border)] last:border-0"
                      >
                        <td className="px-6 py-4">
                          <p className="font-black text-[var(--foreground)]">
                            {payment
                              ?.customer
                              ?.username ||
                              [
                                payment
                                  ?.customer
                                  ?.firstName,
                                payment
                                  ?.customer
                                  ?.lastName,
                              ]
                                .filter(
                                  Boolean
                                )
                                .join(
                                  " "
                                ) ||
                              "Unknown user"}
                          </p>
                          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                            {payment
                              ?.customer
                              ?.email ||
                              "—"}
                          </p>
                        </td>
                        <td className="px-6 py-4 font-semibold text-[var(--foreground)]">
                          <p>
                            {gatewayLabel(
                              payment
                            )}
                          </p>
                          {payment.type === "purchase" ? (
                            <p className="mt-1 max-w-72 break-words text-xs font-medium text-[var(--muted-foreground)]">
                              {purchaseAttemptLabel(payment)}
                            </p>
                          ) : null}
                        </td>
                        <td className="max-w-64 truncate px-6 py-4 text-xs font-semibold text-[var(--muted-foreground)]">
                          {payment.reference ||
                            payment.transactionId ||
                            "—"}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ring-1 ${statusClass(
                              payment.status
                            )}`}
                          >
                            {payment.status ||
                              "completed"}
                          </span>
                        </td>
                        <td
                          className={`px-6 py-4 text-right font-black ${amountClass(
                            payment
                          )}`}
                        >
                          {signedPaymentAmount(
                            payment
                          )}
                        </td>
                        <td className="px-6 py-4 text-right text-xs text-[var(--muted-foreground)]">
                          {dateTime(
                            payment.createdAt
                          )}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
