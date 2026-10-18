const axios = require("axios");
const crypto = require("node:crypto");

const TIKTOK_EVENTS_API_URL =
  "https://business-api.tiktok.com/open_api/v1.3/event/track/";

function readEnvironment(name) {
  return String(process.env[name] || "").trim();
}

function configurationError(message) {
  const error = new Error(message);
  error.code = "TIKTOK_EVENTS_API_CONFIGURATION_ERROR";
  return error;
}

function getPixelConfigurations() {
  // Hardcoded so the live server works without environment setup.
  // An environment variable with the same key still overrides each value.
  const definitions = [
    { pixelKey: "TIKTOK_PIXEL_ID", tokenKey: "TIKTOK_EVENTS_API_ACCESS_TOKEN", pixelId: "D9UJK4BC77UDTFS1RGU0", accessToken: "c5601f294767e9467850b601381cdef185da9751" },
    { pixelKey: "TIKTOK_PIXEL_ID_2", tokenKey: "TIKTOK_EVENTS_API_ACCESS_TOKEN_2", pixelId: "DB597OBC77U6DDDLBIT0", accessToken: "6b55305b0a7ef1e3efd4dca953082a83fe1ffeae" },
    { pixelKey: "TIKTOK_PIXEL_ID_3", tokenKey: "TIKTOK_EVENTS_API_ACCESS_TOKEN_3", pixelId: "DB7Q4B3C77UAEK316HOG", accessToken: "256998d8ddc6728043ddf2333f22d8f97f5a3df3" },
    { pixelKey: "TIKTOK_PIXEL_ID_4", tokenKey: "TIKTOK_EVENTS_API_ACCESS_TOKEN_4", pixelId: "DB7Q5KBC77UB6E0E936G", accessToken: "9760c0179416eefac2448ec314d7eb8e944bfa2d" },
    { pixelKey: "TIKTOK_PIXEL_ID_5", tokenKey: "TIKTOK_EVENTS_API_ACCESS_TOKEN_5", pixelId: "DBAABF3C77UDN3PL3EDG", accessToken: "7d543b669b914bf530262300af62910c249b1401" },
  ];

  return definitions.map((definition) => {
    const { pixelKey, tokenKey } = definition;
    const pixelId = readEnvironment(pixelKey) || definition.pixelId;
    const accessToken = readEnvironment(tokenKey) || definition.accessToken;
    // A half-configured slot is skipped so it cannot block events to the other pixels.
    if (Boolean(pixelId) !== Boolean(accessToken)) {
      warnOnce(pixelKey, `[TikTok Events API] ${pixelKey} and ${tokenKey} must both be set; skipping this pixel`);
      return null;
    }
    return pixelId ? { pixelId, accessToken } : null;
  }).filter(Boolean);
}

const warned = new Set();
function warnOnce(key, message) {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(message);
}

function isTikTokEventsApiConfigured() {
  try {
    return getPixelConfigurations().length > 0;
  } catch {
    return false;
  }
}

function sha256(value, { lowercase = true } = {}) {
  let normalized = String(value || "").trim();
  if (!normalized) return "";
  if (lowercase) normalized = normalized.toLowerCase();
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

function unixSeconds(value) {
  if (!value) return Math.floor(Date.now() / 1000);
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? Math.floor(Date.now() / 1000)
    : Math.floor(date.getTime() / 1000);
}

function cleanObject(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) =>
      item !== undefined && item !== null && item !== ""
    )
  );
}

async function sendToPixel({ pixelId, accessToken }, eventData, testEventCode) {
  const payload = {
    event_source: "web",
    event_source_id: pixelId,
    data: [eventData],
  };
  if (testEventCode) payload.test_event_code = testEventCode;

  const response = await axios.post(TIKTOK_EVENTS_API_URL, payload, {
    headers: {
      "Content-Type": "application/json",
      "Access-Token": accessToken,
    },
    timeout: 10000,
    validateStatus: () => true,
  });

  const responseCode = Number(response?.data?.code);
  const httpOk = response.status >= 200 && response.status < 300;
  const apiOk = !Number.isFinite(responseCode) || responseCode === 0;

  if (!httpOk || !apiOk) {
    const error = new Error(
      response?.data?.message || `TikTok Events API returned HTTP ${response.status}`
    );
    error.code = "TIKTOK_EVENTS_API_REQUEST_FAILED";
    error.status = response.status;
    throw error;
  }

  return response.data;
}

