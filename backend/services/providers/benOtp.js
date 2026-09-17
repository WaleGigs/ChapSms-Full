const axios = require("axios");
const https = require("https");
const dns = require("dns");

const PROVIDER_NAME = "benotp";

function getApiKey() {
  const apiKey = String(process.env.BENOTP_API_KEY || "").trim();

  if (!apiKey) {
    throw new Error("BENOTP_API_KEY is not configured");
  }

  return apiKey;
}

function ipv4Lookup(hostname, options, callback) {
  const lookupOptions =
    typeof options === "number"
      ? { family: options }
      : { ...options };

  dns.lookup(
    hostname,
    {
      ...lookupOptions,
      family: 4,
      all: false,
    },
    callback
  );
}

const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 10,
  maxFreeSockets: 5,
  maxCachedSessions: 0,
  minVersion: "TLSv1.2",
  rejectUnauthorized: true,
  lookup: ipv4Lookup,
});

const BENOTP_BASE_URL = String(
  process.env.BENOTP_BASE_URL ||
    "https://benotp.com/stubs/handler.php"
).trim();

const api = axios.create({
  baseURL: BENOTP_BASE_URL,
  timeout: 30000,
  httpsAgent,
  family: 4,
  headers: {
    Accept: "application/json, text/plain, */*",
    "User-Agent": "Mozilla/5.0 ChapsSmS/1.0",
  },
});

function normalizeRequired(value, fieldName) {
  const normalized = String(value || "").trim();

  if (!normalized) {
    throw new Error(`${fieldName} is required`);
  }

  return normalized;
}
function normalizeBenOtpCountry(country) {
  const value = normalizeRequired(
    country,
    "Country"
  )
    .trim()
    .toLowerCase();

  const map = {
    usa: "US",
    us: "US",
    "united states": "US",
    "united states of america": "US",

    uk: "GB",
    gb: "GB",
    "united kingdom": "GB",

    nigeria: "NG",
    ng: "NG",

    canada: "CA",
    ca: "CA",

    australia: "AU",
    au: "AU",

    france: "FR",
    fr: "FR",

    germany: "DE",
    de: "DE",
  };

  return map[value] || value.toUpperCase();
}



const POOL_CACHE_TTL_MS = Math.max(
  1000,
  Number(process.env.BENOTP_POOL_CACHE_TTL_MS || 15000)
);

const poolSelectionCache = new Map();

function normalizePreferredPool(pool, operator) {
  const explicitPool = String(pool || "").trim();

  if (explicitPool) {
    return explicitPool;
  }

  const operatorValue = String(operator || "").trim();
  const normalizedOperator = operatorValue.toLowerCase();

  if (
    operatorValue &&
    normalizedOperator !== "any" &&
    normalizedOperator !== "default" &&
    normalizedOperator !== "auto"
  ) {
    return operatorValue;
  }

  return "";
}

function getPoolCacheKey(country, service, preferredPool = "") {
  return [
    String(country || "").trim().toUpperCase(),
    String(service || "").trim().toLowerCase(),
    String(preferredPool || "").trim(),
  ].join("::");
}

function getCachedPool(country, service, preferredPool = "") {
  const key = getPoolCacheKey(
    country,
    service,
    preferredPool
  );

  const cached = poolSelectionCache.get(key);

  if (!cached) {
    return null;
  }

  if (
    Date.now() - cached.cachedAt >
    POOL_CACHE_TTL_MS
  ) {
    poolSelectionCache.delete(key);
    return null;
  }

  return cached.pool || null;
}

function cachePool(
  country,
  service,
  preferredPool,
  pool
) {
  const key = getPoolCacheKey(
    country,
    service,
    preferredPool
  );

  poolSelectionCache.set(key, {
    cachedAt: Date.now(),
    pool,
  });
}

function clearCachedPool(
  country,
  service,
  preferredPool = ""
) {
  poolSelectionCache.delete(
    getPoolCacheKey(
      country,
      service,
      preferredPool
    )
  );
}


