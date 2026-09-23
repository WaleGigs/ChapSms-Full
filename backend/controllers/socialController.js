const crypto = require("node:crypto");

const SocialProduct = require(
  "../models/SocialProduct"
);

const SocialOrder = require(
  "../models/SocialOrder"
);

const Wallet = require(
  "../models/Wallet"
);

const SocialCatalogRule = require(
  "../models/SocialCatalogRule"
);

const HouseStockItem = require(
  "../models/HouseStockItem"
);

const socialPricingService = require(
  "../services/socialPricingService"
);

const PROVIDERS = {
  SAMEEHA: "sameeha",
  LOGGSPLUG: "loggsplug",
  HOUSE: "house",
};

/*
 * Temporary provider switch.
 * Keep LoggsPlug integration in the codebase, but do not expose,
 * refresh, or purchase from it unless explicitly re-enabled.
 */
const ENABLE_LOGGSPLUG =
  String(
    process.env.ENABLE_LOGGSPLUG ||
      "false"
  )
    .trim()
    .toLowerCase() === "true";

function getEnabledExternalProviders() {
  return ENABLE_LOGGSPLUG
    ? [
        PROVIDERS.SAMEEHA,
        PROVIDERS.LOGGSPLUG,
      ]
    : [PROVIDERS.SAMEEHA];
}

function isCustomerProviderEnabled(
  provider
) {
  return getEnabledExternalProviders()
    .includes(
      String(provider || "")
        .trim()
        .toLowerCase()
    );
}

const DEFAULT_CATALOG_TTL_MS =
  60 * 1000;

const DEFAULT_REQUEST_TIMEOUT_MS =
  20 * 1000;

/* =========================================================
   BASIC HELPERS
========================================================= */

function normalizeText(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}


function humanizeCredentialKey(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function credentialToText(
  value,
  {
    prefix = "",
    depth = 0,
    seen = new WeakSet(),
  } = {}
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    const primitive =
      String(value).trim();

    if (
      !primitive ||
      primitive ===
        "[object Object]"
    ) {
      return "";
    }

    return prefix
      ? `${prefix}: ${primitive}`
      : primitive;
  }

  if (depth > 6) {
    return "";
  }

  if (Array.isArray(value)) {
    return value
      .map((item) =>
        credentialToText(
          item,
          {
            prefix: "",
            depth: depth + 1,
            seen,
          }
        )
      )
      .filter(Boolean)
      .join("\n");
  }

  if (
    typeof value === "object"
  ) {
    if (seen.has(value)) {
      return "";
    }

    seen.add(value);

    const containerKeys =
      new Set([
        "details",
        "detail",
        "credential",
        "credentials",
        "account",
        "accounts",
        "login",
        "data",
        "items",
        "keys",
        "delivered",
        "result",
        "value",
      ]);

    const ignoredKeys =
      new Set([
        "id",
        "_id",
        "order_id",
        "orderid",
        "product_id",
        "productid",
        "status",
        "success",
        "charged",
        "charge",
        "price",
        "cost",
      ]);

    const lines = [];

    for (
      const [rawKey, rawValue]
      of Object.entries(value)
    ) {
      const normalizedKey =
        String(rawKey || "")
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, "");

      if (
        ignoredKeys.has(
          normalizedKey
        )
      ) {
        continue;
      }

      if (
        rawValue === null ||
        rawValue === undefined ||
        rawValue === ""
      ) {
        continue;
      }

      const nested =
        credentialToText(
          rawValue,
          {
            prefix:
              containerKeys.has(
                normalizedKey
              )
                ? ""
                : humanizeCredentialKey(
                    rawKey
                  ),
            depth: depth + 1,
            seen,
          }
        );

      if (nested) {
        lines.push(nested);
      }
    }

    return lines.join("\n");
  }

  return "";
}

function normalizeCredentialCollection(
  value
) {
  const source =
    Array.isArray(value)
      ? value
      : value === null ||
          value === undefined
        ? []
        : [value];

  return source
    .map((item) =>
      credentialToText(item)
    )
    .filter(Boolean);
}

function extractDeliveredItems(
  providerResponse
) {
  if (!providerResponse) {
    return [];
  }

  const candidates = [
    providerResponse?.keys,
    providerResponse?.delivered,
    providerResponse?.credentials,
    providerResponse?.accounts,
    providerResponse?.account,
    providerResponse?.details,

    providerResponse?.data?.keys,
    providerResponse?.data?.delivered,
    providerResponse?.data?.credentials,
    providerResponse?.data?.accounts,
    providerResponse?.data?.account,
    providerResponse?.data?.details,

    providerResponse?.result?.keys,
    providerResponse?.result?.delivered,
    providerResponse?.result?.credentials,
    providerResponse?.result?.accounts,
    providerResponse?.result?.account,
    providerResponse?.result?.details,
  ];

  for (const candidate of candidates) {
    const normalized =
      normalizeCredentialCollection(
        candidate
      );

    if (normalized.length > 0) {
      return normalized;
    }
  }

  return [];
}

function getReadableDeliveredItems(
  storedItems,
  providerResponse
) {
  const stored =
    normalizeCredentialCollection(
      storedItems
    );

  const storedHasPlaceholder =
    (
      Array.isArray(storedItems)
        ? storedItems
        : []
    ).some(
      (item) =>
        String(item || "")
          .trim() ===
        "[object Object]"
    );

  if (
    stored.length > 0 &&
    !storedHasPlaceholder
  ) {
    return stored;
  }

  const recovered =
    extractDeliveredItems(
      providerResponse
    );

  return recovered.length > 0
    ? recovered
    : stored;
}

