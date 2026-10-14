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
  const definitions = [
    { pixelKey: "TIKTOK_PIXEL_ID", tokenKey: "TIKTOK_EVENTS_API_ACCESS_TOKEN" },
    { pixelKey: "TIKTOK_PIXEL_ID_2", tokenKey: "TIKTOK_EVENTS_API_ACCESS_TOKEN_2" },
    { pixelKey: "TIKTOK_PIXEL_ID_3", tokenKey: "TIKTOK_EVENTS_API_ACCESS_TOKEN_3" },
    { pixelKey: "TIKTOK_PIXEL_ID_4", tokenKey: "TIKTOK_EVENTS_API_ACCESS_TOKEN_4" },
  ];

  return definitions.map(({ pixelKey, tokenKey }) => {
    const pixelId = readEnvironment(pixelKey);
    const accessToken = readEnvironment(tokenKey);
    if (Boolean(pixelId) !== Boolean(accessToken)) {
      throw configurationError(`Both ${pixelKey} and ${tokenKey} must be configured together`);
    }
    return pixelId ? { pixelId, accessToken } : null;
  }).filter(Boolean);
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
  value,
  currency = "NGN",
  orderId,
  pageUrl,
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
      description: "ChapsSms wallet funding via NeuraPay",
      num_items: 1,
    },
  });
}

module.exports = {
  isTikTokEventsApiConfigured,
  sendTikTokPurchase,
  sendTikTokWebEvent,
};