function looksLikeHtmlResponse(contentType, responseText) {
  /*
   * BenOTP's PHP handler can return valid plain-text API responses such as
   * ACCESS_PRICE:3759.94:100 while still advertising a text/html content type.
   * Therefore the Content-Type header alone must NOT be used to classify the
   * response as HTML. Only treat the response as HTML when the body itself
   * actually starts with markup.
   */
  const text = String(responseText || "").trim();

  if (!text) {
    return false;
  }

  return /^</.test(text);
}
function getResponseText(data) {
  if (typeof data === "string") {
    return data.trim();
  }

  if (data === null || data === undefined) {
    return "";
  }

  if (typeof data === "object") {
    return JSON.stringify(data);
  }

  return String(data).trim();
}

function createProviderError(message, options = {}) {
  const error = new Error(message);

  error.provider = PROVIDER_NAME;
  error.status = options.status || 502;
  error.code = options.code || "BENOTP_ERROR";
  error.retryable = options.retryable ?? false;
  error.rawResponse = options.rawResponse;

  return error;
}

function isRetryableNetworkError(error) {
  const code = String(
    error?.code || ""
  ).toUpperCase();

  const message = String(
    error?.message || ""
  ).toLowerCase();

  const retryableCodes = new Set([
    "ECONNRESET",
    "ETIMEDOUT",
    "ECONNABORTED",
    "ECONNREFUSED",
    "EPIPE",
    "ENETUNREACH",
    "EHOSTUNREACH",
    "EAI_AGAIN",
    "ERR_NETWORK",
    "ERR_SSL_BAD_RECORD_MAC",
    "ERR_TLS_HANDSHAKE_TIMEOUT",
    "UND_ERR_CONNECT_TIMEOUT",
  ]);

  return (
    retryableCodes.has(code) ||
    message.includes("socket disconnected") ||
    message.includes("before secure tls connection") ||
    message.includes("tls handshake")
  );
}

function classifyProviderError(responseText) {
  const value = String(responseText || "").trim();
  const upper = value.toUpperCase();

  if (!value) {
    return createProviderError("BenOTP returned an empty response", {
      code: "EMPTY_RESPONSE",
      retryable: true,
    });
  }

  if (
    upper.includes("NO_NUMBERS") ||
    upper.includes("NO_NUMBER") ||
    upper.includes("NO_STOCK") ||
    upper.includes("OUT_OF_STOCK")
  ) {
    return createProviderError("No BenOTP numbers are currently available", {
      status: 409,
      code: "NO_NUMBERS",
      retryable: true,
      rawResponse: value,
    });
  }

  if (
    upper.includes("NO_BALANCE") ||
    upper.includes("INSUFFICIENT") ||
    upper.includes("NOT_ENOUGH")
  ) {
    return createProviderError("BenOTP provider balance is insufficient", {
      status: 503,
      code: "PROVIDER_BALANCE_LOW",
      retryable: true,
      rawResponse: value,
    });
  }

  if (
    upper.includes("BAD_KEY") ||
    upper.includes("INVALID_KEY") ||
    upper.includes("WRONG_API_KEY") ||
    upper.includes("UNAUTHORIZED")
  ) {
    return createProviderError("BenOTP API key is invalid", {
      status: 500,
      code: "INVALID_API_KEY",
      retryable: false,
      rawResponse: value,
    });
  }

  if (
    upper.includes("BAD_SERVICE") ||
    upper.includes("INVALID_SERVICE")
  ) {
    return createProviderError("BenOTP service is invalid", {
      status: 400,
      code: "INVALID_SERVICE",
      retryable: false,
      rawResponse: value,
    });
  }

  if (
    upper.includes("BAD_COUNTRY") ||
    upper.includes("INVALID_COUNTRY")
  ) {
    return createProviderError("BenOTP country is invalid", {
      status: 400,
      code: "INVALID_COUNTRY",
      retryable: false,
      rawResponse: value,
    });
  }

  if (
    upper.includes("BAD_POOL") ||
    upper.includes("INVALID_POOL") ||
    upper.includes("POOL_NOT_FOUND") ||
    upper.includes("POOL_UNAVAILABLE")
  ) {
    return createProviderError(
      "The selected BenOTP pool is unavailable",
      {
        status: 409,
        code: "POOL_UNAVAILABLE",
        retryable: true,
        rawResponse: value,
      }
    );
  }

  if (upper.startsWith("ERROR")) {
    return createProviderError(value, {
      status: 502,
      code: "PROVIDER_ERROR",
      retryable: true,
      rawResponse: value,
    });
  }

  return null;
}