function slugify(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function productVisibilityRuleKey(
  provider,
  providerProductId
) {
  return `product:${String(
    provider || ""
  )
    .trim()
    .toLowerCase()}:${String(
    providerProductId || ""
  ).trim()}`;
}

function categoryVisibilityRuleKey(
  provider,
  category
) {
  return `category:${String(
    provider || ""
  )
    .trim()
    .toLowerCase()}:${slugify(
    category
  )}`;
}

async function loadHiddenSocialRuleKeys() {
  const rules =
    await SocialCatalogRule
      .find({
        hidden: true,
      })
      .select("ruleKey")
      .lean();

  return new Set(
    rules.map(
      (rule) =>
        String(
          rule.ruleKey || ""
        )
    )
  );
}

function isProviderCandidateHidden(
  candidate,
  category,
  hiddenRuleKeys
) {
  if (
    !candidate ||
    !hiddenRuleKeys
  ) {
    return false;
  }

  return (
    hiddenRuleKeys.has(
      categoryVisibilityRuleKey(
        candidate.provider,
        category
      )
    ) ||
    hiddenRuleKeys.has(
      productVisibilityRuleKey(
        candidate.provider,
        candidate
          .providerProductId
      )
    )
  );
}

function buildCatalogKey(
  category,
  name
) {
  return `${slugify(
    category
  )}::${slugify(name)}`;
}

function positiveNumber(
  value,
  fallback = 0
) {
  const parsed = Number(value);

  return Number.isFinite(parsed) &&
    parsed >= 0
    ? parsed
    : fallback;
}

function positiveInteger(
  value,
  fallback = 1
) {
  const parsed = Number.parseInt(
    value,
    10
  );

  return Number.isFinite(parsed) &&
    parsed > 0
    ? parsed
    : fallback;
}

function normalizeCurrency(
  value
) {
  return String(
    value || "NGN"
  )
    .trim()
    .toUpperCase();
}

function getCatalogTtlMs() {
  const configured = Number(
    process.env
      .SOCIAL_CATALOG_TTL_MS
  );

  return Number.isFinite(
    configured
  ) &&
    configured >= 10_000
    ? configured
    : DEFAULT_CATALOG_TTL_MS;
}

function getMaxQuantity() {
  const configured =
    Number.parseInt(
      process.env
        .SOCIAL_MAX_QUANTITY,
      10
    );

  return Number.isFinite(
    configured
  ) &&
    configured > 0
    ? Math.min(
        configured,
        10000
      )
    : 100;
}

/* =========================================================
   PRICING
========================================================= */

function convertToNgn(
  amount,
  currency
) {
  const numericAmount =
    Number(amount);

  if (
    !Number.isFinite(
      numericAmount
    ) ||
    numericAmount < 0
  ) {
    throw new Error(
      "Invalid provider price"
    );
  }

  const normalizedCurrency =
    normalizeCurrency(currency);

  if (
    normalizedCurrency === "NGN"
  ) {
    return numericAmount;
  }

  if (
    normalizedCurrency === "USD"
  ) {
    const rate = Number(
      process.env
        .SOCIAL_USD_TO_NGN_RATE
    );

    if (
      !Number.isFinite(rate) ||
      rate <= 0
    ) {
      const error =
        new Error(
          "SOCIAL_USD_TO_NGN_RATE is not configured"
        );

      error.code =
        "SOCIAL_EXCHANGE_RATE_MISSING";

      throw error;
    }

    return numericAmount * rate;
  }

  const error =
    new Error(
      `Unsupported social provider currency: ${normalizedCurrency}`
    );

  error.code =
    "UNSUPPORTED_SOCIAL_CURRENCY";

  throw error;
}

function calculateSellingPrice(
  providerCostNgn
) {
  const cost =
    Number(providerCostNgn);

  if (
    !Number.isFinite(cost) ||
    cost < 0
  ) {
    throw new Error(
      "Invalid provider cost"
    );
  }

  const markupPercent =
    Number(
      process.env
        .SOCIAL_MARKUP_PERCENT ||
        0
    );

  const fixedMarkup =
    Number(
      process.env
        .SOCIAL_FIXED_MARKUP_NGN ||
        0
    );

  const safePercent =
    Number.isFinite(
      markupPercent
    )
      ? Math.max(
          0,
          markupPercent
        )
      : 0;

  const safeFixed =
    Number.isFinite(fixedMarkup)
      ? Math.max(
          0,
          fixedMarkup
        )
      : 0;

  const sellingPrice =
    cost +
    cost *
      (safePercent / 100) +
    safeFixed;

  /*
   * Naira customer price.
   */
  return Math.ceil(
    sellingPrice
  );
}

/* =========================================================
   PROVIDER CONFIGURATION
========================================================= */

function getSameehaConfig() {
  return {
    baseUrl: String(
      process.env
        .SAMEEHA_API_BASE_URL ||
        "https://sameehasocialhub.com/api/v1"
    ).replace(/\/+$/, ""),

    apiKey: String(
      process.env
        .SAMEEHA_API_KEY ||
        ""
    ).trim(),

    currency:
      normalizeCurrency(
        process.env
          .SAMEEHA_CURRENCY ||
          "NGN"
      ),
  };
}

function getLoggsplugConfig() {
  return {
    baseUrl: String(
      process.env
        .LOGGSPLUG_API_BASE_URL ||
        "https://loggsplug.online/api/reseller"
    ).replace(/\/+$/, ""),

    apiKey: String(
      process.env
        .LOGGSPLUG_API_KEY ||
        ""
    ).trim(),

    currency:
      normalizeCurrency(
        process.env
          .LOGGSPLUG_CURRENCY ||
          "NGN"
      ),
  };
}

function assertProviderKeys() {
  const sameeha =
    getSameehaConfig();

  const loggsplug =
    getLoggsplugConfig();

  if (!sameeha.apiKey) {
    throw new Error(
      "SAMEEHA_API_KEY is missing"
    );
  }

  if (!loggsplug.apiKey) {
    throw new Error(
      "LOGGSPLUG_API_KEY is missing"
    );
  }
}

/* =========================================================
   HTTP CLIENT
========================================================= */

async function providerRequest(
  url,
  {
    method = "GET",
    headers = {},
    body = undefined,
    timeoutMs =
      DEFAULT_REQUEST_TIMEOUT_MS,
  } = {}
) {
  const controller =
    new AbortController();

  const timeout =
    setTimeout(() => {
      controller.abort();
    }, timeoutMs);

  const upperMethod =
    String(method).toUpperCase();

  try {
    const response =
      await fetch(url, {
        method: upperMethod,

        headers: {
          Accept:
            "application/json",

          ...(body !==
          undefined
            ? {
                "Content-Type":
                  "application/json",
              }
            : {}),

          ...headers,
        },

        body:
          body === undefined
            ? undefined
            : JSON.stringify(
                body
              ),

        signal:
          controller.signal,
      });

    const raw =
      await response.text();

    let data = {};

    if (raw) {
      try {
        data =
          JSON.parse(raw);
      } catch {
        data = {
          raw,
        };
      }
    }

    if (!response.ok) {
      const providerMessage =
        normalizeText(
          data?.detail ||
            data?.message ||
            data?.error ||
            `Provider returned HTTP ${response.status}`
        );

      const error =
        new Error(
          providerMessage ||
            "Provider request failed"
        );

      error.providerHttpStatus =
        response.status;

      error.providerCode =
        normalizeText(
          data?.error ||
            data?.code ||
            ""
        );

      /*
       * A 4xx response confirms that
       * this request was rejected.
       *
       * A network failure/5xx after POST
       * is treated as uncertain because
       * the provider could have created
       * the order before the connection
       * failed.
       */
      error.definitiveNoPurchase =
        upperMethod !== "POST" ||
        (
          response.status >=
            400 &&
          response.status <
            500
        );

      throw error;
    }

    return data;
  } catch (error) {
    if (
      error?.name ===
      "AbortError"
    ) {
      const timeoutError =
        new Error(
          "Social provider request timed out"
        );

      timeoutError.code =
        "SOCIAL_PROVIDER_TIMEOUT";

      timeoutError
        .definitiveNoPurchase =
        upperMethod !== "POST";

      throw timeoutError;
    }

    if (
      error
        ?.definitiveNoPurchase !==
      undefined
    ) {
      throw error;
    }

    /*
     * Network error.
     * GET is safe.
     * POST is uncertain.
     */
    error.definitiveNoPurchase =
      upperMethod !== "POST";

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/* =========================================================
   SAMEEHA
========================================================= */

async function getSameehaCategories() {
  const config =
    getSameehaConfig();

  const response =
    await providerRequest(
      `${config.baseUrl}/categories`,
      {
        headers: {
          Authorization:
            `Bearer ${config.apiKey}`,
        },
      }
    );

  const results =
    Array.isArray(
      response?.results
    )
      ? response.results
      : [];

  return new Map(
    results.map(
      (category) => [
        String(
          category?.id
        ),
        normalizeText(
          category?.name
        ) ||
          `Category ${category?.id}`,
      ]
    )
  );
}

async function getSameehaRawProducts() {
  const config =
    getSameehaConfig();

  const products = [];

  let page = 1;

  const maximumPages = 100;

  while (
    page <= maximumPages
  ) {
    const response =
      await providerRequest(
        `${config.baseUrl}/products?page=${page}`,
        {
          headers: {
            Authorization:
              `Bearer ${config.apiKey}`,
          },
        }
      );

    const results =
      Array.isArray(
        response?.results
      )
        ? response.results
        : [];

    products.push(
      ...results
    );

    const total =
      Number(
        response?.count
      );

    if (
      results.length === 0
    ) {
      break;
    }

    if (
      Number.isFinite(
        total
      ) &&
      products.length >=
        total
    ) {
      break;
    }

    /*
     * If API doesn't expose a total
     * and returns a short/empty page,
     * this prevents an endless loop.
     */
    if (
      !Number.isFinite(
        total
      ) &&
      results.length <
        1
    ) {
      break;
    }

    page += 1;
  }

  return products;
}

async function getSameehaProducts() {
  const config =
    getSameehaConfig();

  const [
    categories,
    products,
  ] = await Promise.all([
    getSameehaCategories(),
    getSameehaRawProducts(),
  ]);

  return products
    .map((product) => {
      const providerUnitPrice =
        positiveNumber(
          product?.price
        );

      const providerCostNgn =
        convertToNgn(
          providerUnitPrice,
          config.currency
        );

      const stock =
        positiveNumber(
          product?.stock
        );

      const category =
        categories.get(
          String(
            product?.category_id
          )
        ) ||
        "Other";

      return {
        provider:
          PROVIDERS.SAMEEHA,

        providerProductId:
          String(
            product?.id
          ),

        name:
          normalizeText(
            product?.name
          ),

        category,

        providerCurrency:
          config.currency,

        providerUnitPrice,

        providerCostNgn,

        stock,

        inStock:
          product?.in_stock ===
          true ||
          stock > 0,
      };
    })
    .filter(
      (product) =>
        product.name &&
        product
          .providerProductId
    );
}

async function buyFromSameeha(
  productId,
  quantity
) {
  const config =
    getSameehaConfig();

  return providerRequest(
    `${config.baseUrl}/buy`,
    {
      method: "POST",

      headers: {
        Authorization:
          `Bearer ${config.apiKey}`,
      },

      body: {
        product:
          Number(productId),
        quantity,
      },
    }
  );
}

/* =========================================================
   LOGGSPLUG
========================================================= */

async function getLoggsplugProducts() {
  const config =
    getLoggsplugConfig();

  const response =
    await providerRequest(
      `${config.baseUrl}/products`,
      {
        headers: {
          "X-Api-Key":
            config.apiKey,
        },
      }
    );

  const rawProducts =
    Array.isArray(
      response?.data
    )
      ? response.data
      : Array.isArray(
            response
          )
        ? response
        : [];

  return rawProducts
    .map((product) => {
      const providerUnitPrice =
        positiveNumber(
          product
            ?.reseller_price ??
            product
              ?.base_price ??
            product?.price
        );

      const providerCostNgn =
        convertToNgn(
          providerUnitPrice,
          config.currency
        );

      const rawStock =
        product?.in_stock ??
        product?.stock ??
        0;

      const stock =
        typeof rawStock ===
        "boolean"
          ? rawStock
            ? 1
            : 0
          : positiveNumber(
              rawStock
            );

      return {
        provider:
          PROVIDERS.LOGGSPLUG,

        providerProductId:
          String(
            product?.id
          ),

        name:
          normalizeText(
            product?.name
          ),

        category:
          normalizeText(
            product?.category
          ) || "Other",

        providerCurrency:
          config.currency,

        providerUnitPrice,

        providerCostNgn,

        stock,

        inStock:
          typeof rawStock ===
          "boolean"
            ? rawStock
            : stock > 0,
      };
    })
    .filter(
      (product) =>
        product.name &&
        product
          .providerProductId
    );
}

async function buyFromLoggsplug(
  productId,
  quantity
) {
  const config =
    getLoggsplugConfig();

  return providerRequest(
    `${config.baseUrl}/order`,
    {
      method: "POST",

      headers: {
        "X-Api-Key":
          config.apiKey,
      },

      body: {
        product_id:
          Number(productId),
        qty: quantity,
      },
    }
  );
}

/* =========================================================
   NORMALIZED PROVIDER PURCHASE
========================================================= */

async function purchaseFromProvider(
  candidate,
  quantity
) {
  if (
    candidate.provider ===
    PROVIDERS.SAMEEHA
  ) {
    const data =
      await buyFromSameeha(
        candidate
          .providerProductId,
        quantity
      );

    return {
      providerOrderId:
        String(
          data?.order_id ||
            ""
        ),

      providerCharge:
        positiveNumber(
          data?.charge,
          candidate
            .providerUnitPrice *
            quantity
        ),

      deliveredItems:
        extractDeliveredItems(
          data
        ),

      raw: data,
    };
  }

  if (
    candidate.provider ===
    PROVIDERS.LOGGSPLUG
  ) {
    const data =
      await buyFromLoggsplug(
        candidate
          .providerProductId,
        quantity
      );

    return {
      providerOrderId:
        String(
          data?.order_id ||
            ""
        ),

      providerCharge:
        positiveNumber(
          data?.charged,
          candidate
            .providerUnitPrice *
            quantity
        ),

      deliveredItems:
        extractDeliveredItems(
          data
        ),

      raw: data,
    };
  }

  throw new Error(
    "Unsupported social provider"
  );
}


async function loadProviderProductsSafely(
  provider,
  loader
) {
  try {
    const products =
      await loader();

    return {
      provider,
      ok: true,
      products:
        Array.isArray(products)
          ? products
          : [],
      error: null,
    };
  } catch (error) {
    console.error(
      `[social] ${provider} catalog request failed:`,
      {
        message:
          error?.message ||
          "Unknown provider error",
        providerHttpStatus:
          error?.providerHttpStatus,
        providerCode:
          error?.providerCode,
      }
    );

    return {
      provider,
      ok: false,
      products: [],
      error,
    };
  }
}

/* =========================================================
   CATALOG SYNC
========================================================= */

async function refreshCatalog() {
  /*
   * IMPORTANT:
   * Providers are isolated from each other.
   *
   * LoggsPlug is currently capable of returning a Cloudflare
   * HTTP 403 challenge from Render. That must NOT stop Sameeha
   * products from refreshing or being purchased.
   *
   * Likewise, a Sameeha outage must not take LoggsPlug down.
   */
  const sameehaConfig =
    getSameehaConfig();

  const loggsplugConfig =
    getLoggsplugConfig();

  const providerJobs = [];

  if (sameehaConfig.apiKey) {
    providerJobs.push(
      loadProviderProductsSafely(
        PROVIDERS.SAMEEHA,
        getSameehaProducts
      )
    );
  } else {
    console.error(
      "[social] SAMEEHA_API_KEY is missing; Sameeha refresh skipped."
    );
  }

  if (ENABLE_LOGGSPLUG) {
    if (loggsplugConfig.apiKey) {
      providerJobs.push(
        loadProviderProductsSafely(
          PROVIDERS.LOGGSPLUG,
          getLoggsplugProducts
        )
      );
    } else {
      console.error(
        "[social] LOGGSPLUG_API_KEY is missing; LoggsPlug refresh skipped."
      );
    }
  }

  if (providerJobs.length === 0) {
    throw new Error(
      "No social provider API keys are configured"
    );
  }

  const providerResults =
    await Promise.all(
      providerJobs
    );

  const successfulResults =
    providerResults.filter(
      (result) =>
        result.ok
    );

  if (
    successfulResults.length ===
    0
  ) {
    /*
     * Every provider failed. Keep the existing cached catalog
     * untouched instead of replacing it with an empty catalog.
     */
    const firstError =
      providerResults.find(
        (result) =>
          result.error
      )?.error;

    throw (
      firstError ||
      new Error(
        "All social providers are unavailable"
      )
    );
  }

  const combined =
    successfulResults.flatMap(
      (result) =>
        result.products
    );

  const grouped =
    new Map();

  for (
    const product of combined
  ) {
    const catalogKey =
      buildCatalogKey(
        product.category,
        product.name
      );

    if (
      !grouped.has(
        catalogKey
      )
    ) {
      grouped.set(
        catalogKey,
        {
          catalogKey,

          name:
            product.name,

          category:
            product.category,

          alternatives: [],
        }
      );
    }

    grouped
      .get(catalogKey)
      .alternatives.push(
        product
      );
  }

  const now = new Date();

  const pricingIndex =
    await socialPricingService.loadPricingIndex();

  const seenKeys = [];

  for (
    const group of
    grouped.values()
  ) {
    const alternatives =
      group.alternatives.sort(
        (a, b) =>
          a.providerCostNgn -
          b.providerCostNgn
      );

    /*
     * Choose cheapest supplier that
     * currently has stock.
     */
    const primary =
      alternatives.find(
        (item) =>
          item.inStock &&
          item.stock > 0
      ) ||
      alternatives[0];

    if (!primary) {
      continue;
    }

    const sellingPrice =
      socialPricingService.resolveFromIndex({
        provider: primary.provider,
        providerProductId:
          primary.providerProductId,
        providerCostNgn:
          primary.providerCostNgn,
        index: pricingIndex,
      }).sellingPrice;

    seenKeys.push(
      group.catalogKey
    );

    await SocialProduct
      .findOneAndUpdate(
        {
          catalogKey:
            group.catalogKey,
        },

        {
          $set: {
            sourceType:
              "provider",

            name:
              group.name,

            category:
              group.category,

            provider:
              primary.provider,

            providerProductId:
              primary
                .providerProductId,

            providerCurrency:
              primary
                .providerCurrency,

            providerUnitPrice:
              primary
                .providerUnitPrice,

            providerCostNgn:
              primary
                .providerCostNgn,

            sellingPrice,

            stock:
              primary.stock,

            inStock:
              Boolean(
                primary.inStock &&
                primary.stock > 0
              ),

            alternatives:
              alternatives.map(
                (item) => ({
                  provider:
                    item.provider,

                  providerProductId:
                    item.providerProductId,

                  providerCurrency:
                    item.providerCurrency,

                  providerUnitPrice:
                    item.providerUnitPrice,

                  providerCostNgn:
                    item.providerCostNgn,

                  stock:
                    item.stock,

                  inStock:
                    item.inStock,
                })
              ),

            isActive: true,

            lastSyncedAt:
              now,
          },
        },

        {
          upsert: true,
          returnDocument: "after",
          setDefaultsOnInsert:
            true,
        }
      );
  }

  /*
   * IMPORTANT:
   * Only deactivate products for providers that actually
   * refreshed successfully in this cycle.
   *
   * If LoggsPlug is blocked/unavailable while Sameeha succeeds,
   * we must NOT deactivate cached LoggsPlug products.
   */
  const refreshedProviders =
    successfulResults.map(
      (result) => result.provider
    );

  if (
    seenKeys.length > 0 &&
    refreshedProviders.length > 0
  ) {
    await SocialProduct
      .updateMany(
        {
          provider: {
            $in: refreshedProviders,
          },

          catalogKey: {
            $nin:
              seenKeys,
          },
        },

        {
          $set: {
            isActive: false,
            inStock: false,
            stock: 0,
          },
        }
      );
  }

  return {
    count:
      seenKeys.length,
  };
}

function sanitizeProduct(
  product
) {
  const data =
    typeof product?.toObject ===
    "function"
      ? product.toObject({
          transform: false,
        })
      : { ...product };

  return {
    id:
      String(
        data?._id ||
          data?.id ||
          ""
      ),

    name:
      data?.name || "",

    category:
      data?.category ||
      "Other",

    price:
      Number(
        data?.sellingPrice ||
          0
      ),

    stock:
      Number(
        data?.stock ||
          0
      ),

    inStock:
      Boolean(
        data?.inStock &&
        Number(
          data?.stock ||
            0
        ) > 0
      ),

    description:
      String(data?.description || ""),

    logoUrl:
      String(data?.logoUrl || ""),

    lastSyncedAt:
      data?.lastSyncedAt,
  };
}

function getCachedProviderCandidates(
  product
) {
  const data =
    typeof product?.toObject ===
    "function"
      ? product.toObject({
          transform: false,
        })
      : { ...product };

  const raw =
    Array.isArray(
      data?.alternatives
    )
      ? [
          ...data.alternatives,
        ]
      : [];

  if (
    data?.provider &&
    data?.providerProductId
  ) {
    raw.push({
      provider:
        data.provider,

      providerProductId:
        data.providerProductId,

      providerCurrency:
        data.providerCurrency,

      providerUnitPrice:
        data.providerUnitPrice,

      providerCostNgn:
        data.providerCostNgn,

      stock:
        data.stock,

      inStock:
        data.inStock,
    });
  }

  const deduped =
    new Map();

  for (
    const candidate of raw
  ) {
    const provider =
      String(
        candidate?.provider ||
          ""
      )
        .trim()
        .toLowerCase();

    const providerProductId =
      String(
        candidate
          ?.providerProductId ||
          ""
      ).trim();

    if (
      ![
        PROVIDERS.SAMEEHA,
        PROVIDERS.LOGGSPLUG,
      ].includes(provider) ||
      !providerProductId
    ) {
      continue;
    }

    deduped.set(
      `${provider}:${providerProductId}`,
      {
        provider,
        providerProductId,

        providerCurrency:
          normalizeCurrency(
            candidate
              ?.providerCurrency ||
              "NGN"
          ),

        providerUnitPrice:
          positiveNumber(
            candidate
              ?.providerUnitPrice
          ),

        providerCostNgn:
          positiveNumber(
            candidate
              ?.providerCostNgn
          ),

        stock:
          positiveNumber(
            candidate?.stock
          ),

        inStock:
          Boolean(
            candidate?.inStock
          ),
      }
    );
  }

  return [
    ...deduped.values(),
  ];
}

function sanitizeProductForCustomer(
  product,
  hiddenRuleKeys,
  pricingIndex
) {
  const sourceType =
    String(
      product?.sourceType ||
        (
          product?.provider ===
          PROVIDERS.HOUSE
            ? "house"
            : "provider"
        )
    )
      .trim()
      .toLowerCase();

  if (
    sourceType === "house" ||
    product?.provider === PROVIDERS.HOUSE
  ) {
    if (!product?.isActive) return null;
    return sanitizeProduct(product);
  }

  const enabled = getCachedProviderCandidates(product)
    .filter(
      (candidate) =>
        isCustomerProviderEnabled(
          candidate.provider
        )
    )
    .filter(
      (candidate) =>
        !isProviderCandidateHidden(
          candidate,
          product?.category,
          hiddenRuleKeys
        )
    )
    .map((candidate) => {
      const pricing = socialPricingService.resolveFromIndex({
        provider: candidate.provider,
        providerProductId: candidate.providerProductId,
        providerCostNgn: candidate.providerCostNgn,
        index: pricingIndex,
      });

      return {
        ...candidate,
        sellingUnitPrice: pricing.sellingPrice,
        description: pricing.note,
        logoUrl: pricing.logoUrl,
      };
    });

  if (enabled.length === 0) return null;

  const inStock = enabled
    .filter((candidate) => candidate.inStock && candidate.stock > 0)
    .sort((a, b) => a.sellingUnitPrice - b.sellingUnitPrice);

  const selected =
    inStock[0] ||
    [...enabled].sort(
      (a, b) => a.sellingUnitPrice - b.sellingUnitPrice
    )[0];

  if (!selected) return null;

  return {
    id: String(product?._id || product?.id || ""),
    name: product?.name || "",
    category: product?.category || "Other",
    price: Number(selected.sellingUnitPrice || 0),
    stock: Number(selected.stock || 0),
    inStock: Boolean(selected.inStock && Number(selected.stock || 0) > 0),
    description: selected.description || "",
    logoUrl: selected.logoUrl || "",
    lastSyncedAt: product?.lastSyncedAt,
  };
}

function buildCustomerCatalog(
  products,
  hiddenRuleKeys,
  pricingIndex
) {
  return (
    Array.isArray(products)
      ? products
      : []
  )
    .filter(
      (product) =>
        product?.isActive
    )
    .map(
      (product) =>
        sanitizeProductForCustomer(
          product,
          hiddenRuleKeys,
          pricingIndex
        )
    )
    .filter(Boolean);
}

function sanitizeOrder(
  order
) {
  const data =
    typeof order?.toObject ===
    "function"
      ? order.toObject()
      : { ...order };

  return {
    id:
      String(
        data?._id ||
          data?.id ||
          ""
      ),

    productName:
      data?.productName ||
      "",

    category:
      data?.category ||
      "",

    quantity:
      Number(
        data?.quantity ||
          1
      ),

    unitPrice:
      Number(
        data
          ?.unitSellingPrice ||
          0
      ),

    total:
      Number(
        data?.sellingPrice ||
          0
      ),

    status:
      data?.status ||
      "processing",

    deliveredItems:
      getReadableDeliveredItems(
        data?.deliveredItems,
        data?.providerResponse
      ),

    refunded:
      Boolean(
        data?.refunded
      ),

    createdAt:
      data?.createdAt,

    completedAt:
      data?.completedAt,

    message:
      data?.status ===
      "review_required"
        ? "Your purchase is being verified. Please do not place the same order again."
        : "",
  };
}

/* =========================================================
   WALLET
========================================================= */

function createReservationReference(
  userId
) {
  return [
    "SOCIAL",
    userId,
    Date.now(),
    crypto
      .randomBytes(5)
      .toString("hex"),
  ]
    .join("-")
    .toUpperCase();
}

async function reserveWallet({
  userId,
  amount,
  reference,
  description,
}) {
  const wallet =
    await Wallet
      .findOneAndUpdate(
        {
          user: userId,

          balance: {
            $gte: amount,
          },
        },

        {
          $inc: {
            balance:
              -amount,
          },

          $push: {
            transactions: {
              $each: [
                {
                  type:
                    "purchase",

                  amount,

                  environment:
                    "live",

                  balanceField:
                    "balance",

                  description,

                  status:
                    "pending",

                  reference,

                  currency:
                    "NGN",
                },
              ],

              $position: 0,
            },
          },
        },

        {
          returnDocument: "after",
          runValidators: true,
        }
      );

  if (wallet) {
    return wallet;
  }

  const existing =
    await Wallet.findOne({
      user: userId,
    }).select("balance");

  if (!existing) {
    const error =
      new Error(
        "Wallet not found"
      );

    error.status = 404;
    error.code =
      "WALLET_NOT_FOUND";

    throw error;
  }

  const error =
    new Error(
      "Your ChapsSms wallet balance is too low for this purchase."
    );

  error.status = 400;
  error.code =
    "INSUFFICIENT_WALLET_BALANCE";

  error.walletBalance =
    Number(
      existing.balance ||
        0
    );

  throw error;
}

async function completeWalletReservation({
  userId,
  reference,
  amount,
  description,
}) {
  return Wallet
    .findOneAndUpdate(
      {
        user: userId,

        transactions: {
          $elemMatch: {
            reference,
            status:
              "pending",
          },
        },
      },

      {
        $set: {
          "transactions.$[purchase].status":
            "completed",

          "transactions.$[purchase].amount":
            amount,

          "transactions.$[purchase].description":
            description,
        },
      },

      {
        returnDocument: "after",

        runValidators:
          true,

        arrayFilters: [
          {
            "purchase.reference":
              reference,

            "purchase.status":
              "pending",
          },
        ],
      }
    );
}

async function refundWalletReservation({
  userId,
  reference,
  amount,
  description,
}) {
  const refundReference =
    `${reference}-REFUND`
      .toUpperCase();

  /*
   * Stage 1:
   * Restore money only while the
   * reservation is still pending.
   *
   * Makes refund idempotent.
   */
  let wallet =
    await Wallet
      .findOneAndUpdate(
        {
          user: userId,

          transactions: {
            $elemMatch: {
              reference,
              status:
                "pending",
            },
          },
        },

        {
          $inc: {
            balance: amount,
          },

          $set: {
            "transactions.$[purchase].status":
              "failed",

            "transactions.$[purchase].description":
              description,
          },
        },

        {
          returnDocument: "after",

          runValidators:
            true,

          arrayFilters: [
            {
              "purchase.reference":
                reference,

              "purchase.status":
                "pending",
            },
          ],
        }
      );

  /*
   * Reservation was already handled.
   */
  if (!wallet) {
    wallet =
      await Wallet.findOne({
        user: userId,
      });
  }

  if (!wallet) {
    throw new Error(
      "Wallet not found while refunding social purchase"
    );
  }

  /*
   * Stage 2:
   * Add refund history WITHOUT
   * changing balance again.
   */
  const historyWallet =
    await Wallet
      .findOneAndUpdate(
        {
          user: userId,

          "transactions.reference":
            {
              $ne:
                refundReference,
            },
        },

        {
          $push: {
            transactions: {
              $each: [
                {
                  type:
                    "refund",

                  amount,

                  environment:
                    "live",

                  balanceField:
                    "balance",

                  description,

                  status:
                    "completed",

                  reference:
                    refundReference,

                  currency:
                    "NGN",
                },
              ],

              $position: 0,
            },
          },
        },

        {
          returnDocument: "after",
          runValidators: true,
        }
      );

  return (
    historyWallet ||
    wallet
  );
}


async function syncHouseProductStock(
  productId
) {
  const available =
    await HouseStockItem
      .countDocuments({
        product: productId,
        status: "available",
      });

  await SocialProduct
    .updateOne(
      {
        _id: productId,
        sourceType: "house",
      },
      {
        $set: {
          stock: available,
          inStock:
            available > 0,
          lastSyncedAt:
            new Date(),
        },
      }
    );

  return available;
}

async function buyHouseStockProduct({
  req,
  res,
  product,
  quantity,
}) {
  let reservationReference =
    "";

  let reservedAmount = 0;
  let walletWasDebited =
    false;
  let wallet = null;
  let order = null;

  const claimedIds = [];
  let inventoryCommitted =
    false;

  try {
    const availableBefore =
      await HouseStockItem
        .countDocuments({
          product:
            product._id,
          status:
            "available",
        });

    if (
      availableBefore <
      quantity
    ) {
      await syncHouseProductStock(
        product._id
      );

      return res
        .status(409)
        .json({
          success: false,
          code:
            "SOCIAL_OUT_OF_STOCK",
          message:
            "This product is currently out of stock. Please try another product.",
        });
    }

    const unitSellingPrice =
      Number(
        product
          .sellingPrice
      );

    reservedAmount =
      unitSellingPrice *
      quantity;

    if (
      !Number.isFinite(
        reservedAmount
      ) ||
      reservedAmount <= 0
    ) {
      throw new Error(
        "Invalid house stock selling price"
      );
    }

    reservationReference =
      createReservationReference(
        req.user._id
      );

    wallet =
      await reserveWallet({
        userId:
          req.user._id,

        amount:
          reservedAmount,

        reference:
          reservationReference,

        description:
          `Reserved for ${product.name} x${quantity}`,
      });

    walletWasDebited =
      true;

    order =
      await SocialOrder.create({
        user:
          req.user._id,

        product:
          product._id,

        productName:
          product.name,

        category:
          product.category,

        quantity,

        unitSellingPrice,

        sellingPrice:
          reservedAmount,

        provider:
          PROVIDERS.HOUSE,

        providerProductId:
          String(
            product._id
          ),

        providerUnitPrice:
          Number(
            product
              .providerUnitPrice ||
              product
                .providerCostNgn ||
              0
          ),

        providerCharge:
          Number(
            product
              .providerCostNgn ||
              0
          ) *
          quantity,

        providerCostNgn:
          Number(
            product
              .providerCostNgn ||
              0
          ) *
          quantity,

        profit:
          reservedAmount -
          Number(
            product
              .providerCostNgn ||
              0
          ) *
          quantity,

        walletReservationReference:
          reservationReference,

        paymentEnvironment:
          "live",

        walletBalanceField:
          "balance",

        status:
          "processing",
      });

    const claimedItems = [];

    for (
      let index = 0;
      index < quantity;
      index += 1
    ) {
      const item =
        await HouseStockItem
          .findOneAndUpdate(
            {
              product:
                product._id,
              status:
                "available",
            },

            {
              $set: {
                status:
                  "reserved",
                reservationReference,
                reservedAt:
                  new Date(),
                reservedBy:
                  req.user._id,
              },
            },

            {
              returnDocument: "after",
              sort: {
                createdAt: 1,
              },
            }
          );

      if (!item) {
        const error =
          new Error(
            "House stock changed before the order could be completed"
          );

        error
          .definitiveNoPurchase =
          true;

        throw error;
      }

      claimedItems.push(
        item
      );

      claimedIds.push(
        item._id
      );
    }

    const deliveryItems =
      claimedItems.map(
        (item) =>
          String(
            item.details || ""
          ).trim()
      );

    if (
      deliveryItems.some(
        (item) => !item
      ) ||
      deliveryItems.length !==
        quantity
    ) {
      const error =
        new Error(
          "One or more house stock items are invalid"
        );

      error
        .definitiveNoPurchase =
        true;

      throw error;
    }

    const soldResult =
      await HouseStockItem
        .updateMany(
          {
            _id: {
              $in:
                claimedIds,
            },

            reservationReference,

            status:
              "reserved",
          },

          {
            $set: {
              status:
                "sold",
              soldAt:
                new Date(),
              soldTo:
                req.user._id,
              socialOrder:
                order._id,
            },
          }
        );

    if (
      Number(
        soldResult
          .modifiedCount ||
          0
      ) !== quantity
    ) {
      const error =
        new Error(
          "House stock could not be finalized"
        );

      error
        .definitiveNoPurchase =
        true;

      throw error;
    }

    order.providerOrderId =
      `HOUSE-${String(
        order._id
      )}`;

    order.deliveredItems =
      deliveryItems;

    order.status =
      "completed";

    order.completedAt =
      new Date();

    order.failureReason =
      "";

    await order.save();

    /*
     * Once the completed order is saved, the credentials
     * are committed to this customer. Do not auto-refund
     * after this point because that would give away stock
     * for free.
     */
    inventoryCommitted =
      true;

    await syncHouseProductStock(
      product._id
    );

    let completedWallet =
      null;

    try {
      completedWallet =
        await completeWalletReservation(
          {
            userId:
              req.user._id,

            reference:
              reservationReference,

            amount:
              reservedAmount,

            description:
              `${product.name} x${quantity}`,
          }
        );
    } catch (
      walletHistoryError
    ) {
      console.error(
        "House stock wallet completion write failed:",
        walletHistoryError
      );
    }

    return res
      .status(201)
      .json({
        success: true,
        reviewRequired:
          false,
        message:
          "Purchase completed successfully.",

        walletBalance:
          completedWallet
            ? Number(
                completedWallet
                  .balance ||
                  0
              )
            : Number(
                wallet
                  ?.balance ||
                  0
              ),

        order:
          sanitizeOrder(
            order
          ),
      });
  } catch (error) {
    console.error(
      "Buy house stock product error:",
      error
    );

    /*
     * Local inventory can be safely rolled back while the
     * completed order has not yet been committed.
     */
    if (
      !inventoryCommitted &&
      claimedIds.length >
        0
    ) {
      try {
        await HouseStockItem
          .updateMany(
            {
              _id: {
                $in:
                  claimedIds,
              },

              reservationReference,
            },

            {
              $set: {
                status:
                  "available",
                reservationReference:
                  "",
                reservedAt:
                  null,
                reservedBy:
                  null,
                soldAt:
                  null,
                soldTo:
                  null,
                socialOrder:
                  null,
              },
            }
          );

        await syncHouseProductStock(
          product._id
        );
      } catch (
        inventoryRollbackError
      ) {
        console.error(
          "House stock rollback failed:",
          inventoryRollbackError
        );

        if (order) {
          order.status =
            "review_required";

          order.failureReason =
            "House inventory rollback requires manual verification.";

          await order
            .save()
            .catch(
              () => null
            );
        }

        return res
          .status(500)
          .json({
            success: false,
            code:
              "HOUSE_STOCK_ROLLBACK_FAILED",
            message:
              "This house-stock order requires manual verification. Please do not place the same order again.",
            reviewRequired:
              true,
          });
      }
    }

    if (
      inventoryCommitted
    ) {
      if (order) {
        order.status =
          "review_required";

        order.failureReason =
          "House stock was committed but final processing requires verification.";

        await order
          .save()
          .catch(
            () => null
          );
      }

      return res
        .status(500)
        .json({
          success: false,
          code:
            "SOCIAL_PURCHASE_REVIEW_REQUIRED",
          message:
            "Your house-stock purchase is being verified. Please do not place the same order again.",
          reviewRequired:
            true,
          order:
            order
              ? sanitizeOrder(
                  order
                )
              : undefined,
        });
    }

    let refundWallet =
      null;

    if (
      walletWasDebited &&
      reservedAmount > 0 &&
      reservationReference
    ) {
      try {
        refundWallet =
          await refundWalletReservation(
            {
              userId:
                req.user._id,

              reference:
                reservationReference,

              amount:
                reservedAmount,

              description:
                "Automatic refund for failed house-stock purchase",
            }
          );

        if (order) {
          order.status =
            "refunded";

          order.refunded =
            true;

          order.refundedAt =
            new Date();

          order.failureReason =
            error?.message ||
            "House stock purchase failed.";

          await order.save();
        }
      } catch (
        refundError
      ) {
        console.error(
          "House stock automatic refund failed:",
          refundError
        );

        return res
          .status(500)
          .json({
            success: false,
            code:
              "SOCIAL_WALLET_ROLLBACK_FAILED",
            message:
              "The purchase failed but ChapsSms could not immediately restore the reserved wallet balance. Please contact support.",
          });
      }
    }

    return res
      .status(409)
      .json({
        success: false,
        code:
          "SOCIAL_PURCHASE_FAILED",
        message:
          "ChapsSms could not complete this house-stock purchase. Your wallet was not charged or has been automatically refunded.",
        refunded:
          Boolean(
            refundWallet
          ),
        walletBalance:
          refundWallet
            ? Number(
                refundWallet
                  .balance ||
                  0
              )
            : undefined,
      });
  }
}

/* =========================================================
   LIVE PURCHASE CANDIDATES
========================================================= */

async function getLiveCandidates(
  product,
  quantity
) {
  /*
   * Refresh enabled provider product lists
   * immediately before purchase.
   *
   * LoggsPlug is disabled by default for now, so Sameeha
   * is the only external provider used unless re-enabled.
   * House stock never comes through here.
   */
  const loggsplugPromise =
    ENABLE_LOGGSPLUG
      ? loadProviderProductsSafely(
          PROVIDERS.LOGGSPLUG,
          getLoggsplugProducts
        )
      : Promise.resolve({
          provider:
            PROVIDERS.LOGGSPLUG,
          ok: false,
          products: [],
          error: null,
        });

  const [
    sameehaResult,
    loggsplugResult,
    hiddenRuleKeys,
    pricingIndex,
  ] = await Promise.all([
    loadProviderProductsSafely(
      PROVIDERS.SAMEEHA,
      getSameehaProducts
    ),

    loggsplugPromise,

    loadHiddenSocialRuleKeys(),

    socialPricingService
      .loadPricingIndex(),
  ]);

  /*
   * Only enabled providers contribute live products.
   * With ENABLE_LOGGSPLUG=false, this is Sameeha only.
   */
  const liveProducts = [
    ...(sameehaResult.ok
      ? sameehaResult.products
      : []),

    ...(loggsplugResult.ok
      ? loggsplugResult.products
      : []),
  ];

  if (
    liveProducts.length ===
    0
  ) {
    const error =
      sameehaResult.error ||
      loggsplugResult.error ||
      new Error(
        "Social providers are temporarily unavailable"
      );

    throw error;
  }

  const allowed =
    new Set(
      (
        product
          ?.alternatives ||
        []
      ).map(
        (item) =>
          `${item.provider}:${item.providerProductId}`
      )
    );

  /*
   * Compatibility for a product cached
   * before alternatives existed.
   */
  allowed.add(
    `${product.provider}:${product.providerProductId}`
  );

  return liveProducts
    .filter(
      (item) =>
        isCustomerProviderEnabled(
          item.provider
        )
    )
    .filter(
      (item) =>
        allowed.has(
          `${item.provider}:${item.providerProductId}`
        )
    )
    .filter(
      (item) =>
        !isProviderCandidateHidden(
          item,
          product.category,
          hiddenRuleKeys
        )
    )
    .filter(
      (item) =>
        item.inStock &&
        item.stock >=
          quantity
    )
    .map(
      (item) => ({
        ...item,

        sellingUnitPrice:
          socialPricingService.resolveFromIndex({
            provider: item.provider,
            providerProductId:
              item.providerProductId,
            providerCostNgn:
              item.providerCostNgn,
            index: pricingIndex,
          }).sellingPrice,
      })
    )
    .sort(
      (a, b) =>
        a.sellingUnitPrice -
        b.sellingUnitPrice
    );
}

/* =========================================================
   CONTROLLERS
========================================================= */

exports.getCatalog =
  async (req, res) => {
    let stale = false;

    try {
      /*
       * House-stock timestamps must not affect the provider
       * catalog refresh timer.
       */
      const latest =
        await SocialProduct
          .findOne({
            provider: {
              $in:
                getEnabledExternalProviders(),
            },

            isActive: true,
          })
          .sort({
            lastSyncedAt: -1,
          })
          .select(
            "lastSyncedAt"
          );

      const lastSync =
        latest?.lastSyncedAt
          ? new Date(
              latest.lastSyncedAt
            ).getTime()
          : 0;

      const shouldRefresh =
        !lastSync ||
        Date.now() -
          lastSync >
          getCatalogTtlMs();

      if (
        shouldRefresh
      ) {
        try {
          await refreshCatalog();
        } catch (
          refreshError
        ) {
          stale = true;

          console.error(
            "Social catalog refresh failed:",
            refreshError
          );
        }
      }

      let products =
        await SocialProduct
          .find({
            isActive:
              true,
          })
          .sort({
            category: 1,
            name: 1,
          });

      const hasProviderProduct =
        products.some(
          (product) =>
            getCachedProviderCandidates(
              product
            ).some(
              (candidate) =>
                isCustomerProviderEnabled(
                  candidate.provider
                )
            )
        );

      if (
        !hasProviderProduct
      ) {
        /*
         * No cached provider catalog exists yet.
         * House stock by itself must not suppress
         * the first provider sync.
         */
        await refreshCatalog();

        products =
          await SocialProduct
            .find({
              isActive:
                true,
            })
            .sort({
              category: 1,
              name: 1,
            });

        stale = false;
      }

      const [
        hiddenRuleKeys,
        pricingIndex,
      ] = await Promise.all([
        loadHiddenSocialRuleKeys(),
        socialPricingService.loadPricingIndex(),
      ]);

      const customerProducts =
        buildCustomerCatalog(
          products,
          hiddenRuleKeys,
          pricingIndex
        );

      const categories =
        [
          ...new Set(
            customerProducts.map(
              (item) =>
                item.category
            )
          ),
        ];

      return res.json({
        success: true,

        stale,

        categories,

        products:
          customerProducts,
      });
    } catch (error) {
      console.error(
        "Load social catalog error:",
        error
      );

      return res
        .status(502)
        .json({
          success: false,

          code:
            "SOCIAL_CATALOG_LOAD_FAILED",

          message:
            "ChapsSms could not load social products right now. Please try again.",
        });
    }
  };

exports.refreshCatalog =
  async (req, res) => {
    try {
      const result =
        await refreshCatalog();

      return res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      console.error(
        "Refresh social catalog error:",
        error
      );

      return res
        .status(502)
        .json({
          success: false,

          code:
            "SOCIAL_CATALOG_REFRESH_FAILED",

          message:
            "ChapsSms could not refresh social products right now.",
        });
    }
  };

exports.buySocialProduct =
  async (req, res) => {
    let reservationReference =
      "";

    let reservedAmount = 0;

    let walletWasDebited =
      false;

    let order = null;

    let providerPurchaseSucceeded =
      false;

    try {
      /*
       * REAL social provider purchases
       * must NEVER use test money.
       */
      const paymentMode =
        String(
          process.env
            .PAYMENT_MODE ||
            "test"
        )
          .trim()
          .toLowerCase();

      if (
        paymentMode !==
        "live"
      ) {
        return res
          .status(503)
          .json({
            success: false,

            code:
              "SOCIAL_PURCHASE_REQUIRES_LIVE_MODE",

            message:
              "Buy Socials is temporarily unavailable while payment testing is enabled.",
          });
      }

      const productId =
        String(
          req.body
            ?.productId ||
            ""
        ).trim();

      const quantity =
        positiveInteger(
          req.body
            ?.quantity,
          1
        );

      if (!productId) {
        return res
          .status(400)
          .json({
            success: false,

            code:
              "PRODUCT_REQUIRED",

            message:
              "Please select a product.",
          });
      }

      if (
        quantity >
        getMaxQuantity()
      ) {
        return res
          .status(400)
          .json({
            success: false,

            code:
              "INVALID_QUANTITY",

            message:
              `Maximum quantity per order is ${getMaxQuantity()}.`,
          });
      }

      const product =
        await SocialProduct
          .findOne({
            _id:
              productId,

            isActive:
              true,
          });

      if (!product) {
        return res
          .status(404)
          .json({
            success: false,

            code:
              "SOCIAL_PRODUCT_NOT_FOUND",

            message:
              "This product is no longer available.",
          });
      }

      if (
        product.sourceType ===
          "house" ||
        product.provider ===
          PROVIDERS.HOUSE
      ) {
        return buyHouseStockProduct({
          req,
          res,
          product,
          quantity,
        });
      }

      /*
       * Pull current provider stock and
       * pricing before charging customer.
       */
      const candidates =
        await getLiveCandidates(
          product,
          quantity
        );

      if (
        candidates.length ===
        0
      ) {
        return res
          .status(409)
          .json({
            success: false,

            code:
              "SOCIAL_OUT_OF_STOCK",

            message:
              "This product is currently out of stock. Please try another product.",
          });
      }

      /*
       * Cheapest live provider first.
       */
      const firstCandidate =
        candidates[0];

      const unitSellingPrice =
        Number(
          firstCandidate
            .sellingUnitPrice
        );

      reservedAmount =
        unitSellingPrice *
        quantity;

      if (
        !Number.isFinite(
          reservedAmount
        ) ||
        reservedAmount <= 0
      ) {
        throw new Error(
          "Invalid social selling price"
        );
      }

      reservationReference =
        createReservationReference(
          req.user._id
        );

      const wallet =
        await reserveWallet({
          userId:
            req.user._id,

          amount:
            reservedAmount,

          reference:
            reservationReference,

          description:
            `Reserved for ${product.name} x${quantity}`,
        });

      walletWasDebited =
        true;

      /*
       * Save processing record BEFORE
       * placing upstream order.
       */
      order =
        await SocialOrder.create(
          {
            user:
              req.user._id,

            product:
              product._id,

            productName:
              product.name,

            category:
              product.category,

            quantity,

            unitSellingPrice,

            sellingPrice:
              reservedAmount,

            provider:
              firstCandidate.provider,

            providerProductId:
              firstCandidate
                .providerProductId,

            providerUnitPrice:
              firstCandidate
                .providerUnitPrice,

            providerCostNgn:
              firstCandidate
                .providerCostNgn *
              quantity,

            profit:
              reservedAmount -
              firstCandidate
                .providerCostNgn *
                quantity,

            walletReservationReference:
              reservationReference,

            paymentEnvironment:
              "live",

            walletBalanceField:
              "balance",

            status:
              "processing",
          }
        );

      let purchaseResult =
        null;

      let selectedCandidate =
        null;

      let lastDefinitiveError =
        null;

      /*
       * Safe provider failover.
       *
       * We only try another supplier if the
       * previous request DEFINITIVELY failed.
       *
       * Network/timeout/5xx stops immediately
       * to prevent duplicate purchases.
       */
      for (
        const candidate of
        candidates
      ) {
        const candidateTotal =
          candidate
            .sellingUnitPrice *
          quantity;

        /*
         * Never charge more than what the
         * customer already approved.
         */
        if (
          candidateTotal >
          reservedAmount
        ) {
          continue;
        }

        try {
          purchaseResult =
            await purchaseFromProvider(
              candidate,
              quantity
            );

          selectedCandidate =
            candidate;

          providerPurchaseSucceeded =
            true;

          break;
        } catch (
          purchaseError
        ) {
          if (
            purchaseError
              ?.definitiveNoPurchase
          ) {
            lastDefinitiveError =
              purchaseError;

            continue;
          }

          /*
           * Uncertain mutation.
           * NEVER retry another provider.
           */
          throw purchaseError;
        }
      }

      if (
        !purchaseResult ||
        !selectedCandidate
      ) {
        const error =
          lastDefinitiveError ||
          new Error(
            "Product is no longer available"
          );

        error
          .definitiveNoPurchase =
          true;

        throw error;
      }

      const providerCharge =
        positiveNumber(
          purchaseResult
            .providerCharge,

          selectedCandidate
            .providerUnitPrice *
            quantity
        );

      const providerChargeNgn =
        convertToNgn(
          providerCharge,
          selectedCandidate
            .providerCurrency
        );

      const deliveredItems =
        getReadableDeliveredItems(
          purchaseResult
            .deliveredItems,
          purchaseResult.raw
        );

      /*
       * Provider said success but returned
       * no credentials.
       *
       * Do NOT refund automatically because
       * provider has already charged us.
       */
      const finalStatus =
        deliveredItems.length >
        0
          ? "completed"
          : "review_required";

      order.provider =
        selectedCandidate.provider;

      order.providerProductId =
        selectedCandidate
          .providerProductId;

      order.providerUnitPrice =
        selectedCandidate
          .providerUnitPrice;

      order.providerOrderId =
        purchaseResult
          .providerOrderId;

      order.providerCharge =
        providerCharge;

      order.providerCostNgn =
        providerChargeNgn;

      order.profit =
        reservedAmount -
        providerChargeNgn;

      order.deliveredItems =
        deliveredItems;

      order.providerResponse =
        purchaseResult.raw;

      order.status =
        finalStatus;

      order.completedAt =
        finalStatus ===
        "completed"
          ? new Date()
          : null;

      order.failureReason =
        finalStatus ===
        "review_required"
          ? "Provider confirmed purchase but returned no delivery details."
          : "";

      await order.save();

      /*
       * Provider purchase already succeeded.
       * A wallet-history write failure must
       * NEVER cause an automatic refund.
       */
      let completedWallet =
        null;

      try {
        completedWallet =
          await completeWalletReservation(
            {
              userId:
                req.user._id,

              reference:
                reservationReference,

              amount:
                reservedAmount,

              description:
                `${product.name} x${quantity}`,
            }
          );
      } catch (
        walletHistoryError
      ) {
        console.error(
          "Social wallet completion write failed:",
          walletHistoryError
        );
      }

      return res
        .status(
          finalStatus ===
            "completed"
            ? 201
            : 202
        )
        .json({
          success: true,

          reviewRequired:
            finalStatus ===
            "review_required",

          message:
            finalStatus ===
            "completed"
              ? "Purchase completed successfully."
              : "Purchase was accepted and is being verified.",

          walletBalance:
            completedWallet
              ? Number(
                  completedWallet
                    .balance ||
                    0
                )
              : Number(
                  wallet
                    .balance ||
                    0
                ),

          order:
            sanitizeOrder(
              order
            ),
        });
    } catch (error) {
      console.error(
        "Buy social product error:",
        error
      );

      /*
       * CRITICAL:
       *
       * If provider might already have
       * processed the POST, do NOT refund.
       */
      const uncertainPurchase =
        providerPurchaseSucceeded ||
        (
          walletWasDebited &&
          error
            ?.definitiveNoPurchase !==
            true
        );

      if (
        uncertainPurchase
      ) {
        if (order) {
          order.status =
            "review_required";

          order.failureReason =
            "Provider purchase result is uncertain. Manual verification required.";

          try {
            await order.save();
          } catch (
            saveError
          ) {
            console.error(
              "Unable to save social review-required order:",
              saveError
            );
          }
        }

        return res
          .status(502)
          .json({
            success: false,

            code:
              "SOCIAL_PURCHASE_REVIEW_REQUIRED",

            message:
              "The provider response is being verified. Your wallet has not been refunded yet to prevent a duplicate purchase. Please do not place the same order again.",

            reviewRequired:
              true,

            order:
              order
                ? sanitizeOrder(
                    order
                  )
                : undefined,
          });
      }

      /*
       * Definitive failure:
       * provider confirms no purchase happened,
       * so restore ChapSms wallet.
       */
      let refundWallet =
        null;

      if (
        walletWasDebited &&
        reservedAmount > 0 &&
        reservationReference
      ) {
        try {
          refundWallet =
            await refundWalletReservation(
              {
                userId:
                  req.user._id,

                reference:
                  reservationReference,

                amount:
                  reservedAmount,

                description:
                  "Automatic refund for failed social purchase",
              }
            );

          if (order) {
            order.status =
              "refunded";

            order.refunded =
              true;

            order.refundedAt =
              new Date();

            order.failureReason =
              "Provider rejected purchase.";

            await order.save();
          }
        } catch (
          refundError
        ) {
          console.error(
            "Social automatic refund failed:",
            refundError
          );

          return res
            .status(500)
            .json({
              success: false,

              code:
                "SOCIAL_WALLET_ROLLBACK_FAILED",

              message:
                "The purchase failed but ChapsSms could not immediately restore the reserved wallet balance. Please contact support.",
            });
        }
      }

      if (
        error?.code ===
        "INSUFFICIENT_WALLET_BALANCE"
      ) {
        return res
          .status(400)
          .json({
            success: false,

            code:
              error.code,

            message:
              error.message,

            walletBalance:
              error
                .walletBalance,
          });
      }

      return res
        .status(
          error?.status ||
            409
        )
        .json({
          success: false,

          code:
            "SOCIAL_PURCHASE_FAILED",

          message:
            "ChapsSms could not complete this social purchase. Your wallet was not charged or has been automatically refunded.",

          refunded:
            Boolean(
              refundWallet
            ),

          walletBalance:
            refundWallet
              ? Number(
                  refundWallet
                    .balance ||
                    0
                )
              : undefined,
        });
    }
  };

exports.getOrders =
  async (req, res) => {
    try {
      const orders =
        await SocialOrder
          .find({
            user:
              req.user._id,
          })
          .sort({
            createdAt: -1,
          })
          .limit(100);

      /*
       * Repair a wallet-history transaction
       * that remained pending after the
       * provider order successfully completed.
       *
       * The money was already deducted;
       * this only fixes transaction status.
       */
      for (
        const order of orders
      ) {
        if (
          order.status !==
            "completed" ||
          !order
            .walletReservationReference
        ) {
          continue;
        }

        await completeWalletReservation(
          {
            userId:
              req.user._id,

            reference:
              order
                .walletReservationReference,

            amount:
              Number(
                order
                  .sellingPrice
              ),

            description:
              `${order.productName} x${order.quantity}`,
          }
        ).catch(() => null);
      }

      return res.json({
        success: true,

        orders:
          orders.map(
            sanitizeOrder
          ),
      });
    } catch (error) {
      console.error(
        "Load social orders error:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            "Unable to load your social orders.",
        });
    }
  };