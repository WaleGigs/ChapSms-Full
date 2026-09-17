const axios = require("axios");
const crypto = require("node:crypto");

const TIKTOK_EVENTS_API_URL =
  "https://business-api.tiktok.com/open_api/v1.3/event/track/";

function readEnvironment(name) {
  return String(
    process.env[name] || ""
  ).trim();
}

function requireEnvironment(name) {
  const value =
    readEnvironment(name);

  if (!value) {
    const error = new Error(
      `${name} is not configured`
    );

    error.code =
      "TIKTOK_EVENTS_API_CONFIGURATION_ERROR";

    throw error;
  }

  return value;
}

function isTikTokEventsApiConfigured() {
  return Boolean(
    readEnvironment(
      "TIKTOK_PIXEL_ID"
    ) &&
      readEnvironment(
        "TIKTOK_EVENTS_API_ACCESS_TOKEN"
      )
  );
}

function sha256(value, {
  lowercase = true,
} = {}) {
  let normalized = String(
    value || ""
  ).trim();

  if (!normalized) {
    return "";
  }

  if (lowercase) {
    normalized =
      normalized.toLowerCase();
  }

  return crypto
    .createHash("sha256")
    .update(normalized)
    .digest("hex");
}

function unixSeconds(value) {
  if (!value) {
    return Math.floor(
      Date.now() / 1000
    );
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return Math.floor(
      Date.now() / 1000
    );
  }

  return Math.floor(
    date.getTime() / 1000
  );
}

function cleanObject(value) {
  return Object.fromEntries(
    Object.entries(value).filter(
      ([, item]) =>
        item !== undefined &&
        item !== null &&
        item !== ""
    )
  );
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
  const pixelId =
    requireEnvironment(
      "TIKTOK_PIXEL_ID"
    );

  const accessToken =
    requireEnvironment(
      "TIKTOK_EVENTS_API_ACCESS_TOKEN"
    );

  const hashedEmail =
    sha256(email);

  const hashedExternalId =
    sha256(externalId);

  const user = cleanObject({
    email: hashedEmail,
    external_id:
      hashedExternalId,
  });

  if (
    Object.keys(user).length === 0
  ) {
    const error = new Error(
      "TikTok Events API requires a customer match key"
    );
    error.code =
      "TIKTOK_MATCH_KEY_MISSING";
    throw error;
  }

  const page = cleanObject({
    url: pageUrl,
    referrer: pageReferrer,
  });

  const eventData = {
    event:
      String(event || "").trim(),
    event_time:
      unixSeconds(eventTime),
    event_id:
      String(eventId || "").trim(),
    user,
    properties:
      cleanObject(properties),
  };

  if (
    Object.keys(page).length > 0
  ) {
    eventData.page = page;
  }

  const payload = {
    event_source: "web",
    event_source_id:
      pixelId,
    data: [eventData],
  };

  const testEventCode =
    readEnvironment(
      "TIKTOK_TEST_EVENT_CODE"
    );

  if (testEventCode) {
    payload.test_event_code =
      testEventCode;
  }

  const response =
    await axios.post(
      TIKTOK_EVENTS_API_URL,
      payload,
      {
        headers: {
          "Content-Type":
            "application/json",
          "Access-Token":
            accessToken,
        },
        timeout: 10000,
        validateStatus: () => true,
      }
    );

  const responseCode =
    Number(
      response?.data?.code
    );

  const httpOk =
    response.status >= 200 &&
    response.status < 300;

  const apiOk =
    !Number.isFinite(
      responseCode
    ) ||
    responseCode === 0;

  if (!httpOk || !apiOk) {
    const error = new Error(
      response?.data?.message ||
        `TikTok Events API returned HTTP ${response.status}`
    );

    error.code =
      "TIKTOK_EVENTS_API_REQUEST_FAILED";
    error.status =
      response.status;

    throw error;
  }

  return {
    success: true,
    testMode:
      Boolean(testEventCode),
    response:
      response.data,
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
  const amount =
    Number(value);

  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    const error = new Error(
      "TikTok Purchase value must be greater than zero"
    );
    error.code =
      "INVALID_TIKTOK_PURCHASE_VALUE";
    throw error;
  }

  const reference =
    String(
      orderId || eventId || ""
    ).trim();

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
      contents: [
        {
          content_id:
            "wallet-funding",
          content_name:
            "ChapsSms Wallet Funding",
          content_type:
            "product",
          quantity: 1,
          price: amount,
        },
      ],
      order_id:
        reference,
      description:
        "ChapsSms wallet funding via NeuraPay",
      num_items: 1,
    },
  });
}

module.exports = {
  isTikTokEventsApiConfigured,
  sendTikTokPurchase,
  sendTikTokWebEvent,
};