function wait(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function request(params, options = {}) {
  const maximumAttempts =
    options.retryable === false ? 1 : 3;

  let finalError = null;

  for (
    let attempt = 1;
    attempt <= maximumAttempts;
    attempt += 1
  ) {
    try {
      if (process.env.NODE_ENV !== "production") {
        console.log("[BenOTP] outgoing request:", {
          baseURL: BENOTP_BASE_URL,
          action: params.action,
          attempt,
          params: {
            ...params,
            api_key: "***hidden***",
          },
        });
      }

      const response = await api.get("", {
        params: {
          api_key: getApiKey(),
          ...params,
        },
        family: 4,
      });

      const responseText = getResponseText(
        response.data
      );

      const contentType = String(
        response.headers?.["content-type"] || ""
      );

      if (
        looksLikeHtmlResponse(
          contentType,
          responseText
        )
      ) {
        console.error(
          "[ChapsSms server2] Unexpected HTML response:",
          {
            action: params.action,
            status: response.status,
            contentType,
            preview: responseText.slice(0, 300),
          }
        );

        throw createProviderError(
          "BenOTP returned HTML instead of API data",
          {
            status: 502,
            code: "INVALID_UPSTREAM_RESPONSE",
            retryable: true,
            rawResponse: responseText,
          }
        );
      }

      if (process.env.NODE_ENV !== "production") {
        console.log("[BenOTP] incoming response:", {
          action: params.action,
          attempt,
          status: response.status,
          contentType:
            response.headers?.["content-type"],
          data: response.data,
        });
      }

      const providerError =
        classifyProviderError(responseText);

      if (providerError) {
        throw providerError;
      }

      return {
        data: response.data,
        text: responseText,
      };
    } catch (error) {
      if (error?.provider === PROVIDER_NAME) {
        const retryableProviderError =
          options.retryable !== false &&
          Boolean(error.retryable);

        finalError = error;

        if (
          !retryableProviderError ||
          attempt === maximumAttempts
        ) {
          throw error;
        }
      } else {
        const responseText = getResponseText(
          error?.response?.data
        );

        const status = Number(
          error?.response?.status
        );

        const retryable =
          options.retryable !== false &&
          (
            isRetryableNetworkError(error) ||
            (
              Number.isFinite(status) &&
              status >= 500
            )
          );

        finalError = createProviderError(
          responseText ||
            error?.message ||
            "BenOTP request failed",
          {
            status: status || 502,
            code:
              error?.code ||
              "BENOTP_REQUEST_FAILED",
            retryable,
            rawResponse: responseText,
          }
        );

        console.error("[BenOTP] request failed:", {
          baseURL: BENOTP_BASE_URL,
          action: params.action,
          attempt,
          maximumAttempts,
          code: error?.code,
          message: error?.message,
          status: error?.response?.status,
          retryable,
        });

        if (
          !retryable ||
          attempt === maximumAttempts
        ) {
          throw finalError;
        }
      }

      const delay =
        750 * 2 ** (attempt - 1);

      await wait(delay);
    }
  }

  throw (
    finalError ||
    createProviderError(
      "BenOTP request failed",
      {
        code: "BENOTP_REQUEST_FAILED",
        retryable: true,
      }
    )
  );
}

function parseBalance(responseText) {
  const value = String(responseText || "").trim();

  /*
   * Supports likely formats such as:
   * ACCESS_BALANCE:1400
   * BALANCE:1400
   * 1400
   */
  const parts = value.split(":");
  const numericValue = Number(parts[parts.length - 1]);

  if (!Number.isFinite(numericValue)) {
    throw createProviderError(
      `Unable to parse BenOTP balance response: ${value}`,
      {
        code: "INVALID_BALANCE_RESPONSE",
        retryable: false,
        rawResponse: value,
      }
    );
  }

  return numericValue;
}

function parsePrice(responseText) {
  const value = String(responseText || "").trim();

  /*
   * Documented format:
   * ACCESS_PRICE:FINAL_PRICE:STOCK_QUANTITY
   *
   * Example:
   * ACCESS_PRICE:1021.25:50
   */
  const parts = value.split(":");

  if (parts[0]?.toUpperCase() !== "ACCESS_PRICE") {
    throw createProviderError(
      `Unexpected BenOTP price response: ${value}`,
      {
        code: "INVALID_PRICE_RESPONSE",
        retryable: false,
        rawResponse: value,
      }
    );
  }

  const price = Number(parts[1]);
  const stock = Number(parts[2]);

  if (!Number.isFinite(price) || price <= 0) {
    throw createProviderError(
      `Invalid BenOTP price response: ${value}`,
      {
        code: "INVALID_PRICE",
        retryable: false,
        rawResponse: value,
      }
    );
  }

  return {
    price,
    stock: Number.isFinite(stock) ? stock : 0,
    currency: process.env.BENOTP_CURRENCY || "NGN",
    raw: value,
  };
}

function parseSingleNumber(responseText) {
  const value = String(responseText || "").trim();

  /*
   * Documented single-number format:
   * ACCESS_NUMBER:ORDER_ID:PHONE_NUMBER
   */
  const parts = value.split(":");

  if (parts[0]?.toUpperCase() !== "ACCESS_NUMBER") {
    throw createProviderError(
      `Unexpected BenOTP number response: ${value}`,
      {
        code: "INVALID_NUMBER_RESPONSE",
        retryable: true,
        rawResponse: value,
      }
    );
  }

  const providerOrderId = String(parts[1] || "").trim();

  /*
   * Joining the remaining parts is defensive in case the provider
   * ever includes another colon-delimited component.
   */
  const phoneNumber = parts.slice(2).join(":").trim();

  if (!providerOrderId || !phoneNumber) {
    throw createProviderError(
      `BenOTP returned an incomplete number response: ${value}`,
      {
        code: "INCOMPLETE_NUMBER_RESPONSE",
        retryable: true,
        rawResponse: value,
      }
    );
  }

  return {
    provider: PROVIDER_NAME,
    providerOrderId,
    phoneNumber,
    status: "waiting",
    providerStatus: "STATUS_WAIT_CODE",
    raw: value,
  };
}

function parseBulkNumbers(responseText) {
  const value = String(responseText || "").trim();
  const parts = value.split(":");

  /*
   * Documented bulk format:
   * ACCESS_BATCH:QUANTITY:ORDER_ID1:PHONE1:ORDER_ID2:PHONE2...
   */
  if (parts[0]?.toUpperCase() !== "ACCESS_BATCH") {
    return null;
  }

  const quantity = Number(parts[1]);
  const values = parts.slice(2);
  const orders = [];

  for (let index = 0; index < values.length; index += 2) {
    const providerOrderId = String(values[index] || "").trim();
    const phoneNumber = String(values[index + 1] || "").trim();

    if (providerOrderId && phoneNumber) {
      orders.push({
        provider: PROVIDER_NAME,
        providerOrderId,
        phoneNumber,
        status: "waiting",
        providerStatus: "STATUS_WAIT_CODE",
      });
    }
  }

  if (
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    orders.length === 0
  ) {
    throw createProviderError(
      `Invalid BenOTP bulk-number response: ${value}`,
      {
        code: "INVALID_BATCH_RESPONSE",
        retryable: true,
        rawResponse: value,
      }
    );
  }

  return {
    provider: PROVIDER_NAME,
    quantity,
    orders,
    raw: value,
  };
}

function parseStatus(responseText) {
  const value = String(responseText || "").trim();
  const upper = value.toUpperCase();

  if (upper === "STATUS_WAIT_CODE") {
    return {
      provider: PROVIDER_NAME,
      status: "waiting",
      providerStatus: "STATUS_WAIT_CODE",
      otpCode: "",
      sms: "",
      raw: value,
    };
  }

  if (upper.startsWith("STATUS_OK:")) {
    const otpCode = value.slice(value.indexOf(":") + 1).trim();

    return {
      provider: PROVIDER_NAME,
      status: "received",
      providerStatus: "STATUS_OK",
      otpCode,
      sms: otpCode,
      raw: value,
    };
  }

  if (upper === "STATUS_CANCEL") {
    return {
      provider: PROVIDER_NAME,
      status: "cancelled",
      providerStatus: "STATUS_CANCEL",
      otpCode: "",
      sms: "",
      raw: value,
    };
  }

  if (upper === "NO_ACTIVATION") {
    return {
      provider: PROVIDER_NAME,
      status: "expired",
      providerStatus: "NO_ACTIVATION",
      otpCode: "",
      sms: "",
      raw: value,
    };
  }

  throw createProviderError(
    `Unexpected BenOTP status response: ${value}`,
    {
      code: "INVALID_STATUS_RESPONSE",
      retryable: true,
      rawResponse: value,
    }
  );
}

async function getBalance() {
  const response = await request(
    {
      action: "getBalance",
    },
    {
      retryable: true,
    }
  );

  return {
    provider: PROVIDER_NAME,
    balance: parseBalance(response.text),
    currency: process.env.BENOTP_CURRENCY || "NGN",
    raw: response.text,
  };
}

function parseJsonResponse(
  value,
  responseText,
  collectionName
) {
  let parsed = value;

  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      throw createProviderError(
        `Unable to parse BenOTP ${collectionName} response: ${responseText}`,
        {
          code: `INVALID_${collectionName.toUpperCase()}_RESPONSE`,
          retryable: true,
          rawResponse: responseText,
        }
      );
    }
  }

  return parsed;
}

