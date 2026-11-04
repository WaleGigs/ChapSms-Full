const crypto = require("crypto");
const axios = require("axios");

/*
 * PocketFi (https://developer.pocketfi.ng): each customer gets one permanent
 * static bank account and PocketFi POSTs a signed webhook per inbound transfer.
 *
 * Confirmed against the live API while integrating it on DanSMS:
 * - The dashboard's PUBLIC key (352|... format) is the API bearer token. The
 *   secret key gets 401 there.
 * - Account creation returns 422 without a phone, and ChapsSms users have none,
 *   so POCKETFI_DEFAULT_PHONE is sent for every customer.
 *
 * Unlike NeuraPay there is no transaction lookup for an inbound transfer, so
 * the webhook signature is the only proof a transfer happened.
 */
const DEFAULT_BASE_URL = "https://api.pocketfi.ng/api/v1";

const BANK_LABELS = {
  kuda: "Kuda Microfinance Bank",
  paga: "Paga",
  palmpay: "PalmPay",
  nomba: "Nomba",
};

/*
 * The docs name the header HTTP_POCKETFI_SIGNATURE (PHP's spelling of a
 * "Pocketfi-Signature" header) and their Node sample reads it with underscores.
 */
const SIGNATURE_HEADERS = [
  "pocketfi-signature",
  "http_pocketfi_signature",
  "x-pocketfi-signature",
];

function readEnvironment(name) {
  return String(process.env[name] || "").trim();
}

function isConfigured() {
  return [
    "POCKETFI_PUBLIC_KEY",
    "POCKETFI_SECRET_KEY",
    "POCKETFI_BUSINESS_ID",
    "POCKETFI_DEFAULT_PHONE",
  ].every((name) => Boolean(readEnvironment(name)));
}

function createPocketFiError(message, { code = "POCKETFI_REQUEST_FAILED", status = 502 } = {}) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function splitCustomerName({ firstName, lastName, username, email }) {
  const fallback =
    String(username || "").trim() ||
    String(email || "").split("@")[0].replace(/[^a-z0-9]+/gi, " ").trim() ||
    "ChapsSms";

  return {
    first: String(firstName || "").trim() || fallback,
    last: String(lastName || "").trim() || "ChapsSms",
  };
}

async function createVirtualAccount(customer) {
  if (!isConfigured()) {
    throw createPocketFiError("PocketFi is not configured", {
      code: "POCKETFI_CONFIGURATION_ERROR",
      status: 500,
    });
  }

  const { first, last } = splitCustomerName(customer);
  const bank = (readEnvironment("POCKETFI_BANK") || "kuda").toLowerCase();
  const baseUrl = (readEnvironment("POCKETFI_BASE_URL") || DEFAULT_BASE_URL).replace(/\/+$/, "");

  let result;

  try {
    const response = await axios.post(
      `${baseUrl}/virtual-accounts/create`,
      {
        first_name: first,
        last_name: last,
        phone: readEnvironment("POCKETFI_DEFAULT_PHONE"),
        email: customer.email,
        businessId: readEnvironment("POCKETFI_BUSINESS_ID"),
        bank,
      },
      {
        timeout: 20000,
        headers: {
          Authorization: `Bearer ${readEnvironment("POCKETFI_PUBLIC_KEY")}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      },
    );

    result = response?.data;
  } catch (error) {
    const upstreamStatus = Number(error?.response?.status) || 0;

    throw createPocketFiError(
      String(
        error?.response?.data?.message ||
          error?.message ||
          "Unable to create PocketFi virtual account",
      ).trim(),
      { status: upstreamStatus >= 400 && upstreamStatus < 500 ? upstreamStatus : 502 },
    );
  }

  const account = Array.isArray(result?.banks) ? result.banks[0] : null;

  if (result?.status !== true || !account?.accountNumber) {
    throw createPocketFiError(result?.message || "PocketFi did not return a valid virtual account", {
      code: "INVALID_VIRTUAL_ACCOUNT_RESPONSE",
    });
  }

  const bankKey = String(account.bankName || bank).trim().toLowerCase();

  return {
    accountNumber: String(account.accountNumber).trim(),
    bankName: BANK_LABELS[bankKey] || String(account.bankName || bank).trim(),
    accountName: String(account.accountName || `${first} ${last}`).trim(),
    bank: bankKey,
  };
}

/*
 * hex(HMAC-SHA512(rawBody, key)). The docs say the secret key signs, but they
 * also call the bearer token the secret key, so the public key is accepted too.
 * Both are server-only credentials, so neither lets an outsider forge one.
 */
function isValidWebhookSignature(req) {
  const headers = req.headers || {};
  const signature = SIGNATURE_HEADERS.map((name) => headers[name]).find(Boolean);

  if (!signature || !req.rawBody) {
    return false;
  }

  const received = Buffer.from(String(signature).trim().toLowerCase(), "utf8");

  return [readEnvironment("POCKETFI_SECRET_KEY"), readEnvironment("POCKETFI_PUBLIC_KEY")]
    .filter(Boolean)
    .some((key) => {
      const expected = Buffer.from(
        crypto.createHmac("sha512", key).update(req.rawBody).digest("hex"),
        "utf8",
      );

      return received.length === expected.length && crypto.timingSafeEqual(received, expected);
    });
}

module.exports = {
  isConfigured,
  createVirtualAccount,
  isValidWebhookSignature,
};