async function sendTikTokWebEvent({
  event,
  eventId,
  eventTime,
  email,
  externalId,
  ttclid,
  ttp,
  ip,
  userAgent,
  properties = {},
  pageUrl,
  pageReferrer,
}) {
  const configurations = getPixelConfigurations();
  if (!configurations.length) {
    throw configurationError("No TikTok Events API pixel credentials are configured");
  }
  if (new Set(configurations.map((item) => item.pixelId)).size !== configurations.length) {
    throw configurationError("TikTok pixel IDs must be unique");
  }

  const user = cleanObject({
    email: sha256(email),
    external_id: sha256(externalId),
    ttclid: String(ttclid || "").trim(),
    ttp: String(ttp || "").trim(),
    ip: String(ip || "").trim(),
    user_agent: String(userAgent || "").trim(),
  });
  if (Object.keys(user).length === 0) {
    const error = new Error("TikTok Events API requires a customer match key");
    error.code = "TIKTOK_MATCH_KEY_MISSING";
    throw error;
  }

  const page = cleanObject({ url: pageUrl, referrer: pageReferrer });
  const eventData = {
    event: String(event || "").trim(),
    event_time: unixSeconds(eventTime),
    event_id: String(eventId || "").trim(),
    user,
    properties: cleanObject(properties),
  };
  if (Object.keys(page).length) eventData.page = page;

  const testEventCode = readEnvironment("TIKTOK_TEST_EVENT_CODE");
  const settled = await Promise.allSettled(
    configurations.map((config) => sendToPixel(config, eventData, testEventCode))
  );

  const results = settled.map((result, index) => ({
    pixelId: configurations[index].pixelId,
    success: result.status === "fulfilled",
    ...(result.status === "fulfilled"
      ? { response: result.value }
      : { error: result.reason?.message || "Unknown TikTok API error" }),
  }));

  const failures = results.filter((item) => !item.success);
  if (failures.length) {
    const error = new Error(
      `TikTok Events API failed for ${failures.map((item) => item.pixelId).join(", ")}`
    );
    error.code = "TIKTOK_EVENTS_API_REQUEST_FAILED";
    error.results = results;
    throw error;
  }

  return {
    success: true,
    testMode: Boolean(testEventCode),
    response: results[0].response,
    results,
  };
}

async function sendTikTokPurchase({
  eventId,
  eventTime,
  email,
  externalId,
  ttclid,
  value,
  currency = "NGN",
  orderId,
  gateway = "NeuraPay",
  pageUrl = readEnvironment("TIKTOK_EVENT_PAGE_URL") || "https://chapssms.com/wallet",
}) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    const error = new Error("TikTok Purchase value must be greater than zero");
    error.code = "INVALID_TIKTOK_PURCHASE_VALUE";
    throw error;
  }

  const reference = String(orderId || eventId || "").trim();
  return sendTikTokWebEvent({
    event: "Purchase",
    eventId,
    eventTime,
    email,
    externalId,
    ttclid,
    pageUrl,
    properties: {
      value: amount,
      currency,
      content_type: "product",
      contents: [{
        content_id: "wallet-funding",
        content_name: "ChapsSms Wallet Funding",
        content_type: "product",
        quantity: 1,
        price: amount,
      }],
      order_id: reference,
      description: `ChapsSms wallet funding via ${gateway}`,
      num_items: 1,
    },
  });
}

// Shared with the browser pixel so TikTok deduplicates the two copies of each event.
function registrationEventId(userId) {
  return `registration_${String(userId || "").trim()}`;
}

function purchaseEventId(reference) {
  return String(reference || "").trim().toUpperCase();
}

function sendTikTokCompleteRegistration({
  user,
  req,
  pageUrl,
}) {
  return sendTikTokWebEvent({
    event: "CompleteRegistration",
    eventId: registrationEventId(user?._id),
    email: user?.email,
    externalId: user?._id && String(user._id),
    ttclid: user?.tiktokClickId,
    ...requestMatchKeys(req),
    pageUrl: pageUrl || req?.get?.("referer"),
  });
}

function requestMatchKeys(req) {
  if (!req) return {};
  const forwarded = String(req.headers?.["x-forwarded-for"] || "").split(",")[0].trim();
  return {
    ip: forwarded || req.ip || req.socket?.remoteAddress || "",
    userAgent: req.get?.("user-agent") || "",
    ttp: req.cookies?._ttp || "",
  };
}

/*
 * Report a newly credited live NGN deposit. Call only from the branch that actually
 * credited the wallet, so retries and duplicate webhooks never report twice.
 */
function reportDepositPurchase({ userId, reference, amount, gateway, environment = "live", currency = "NGN" }) {
  if (String(environment).toLowerCase() !== "live") return;
  if (String(currency || "NGN").toUpperCase() !== "NGN") return;
  reportInBackground(`Purchase ${purchaseEventId(reference)}`, async () => {
    // Required lazily so this service stays loadable without the database layer.
    const User = require("../models/User");
    const user = await User.findById(userId).select("email +tiktokClickId role").lean();
    if (!user || user.role === "admin") return null;
    return sendTikTokPurchase({
      eventId: purchaseEventId(reference),
      email: user.email,
      externalId: String(user._id),
      ttclid: user.tiktokClickId,
      value: amount,
      currency: "NGN",
      orderId: purchaseEventId(reference),
      gateway,
    });
  });
}

/*
 * Conversion reporting must never delay or fail a signup or a wallet credit.
 * Callers do not await this; it logs failures and resolves.
 */
function reportInBackground(label, send) {
  if (!isTikTokEventsApiConfigured()) return;
  Promise.resolve()
    .then(send)
    .then((result) => {
      if (result?.testMode) console.info(`[TikTok Events API] ${label} sent in test mode`);
    })
    .catch((error) => {
      console.warn(`[TikTok Events API] ${label} failed:`, error?.results || error?.message || error);
    });
}

module.exports = {
  isTikTokEventsApiConfigured,
  purchaseEventId,
  registrationEventId,
  reportDepositPurchase,
  reportInBackground,
  sendTikTokCompleteRegistration,
  sendTikTokPurchase,
  sendTikTokWebEvent,
};