function getCollectionSize(value) {
  if (Array.isArray(value)) {
    return value.length;
  }

  if (
    value &&
    typeof value === "object"
  ) {
    return Object.keys(value).length;
  }

  return 0;
}

function unwrapProviderCollection(
  payload,
  keys = []
) {
  const candidates = [
    ...keys.map((key) => payload?.[key]),
    ...keys.map((key) => payload?.data?.[key]),
    ...keys.map((key) => payload?.result?.[key]),
    payload?.data,
    payload?.result,
    payload?.response,
    payload,
  ];

  return (
    candidates.find(
      (candidate) =>
        getCollectionSize(candidate) > 0
    ) ?? null
  );
}

async function getServices() {
  const response = await request(
    {
      action: "getServices",
    },
    {
      retryable: true,
    }
  );

  const parsedResponse = parseJsonResponse(
    response.data,
    response.text,
    "services"
  );

  const services = unwrapProviderCollection(
    parsedResponse,
    [
      "services",
      "service",
      "serviceList",
      "items",
    ]
  );

  const serviceCount =
    getCollectionSize(services);

  if (process.env.NODE_ENV !== "production") {
    console.log(
      "[BenOTP] resolved service count:",
      serviceCount
    );
  }

  if (serviceCount === 0) {
    throw createProviderError(
      "BenOTP returned an empty services catalog",
      {
        code: "EMPTY_SERVICES_RESPONSE",
        retryable: true,
        rawResponse:
          response.text ||
          JSON.stringify(response.data),
      }
    );
  }

  return services;
}

