const mongoose = require("mongoose");

const pocketfi = require("./pocketfiService");

/*
 * Which gateway customers fund their wallet with. An admin switches it at
 * runtime from Admin -> Settings.
 *
 * Only NEW funding accounts follow the switch. Both webhooks stay live, so
 * accounts issued under the previous gateway keep crediting after a change.
 *
 * Stored as its own app_settings document because platformSettingsService
 * replaces its whole value on every Save.
 */
const SETTINGS_KEY = "payment.gateway";
const CACHE_TTL_MS = 15 * 1000;

const GATEWAYS = [
  {
    id: "neurapay",
    label: "NeuraPay",
    isConfigured: () =>
      ["NEURAPAY_SECRET_KEY", "NEURAPAY_BUSINESS_ID", "NEURAPAY_WEBHOOK_SECRET"].every((name) =>
        Boolean(String(process.env[name] || "").trim()),
      ),
  },
  { id: "pocketfi", label: "PocketFi", isConfigured: pocketfi.isConfigured },
];

let cache = { wanted: "", expiresAt: 0 };

function createGatewayError(message, { code = "INVALID_PAYMENT_GATEWAY", status = 400 } = {}) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function getCollection() {
  if (!mongoose.connection?.db) {
    throw createGatewayError("Database connection is not ready", {
      code: "SETTINGS_DATABASE_NOT_READY",
      status: 503,
    });
  }

  return mongoose.connection.db.collection("app_settings");
}

function serialize({ id, label }) {
  return { id, label };
}

/* Gateways an admin can switch to: only those with keys configured. */
function listGateways() {
  return GATEWAYS.filter((gateway) => gateway.isConfigured()).map(serialize);
}

async function readWanted() {
  if (Date.now() < cache.expiresAt) {
    return cache.wanted;
  }

  try {
    const document = await getCollection().findOne({ key: SETTINGS_KEY });
    cache = {
      wanted: String(document?.value || "").trim().toLowerCase(),
      expiresAt: Date.now() + CACHE_TTL_MS,
    };
  } catch (error) {
    // Keep serving the last known choice if the database blips.
    console.error("Payment gateway load error:", error.message);
    cache.expiresAt = Date.now() + 5000;
  }

  return cache.wanted;
}

/*
 * A choice whose keys have gone falls back to the first configured gateway, so
 * funding never closes because the setting went stale. With no keys at all this
 * stays on NeuraPay, whose account request then reports the missing config.
 */
async function getActiveGateway() {
  const wanted = await readWanted();
  const available = listGateways();

  return available.find((gateway) => gateway.id === wanted) || available[0] || serialize(GATEWAYS[0]);
}

async function setActiveGateway(id, { adminId = null } = {}) {
  const value = String(id || "").trim().toLowerCase();

  if (!listGateways().some((gateway) => gateway.id === value)) {
    throw createGatewayError("That payment gateway is not configured on the server");
  }

  const now = new Date();

  await getCollection().updateOne(
    { key: SETTINGS_KEY },
    {
      $set: { value, updatedAt: now, updatedBy: adminId },
      $setOnInsert: { key: SETTINGS_KEY, createdAt: now },
    },
    { upsert: true },
  );

  cache = { wanted: value, expiresAt: Date.now() + CACHE_TTL_MS };

  return getActiveGateway();
}

module.exports = {
  listGateways,
  getActiveGateway,
  setActiveGateway,
};
