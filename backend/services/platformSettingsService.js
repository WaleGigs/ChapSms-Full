const mongoose = require("mongoose");

/*
 * Platform-wide admin settings live in the shared app_settings collection
 * (the same one pricingService uses) as a single document.
 */
const SETTINGS_KEY = "platform.settings";
const CACHE_TTL_MS = 15 * 1000;

/*
 * Upstream SMS activations expire after 20 minutes, so an order cannot stay
 * active longer than that. Very short windows refund numbers before the
 * provider allows cancellation.
 */
const ORDER_TIMEOUT_MIN_MINUTES = 5;
const ORDER_TIMEOUT_MAX_MINUTES = 20;

/* Flutterwave rejects tiny charges; never accept less than this. */
const MINIMUM_WALLET_FUNDING_FLOOR = 100;

const DEFAULT_SETTINGS = Object.freeze({
  platformName: "ChapsSmS",
  supportEmail: "",
  orderTimeoutMinutes: 20,
  minimumWalletFunding: 1000,
  registrationEnabled: true,
  emailVerificationRequired: true,
  maintenanceMode: false,
  orderNotificationsEnabled: true,
});

let cache = {
  settings: { ...DEFAULT_SETTINGS },
  updatedAt: null,
  updatedBy: null,
  expiresAt: 0,
};

function createSettingsError(message, { code = "INVALID_SETTINGS", status = 400 } = {}) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function getCollection() {
  if (!mongoose.connection?.db) {
    throw createSettingsError("Database connection is not ready", {
      code: "SETTINGS_DATABASE_NOT_READY",
      status: 503,
    });
  }

  return mongoose.connection.db.collection("app_settings");
}

function clampInteger(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, parsed));
}

/* Normalizes whatever is stored so a bad document can never break callers. */
function normalizeStored(value = {}) {
  const merged = { ...DEFAULT_SETTINGS, ...(value || {}) };

  return {
    platformName:
      String(merged.platformName || "").trim().slice(0, 60) ||
      DEFAULT_SETTINGS.platformName,
    supportEmail: String(merged.supportEmail || "").trim().toLowerCase(),
    orderTimeoutMinutes: clampInteger(
      merged.orderTimeoutMinutes,
      DEFAULT_SETTINGS.orderTimeoutMinutes,
      ORDER_TIMEOUT_MIN_MINUTES,
      ORDER_TIMEOUT_MAX_MINUTES,
    ),
    minimumWalletFunding: Math.max(
      MINIMUM_WALLET_FUNDING_FLOOR,
      Number(merged.minimumWalletFunding) || DEFAULT_SETTINGS.minimumWalletFunding,
    ),
    registrationEnabled: merged.registrationEnabled !== false,
    emailVerificationRequired: merged.emailVerificationRequired !== false,
    maintenanceMode: merged.maintenanceMode === true,
    orderNotificationsEnabled: merged.orderNotificationsEnabled !== false,
  };
}

/* Strict validation for admin input: reject instead of silently clamping. */
function validateInput(input = {}) {
  const platformName = String(input.platformName ?? "").trim();
  const supportEmail = String(input.supportEmail ?? "").trim().toLowerCase();
  const orderTimeoutMinutes = Number(input.orderTimeoutMinutes);
  const minimumWalletFunding = Number(input.minimumWalletFunding);

  if (!platformName || platformName.length > 60) {
    throw createSettingsError("Platform name must contain 1–60 characters");
  }

  if (supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail)) {
    throw createSettingsError("Enter a valid support email address");
  }

  if (
    !Number.isInteger(orderTimeoutMinutes) ||
    orderTimeoutMinutes < ORDER_TIMEOUT_MIN_MINUTES ||
    orderTimeoutMinutes > ORDER_TIMEOUT_MAX_MINUTES
  ) {
    throw createSettingsError(
      `Order timeout must be a whole number between ${ORDER_TIMEOUT_MIN_MINUTES} and ${ORDER_TIMEOUT_MAX_MINUTES} minutes`,
    );
  }

  if (
    !Number.isFinite(minimumWalletFunding) ||
    minimumWalletFunding < MINIMUM_WALLET_FUNDING_FLOOR
  ) {
    throw createSettingsError(
      `Minimum wallet funding must be at least ${MINIMUM_WALLET_FUNDING_FLOOR}`,
    );
  }

  const booleans = {};

  for (const field of [
    "registrationEnabled",
    "emailVerificationRequired",
    "maintenanceMode",
    "orderNotificationsEnabled",
  ]) {
    if (typeof input[field] !== "boolean") {
      throw createSettingsError(`${field} must be true or false`);
    }

    booleans[field] = input[field];
  }

  return {
    platformName,
    supportEmail,
    orderTimeoutMinutes,
    minimumWalletFunding: Math.round(minimumWalletFunding),
    ...booleans,
  };
}

function setCache(document) {
  cache = {
    settings: normalizeStored(document?.value),
    updatedAt: document?.updatedAt || null,
    updatedBy: document?.updatedBy || null,
    expiresAt: Date.now() + CACHE_TTL_MS,
  };

  return cache;
}

async function getSettings({ forceRefresh = false } = {}) {
  if (!forceRefresh && Date.now() < cache.expiresAt) {
    return cache.settings;
  }

  try {
    const document = await getCollection().findOne({ key: SETTINGS_KEY });
    return setCache(document).settings;
  } catch (error) {
    // Keep serving the last known settings if the database blips.
    console.error("Platform settings load error:", error.message);
    cache.expiresAt = Date.now() + 5000;
    return cache.settings;
  }
}

/*
 * Synchronous read of the last loaded settings, for hot paths that cannot
 * await (order expiry math). Kicks off a background refresh when stale.
 */
function getCachedSettings() {
  if (Date.now() >= cache.expiresAt) {
    getSettings().catch(() => {});
  }

  return cache.settings;
}

async function getSettingsWithMeta() {
  const settings = await getSettings({ forceRefresh: true });

  return {
    settings,
    updatedAt: cache.updatedAt,
    limits: {
      orderTimeoutMinutes: {
        min: ORDER_TIMEOUT_MIN_MINUTES,
        max: ORDER_TIMEOUT_MAX_MINUTES,
      },
      minimumWalletFunding: {
        min: MINIMUM_WALLET_FUNDING_FLOOR,
      },
    },
  };
}

async function updateSettings(input, { adminId = null } = {}) {
  const value = validateInput(input);
  const now = new Date();
  const collection = getCollection();

  await collection.updateOne(
    { key: SETTINGS_KEY },
    {
      $set: { value, updatedAt: now, updatedBy: adminId },
      $setOnInsert: { key: SETTINGS_KEY, createdAt: now },
    },
    { upsert: true },
  );

  setCache(await collection.findOne({ key: SETTINGS_KEY }));

  return getSettingsWithMeta();
}

/* The subset any visitor may read. */
async function getPublicSettings() {
  const settings = await getSettings();

  return {
    platformName: settings.platformName,
    supportEmail: settings.supportEmail,
    minimumWalletFunding: settings.minimumWalletFunding,
    orderTimeoutMinutes: settings.orderTimeoutMinutes,
    registrationEnabled: settings.registrationEnabled,
    emailVerificationRequired: settings.emailVerificationRequired,
    maintenanceMode: settings.maintenanceMode,
    orderNotificationsEnabled: settings.orderNotificationsEnabled,
  };
}

module.exports = {
  DEFAULT_SETTINGS,
  getSettings,
  getCachedSettings,
  getSettingsWithMeta,
  updateSettings,
  getPublicSettings,
};