async function getCountries() {
  const response = await request(
    {
      action: "getCountries",
    },
    {
      retryable: true,
    }
  );

  const parsedResponse = parseJsonResponse(
    response.data,
    response.text,
    "countries"
  );

  const countries = unwrapProviderCollection(
    parsedResponse,
    [
      "countries",
      "country",
      "countryList",
      "items",
    ]
  );

  const countryCount =
    getCollectionSize(countries);

  if (process.env.NODE_ENV !== "production") {
    console.log(
      "[BenOTP] resolved country count:",
      countryCount
    );
  }

  if (countryCount === 0) {
    throw createProviderError(
      "BenOTP returned an empty countries catalog",
      {
        code: "EMPTY_COUNTRIES_RESPONSE",
        retryable: true,
        rawResponse:
          response.text ||
          JSON.stringify(response.data),
      }
    );
  }

  return countries;
}


function parsePoolsResponse(
  value,
  responseText
) {
  const parsed = parseJsonResponse(
    value,
    responseText,
    "pools"
  );

  if (
    !parsed ||
    typeof parsed !== "object"
  ) {
    throw createProviderError(
      "BenOTP returned an invalid pools response",
      {
        code: "INVALID_POOLS_RESPONSE",
        retryable: true,
        rawResponse: responseText,
      }
    );
  }

  if (parsed.success === false) {
    const message = String(
      parsed.message ||
      parsed.error ||
      "Pool lookup failed"
    ).trim();

    throw createProviderError(
      message,
      {
        status: 409,
        code: "NO_NUMBERS",
        retryable: true,
        rawResponse: responseText,
      }
    );
  }

  const rawPools =
    parsed.available_pools ??
    parsed.availablePools ??
    parsed.pools ??
    parsed.data?.available_pools ??
    parsed.data?.availablePools ??
    parsed.data?.pools ??
    [];

  const values = Array.isArray(rawPools)
    ? rawPools
    : rawPools &&
      typeof rawPools === "object"
    ? Object.values(rawPools)
    : [];

  return values
    .map((item) => {
      if (
        !item ||
        typeof item !== "object"
      ) {
        return null;
      }

      const id = String(
        item.pool_id ??
        item.poolId ??
        item.id ??
        item.pool ??
        ""
      ).trim();

      if (!id) {
        return null;
      }

      const price = Number(
        item.price ??
        item.final_price ??
        item.original_price
      );

      const stock = Number(
        item.stock ??
        item.count ??
        item.quantity ??
        0
      );

      const availableValue =
        item.available;

      const available =
        availableValue === undefined ||
        availableValue === null
          ? Number.isFinite(stock)
            ? stock > 0
            : true
          : availableValue === true ||
            String(availableValue)
              .trim()
              .toLowerCase() === "true" ||
            String(availableValue).trim() === "1";

      return {
        id,
        poolId: id,
        operator: id,
        providerId: id,
        name: String(
          item.pool_name ??
          item.poolName ??
          item.name ??
          `Pool ${id}`
        ).trim(),
        price:
          Number.isFinite(price) &&
          price > 0
            ? price
            : null,
        stock:
          Number.isFinite(stock)
            ? stock
            : 0,
        available,
        raw: item,
      };
    })
    .filter(Boolean);
}

async function getPools({
  country,
  service,
} = {}) {
  const normalizedService =
    normalizeRequired(
      service,
      "Service"
    );

  const normalizedCountry =
    normalizeBenOtpCountry(
      country
    );

  const response = await request(
    {
      action: "getPools",
      country: normalizedCountry,
      service: normalizedService,
    },
    {
      retryable: true,
    }
  );

  const pools =
    parsePoolsResponse(
      response.data,
      response.text
    );

  return {
    provider: PROVIDER_NAME,
    country: normalizedCountry,
    service: normalizedService,
    pools,
    raw: response.data,
  };
}

function chooseBestPool(
  pools,
  preferredPool = ""
) {
  const availablePools =
    (Array.isArray(pools)
      ? pools
      : []
    ).filter(
      (pool) =>
        pool &&
        pool.available !== false &&
        Number(pool.stock || 0) > 0
    );

  if (preferredPool) {
    const exact = availablePools.find(
      (pool) =>
        String(pool.id) ===
        String(preferredPool)
    );

    if (!exact) {
      throw createProviderError(
        "The selected BenOTP pool is not available for this country and service",
        {
          status: 409,
          code: "POOL_UNAVAILABLE",
          retryable: true,
        }
      );
    }

    return exact;
  }

  if (!availablePools.length) {
    throw createProviderError(
      "No BenOTP numbers are currently available for this country and service",
      {
        status: 409,
        code: "NO_NUMBERS",
        retryable: true,
      }
    );
  }

  /*
   * Automatic selection:
   * 1. Prefer the pool with the most stock.
   * 2. If stock is equal, prefer the lower price.
   *
   * The selected pool is cached briefly so providerManager's
   * pre-purchase getPrice() and the following getNumber()
   * are very likely to use the same pool.
   */
  return [...availablePools].sort(
    (first, second) => {
      const stockDifference =
        Number(second.stock || 0) -
        Number(first.stock || 0);

      if (stockDifference !== 0) {
        return stockDifference;
      }

      const firstPrice =
        Number.isFinite(
          Number(first.price)
        )
          ? Number(first.price)
          : Number.POSITIVE_INFINITY;

      const secondPrice =
        Number.isFinite(
          Number(second.price)
        )
          ? Number(second.price)
          : Number.POSITIVE_INFINITY;

      return firstPrice - secondPrice;
    }
  )[0];
}

async function resolvePoolForSelection({
  country,
  service,
  pool,
  operator,
  refresh = false,
}) {
  const normalizedService =
    normalizeRequired(
      service,
      "Service"
    );

  const normalizedCountry =
    normalizeBenOtpCountry(
      country
    );

  const preferredPool =
    normalizePreferredPool(
      pool,
      operator
    );

  if (!refresh) {
    const cached =
      getCachedPool(
        normalizedCountry,
        normalizedService,
        preferredPool
      );

    if (cached) {
      return cached;
    }
  }

  const poolResponse =
    await getPools({
      country: normalizedCountry,
      service: normalizedService,
    });

  const selected =
    chooseBestPool(
      poolResponse.pools,
      preferredPool
    );

  cachePool(
    normalizedCountry,
    normalizedService,
    preferredPool,
    selected
  );

  if (
    process.env.NODE_ENV !==
    "production"
  ) {
    console.log(
      "[BenOTP] selected pool:",
      {
        country:
          normalizedCountry,
        service:
          normalizedService,
        requestedPool:
          preferredPool || "auto",
        selectedPool:
          selected.id,
        poolName:
          selected.name,
        stock:
          selected.stock,
        poolPrice:
          selected.price,
      }
    );
  }

  return selected;
}

async function getOperators({
  country,
  service,
} = {}) {
  const result =
    await getPools({
      country,
      service,
    });

  const operators =
    result.pools
      .filter(
        (pool) =>
          pool.available !== false &&
          Number(pool.stock || 0) > 0
      )
      .map((pool) => ({
        id: pool.id,
        operator: pool.id,
        providerId: pool.id,
        name: pool.name,
        price: pool.price,
        cost: pool.price,
        stock: pool.stock,
        count: pool.stock,
        currency:
          process.env.BENOTP_CURRENCY ||
          "NGN",
      }));

  return {
    provider: PROVIDER_NAME,
    country: result.country,
    service: result.service,
    currency:
      process.env.BENOTP_CURRENCY ||
      "NGN",
    operators,
    raw: result.raw,
  };
}

async function getPrice({
  service,
  country,
  areaCode,
  pool,
  operator,
}) {
  const normalizedService =
    normalizeRequired(
      service,
      "Service"
    );

  const normalizedCountry =
    normalizeBenOtpCountry(
      country
    );

  const preferredPool =
    normalizePreferredPool(
      pool,
      operator
    );

  let selectedPool =
    await resolvePoolForSelection({
      country: normalizedCountry,
      service: normalizedService,
      pool,
      operator,
    });

  try {
    const response =
      await request(
        {
          action: "getPrice",
          service:
            normalizedService,
          country:
            normalizedCountry,
          ...(areaCode
            ? {
                areacode:
                  String(
                    areaCode
                  ).trim(),
              }
            : {}),
          pool:
            selectedPool.id,
        },
        {
          retryable: true,
        }
      );

    return {
      provider:
        PROVIDER_NAME,
      service:
        normalizedService,
      country:
        normalizedCountry,
      operator:
        selectedPool.id,
      pool:
        selectedPool.id,
      poolName:
        selectedPool.name,
      ...parsePrice(
        response.text
      ),
    };
  } catch (error) {
    /*
     * Stock/pool availability can change after getPools.
     * For quote requests it is safe to refresh once and try
     * a newly selected pool. Number purchases are NOT retried.
     */
    if (
      !preferredPool &&
      (
        error?.code ===
          "NO_NUMBERS" ||
        error?.code ===
          "POOL_UNAVAILABLE"
      )
    ) {
      clearCachedPool(
        normalizedCountry,
        normalizedService,
        preferredPool
      );

      selectedPool =
        await resolvePoolForSelection({
          country:
            normalizedCountry,
          service:
            normalizedService,
          pool,
          operator,
          refresh: true,
        });

      const response =
        await request(
          {
            action:
              "getPrice",
            service:
              normalizedService,
            country:
              normalizedCountry,
            ...(areaCode
              ? {
                  areacode:
                    String(
                      areaCode
                    ).trim(),
                }
              : {}),
            pool:
              selectedPool.id,
          },
          {
            retryable: true,
          }
        );

      return {
        provider:
          PROVIDER_NAME,
        service:
          normalizedService,
        country:
          normalizedCountry,
        operator:
          selectedPool.id,
        pool:
          selectedPool.id,
        poolName:
          selectedPool.name,
        ...parsePrice(
          response.text
        ),
      };
    }

    throw error;
  }
}

async function buyNumber({
  service,
  country,
  areaCode,
  quantity = 1,
  pool,
  operator,
}) {
  const normalizedQuantity =
    Number(quantity);

  if (
    !Number.isInteger(
      normalizedQuantity
    ) ||
    normalizedQuantity < 1 ||
    normalizedQuantity > 10
  ) {
    throw createProviderError(
      "BenOTP quantity must be an integer between 1 and 10",
      {
        status: 400,
        code:
          "INVALID_QUANTITY",
        retryable: false,
      }
    );
  }

  const normalizedService =
    normalizeRequired(
      service,
      "Service"
    );

  const normalizedCountry =
    normalizeBenOtpCountry(
      country
    );

  const preferredPool =
    normalizePreferredPool(
      pool,
      operator
    );

  const selectedPool =
    await resolvePoolForSelection({
      country:
        normalizedCountry,
      service:
        normalizedService,
      pool,
      operator,
    });

  try {
    const response =
      await request(
        {
          action:
            "getNumber",
          service:
            normalizedService,
          country:
            normalizedCountry,
          quantity:
            normalizedQuantity,
          ...(areaCode
            ? {
                areacode:
                  String(
                    areaCode
                  ).trim(),
              }
            : {}),
          pool:
            selectedPool.id,
        },
        {
          /*
           * A number purchase is a mutation. Never automatically retry
           * an uncertain purchase because BenOTP may already have
           * created and charged the activation.
           */
          retryable: false,
        }
      );

    const bulkResult =
      parseBulkNumbers(
        response.text
      );

    const purchase =
      bulkResult ||
      parseSingleNumber(
        response.text
      );

    /*
     * Do not keep the pool cached after a purchase.
     * Stock changed, so the next quote should refresh soon.
     */
    clearCachedPool(
      normalizedCountry,
      normalizedService,
      preferredPool
    );

    if (bulkResult) {
      return {
        ...purchase,
        operator:
          selectedPool.id,
        pool:
          selectedPool.id,
        poolName:
          selectedPool.name,
      };
    }

    return {
      ...purchase,
      operator:
        selectedPool.id,
      pool:
        selectedPool.id,
      poolName:
        selectedPool.name,
    };
  } catch (error) {
    if (
      error?.code ===
        "NO_NUMBERS" ||
      error?.code ===
        "POOL_UNAVAILABLE"
    ) {
      clearCachedPool(
        normalizedCountry,
        normalizedService,
        preferredPool
      );
    }

    throw error;
  }
}

async function getOrder(orderId) {
  const response = await request(
    {
      action: "getStatus",
      order_id: normalizeRequired(orderId, "BenOTP order ID"),
    },
    {
      retryable: true,
    }
  );

  return {
    providerOrderId: String(orderId),
    ...parseStatus(response.text),
  };
}

async function getSms(orderId) {
  return getOrder(orderId);
}

async function cancelOrder(orderId) {
  const normalizedOrderId = normalizeRequired(
    orderId,
    "BenOTP order ID"
  );

  const response = await request(
    {
      action: "setStatus",
      order_id: normalizedOrderId,
      status: 8,
    },
    {
      /*
       * Cancellation is a mutation. Do not automatically repeat it after
       * an uncertain network failure.
       */
      retryable: false,
    }
  );

  const value = response.text.trim();
  const upper = value.toUpperCase();

  if (upper === "ACCESS_CANCEL") {
    return {
      provider: PROVIDER_NAME,
      providerOrderId: normalizedOrderId,
      status: "cancelled",
      providerStatus: "ACCESS_CANCEL",
      refundConfirmed: true,
      raw: value,
    };
  }

  if (upper === "STATUS_CANCEL") {
    return {
      provider: PROVIDER_NAME,
      providerOrderId: normalizedOrderId,
      status: "cancelled",
      providerStatus: "STATUS_CANCEL",
      refundConfirmed: true,
      raw: value,
    };
  }

  if (upper === "CANCEL_FAILED:OTP_ALREADY_RECEIVED") {
    return {
      provider: PROVIDER_NAME,
      providerOrderId: normalizedOrderId,
      status: "received",
      providerStatus: "CANCEL_FAILED:OTP_ALREADY_RECEIVED",
      refundConfirmed: false,
      raw: value,
    };
  }

  if (upper === "NO_ACTIVATION") {
    return {
      provider: PROVIDER_NAME,
      providerOrderId: normalizedOrderId,
      status: "expired",
      providerStatus: "NO_ACTIVATION",
      refundConfirmed: false,
      raw: value,
    };
  }

  throw createProviderError(
    `Unexpected BenOTP cancellation response: ${value}`,
    {
      code: "INVALID_CANCEL_RESPONSE",
      retryable: false,
      rawResponse: value,
    }
  );
}

module.exports = {
  name: PROVIDER_NAME,
  getBalance,
  getServices,
  getCountries,
  getPools,
  getOperators,
  getPrice,
  buyNumber,
  getOrder,
  getSms,
  cancelOrder,
};