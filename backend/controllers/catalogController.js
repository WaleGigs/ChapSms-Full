const providerManager = require(
  "../services/providers/providerManager"
);
const pricingService = require(
  "../services/pricingService"
);
const automaticPricingService = require(
  "../services/automaticPricingService"
);

const VALID_SERVERS = new Set(["server1", "server2"]);
const CACHE_TTL_MS = Number(
  process.env.CATALOG_CACHE_TTL_MS || 5 * 60 * 1000
);
const catalogCache = new Map();

const META_KEYS = new Set([
  "success",
  "server",
  "provider",
  "providerName",
  "currency",
  "updatedAt",
  "raw",
  "message",
  "status",
]);

function createCatalogError(
  message,
  { code = "CATALOG_ERROR", status = 502 } = {}
) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}


function getPublicChapsSmsMessage(
  error,
  fallback = "ChapsSms could not complete this request. Please try again."
) {
  const code = String(error?.code || "").trim().toUpperCase();

  const messages = {
    NO_PRICE:
      "ChapsSms does not currently have a live price for this country and service. Try another server or service.",
    NO_NUMBERS:
      "ChapsSms does not currently have numbers available for this selection. Try another server or service.",
    NO_STOCK:
      "ChapsSms does not currently have numbers available for this selection.",
    INVALID_COUNTRY:
      "This country is not currently available on ChapsSms.",
    INVALID_SERVICE:
      "This service is not currently available on ChapsSms.",
    INVALID_PRICE:
      "ChapsSms could not retrieve a valid live price right now. Please try again.",
    INVALID_PRICE_RESPONSE:
      "ChapsSms could not retrieve a live price right now. Please try again.",
    INVALID_UPSTREAM_RESPONSE:
      "ChapsSms could not retrieve a live response right now. Please try again.",
    EMPTY_RESPONSE:
      "ChapsSms could not retrieve a live response right now. Please try again.",
    PROVIDER_ERROR:
      "ChapsSms service is temporarily unavailable. Please try again shortly.",
    PROVIDER_BALANCE_LOW:
      "ChapsSms service is temporarily unavailable. Please try another server.",
    INVALID_API_KEY:
      "ChapsSms service is temporarily unavailable. Please try again later.",
    BENOTP_REQUEST_FAILED:
      "ChapsSms could not connect to the SMS service. Please try again.",
    SMSBOWER_REQUEST_FAILED:
      "ChapsSms could not connect to the SMS service. Please try again.",
  };

  if (messages[code]) {
    return messages[code];
  }

  const rawMessage = String(
    error?.message ||
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      ""
  );

  if (/benotp|ben otp|smsbower|sms bower/i.test(rawMessage)) {
    return fallback;
  }

  return fallback;
}

function getPublicChapsSmsCode(
  error,
  fallback = "CHAPSSMS_REQUEST_FAILED"
) {
  const code = String(error?.code || "").trim().toUpperCase();

  const safeCodes = new Set([
    "INVALID_SERVER",
    "NO_PRICE",
    "NO_NUMBERS",
    "NO_STOCK",
    "INVALID_COUNTRY",
    "INVALID_SERVICE",
    "INVALID_PRICE",
    "INVALID_PRICE_RESPONSE",
    "EMPTY_RESPONSE",
    "OPERATION_NOT_SUPPORTED",
  ]);

  if (safeCodes.has(code)) {
    return code;
  }

  return fallback;
}

function normalizeServer(value) {
  const server = String(value || "").trim().toLowerCase();

  if (!VALID_SERVERS.has(server)) {
    throw createCatalogError("Please select a valid server", {
      code: "INVALID_SERVER",
      status: 400,
    });
  }

  return server;
}

function hasOwn(object, key) {
  return (
    object &&
    typeof object === "object" &&
    Object.prototype.hasOwnProperty.call(object, key)
  );
}

function unwrapCollection(response, possibleKeys) {
  const containers = [
    response,
    response?.data,
    response?.result,
    response?.response,
  ];

  for (const container of containers) {
    if (!container || typeof container !== "object") {
      continue;
    }

    for (const key of possibleKeys) {
      if (hasOwn(container, key)) {
        return container[key];
      }
    }
  }

  for (const candidate of [
    response?.data,
    response?.result,
    response?.response,
    response,
  ]) {
    if (
      Array.isArray(candidate) ||
      (candidate && typeof candidate === "object")
    ) {
      return candidate;
    }
  }

  return [];
}

function collectionEntries(collection) {
  if (Array.isArray(collection)) {
    return collection.map((item, index) => [String(index), item]);
  }

  if (collection && typeof collection === "object") {
    return Object.entries(collection).filter(
      ([key]) => !META_KEYS.has(key)
    );
  }

  return [];
}

function removeDuplicates(collection, getKey) {
  const usedKeys = new Set();

  return collection.filter((item) => {
    const key = String(getKey(item) || "").toLowerCase();

    if (!key || usedKeys.has(key)) {
      return false;
    }

    usedKeys.add(key);
    return true;
  });
}

function normalizeCountries(response) {
  const rawCountries = unwrapCollection(response, [
    "countries",
    "country",
    "countryList",
    "items",
  ]);

  const normalized = collectionEntries(rawCountries)
    .map(([key, item]) => {
      const objectItem =
        item && typeof item === "object" && !Array.isArray(item)
          ? item
          : {};

      const primitiveName =
        typeof item === "string" ? item.trim() : "";

      const id = String(
        objectItem.id ??
          objectItem.code ??
          objectItem.iso2 ??
          objectItem.iso ??
          objectItem.country ??
          key
      ).trim();

      const code = String(
        objectItem.code ??
          objectItem.iso2 ??
          objectItem.iso ??
          objectItem.countryCode ??
          id
      ).trim();

      const eng = String(
        objectItem.eng ??
          objectItem.name ??
          objectItem.title ??
          objectItem.label ??
          objectItem.countryName ??
          objectItem.country_name ??
          primitiveName ??
          key
      ).trim();

      if (!id || !eng) {
        return null;
      }

      return {
        ...objectItem,
        id,
        code,
        eng,
        name: objectItem.name || eng,
      };
    })
    .filter(Boolean);

  return removeDuplicates(normalized, (country) => country.id).sort(
    (first, second) => first.eng.localeCompare(second.eng)
  );
}

function normalizeServices(response) {
  const rawServices = unwrapCollection(response, [
    "services",
    "service",
    "serviceList",
    "items",
  ]);

  const normalized = collectionEntries(rawServices)
    .map(([key, item]) => {
      const objectItem =
        item && typeof item === "object" && !Array.isArray(item)
          ? item
          : {};

      const primitiveName =
        typeof item === "string" ? item.trim() : "";

      const id = String(
        objectItem.id ??
          objectItem.code ??
          objectItem.service ??
          objectItem.slug ??
          key
      ).trim();

      const code = String(
        objectItem.code ?? objectItem.service ?? objectItem.id ?? id
      ).trim();

      const name = String(
        objectItem.name ??
          objectItem.serviceName ??
          objectItem.title ??
          objectItem.label ??
          primitiveName ??
          key
      ).trim();

      if (!id || !name) {
        return null;
      }

      return {
        ...objectItem,
        id,
        code,
        name,
      };
    })
    .filter(Boolean);

  return removeDuplicates(normalized, (service) => service.id).sort(
    (first, second) => first.name.localeCompare(second.name)
  );
}

async function buildCatalog(server) {
  const [countriesResponse, servicesResponse] = await Promise.all([
    providerManager.getCountries({ server }),
    providerManager.getServices({ server }),
  ]);

  const countries = normalizeCountries(countriesResponse);
  const services = normalizeServices(servicesResponse);

  if (process.env.NODE_ENV !== "production") {
    console.log("CATALOG DEBUG", {
      server,
      countriesLength: countries.length,
      servicesLength: services.length,
      firstCountry: countries[0] || null,
      firstService: services[0] || null,
    });
  }

  if (!countries.length) {
    throw createCatalogError(`${server} returned no countries`, {
      code: "EMPTY_COUNTRIES_CATALOG",
    });
  }

  if (!services.length) {
    throw createCatalogError(`${server} returned no services`, {
      code: "EMPTY_SERVICES_CATALOG",
    });
  }

  return {
    success: true,
    server,
    currency: "NGN",
    updatedAt: new Date().toISOString(),
    countries,
    services,
  };
}

exports.getCatalog = async (req, res) => {
  try {
    const server = normalizeServer(req.query.server || "server1");
    const refresh = ["true", "1", "yes"].includes(
      String(req.query.refresh || "").toLowerCase()
    );

    const cached = catalogCache.get(server);
    const cacheIsValid =
      cached && Date.now() - cached.cachedAt < CACHE_TTL_MS;

    if (!refresh && cacheIsValid) {
      return res.json(cached.catalog);
    }

    const catalog = await buildCatalog(server);

    catalogCache.set(server, {
      cachedAt: Date.now(),
      catalog,
    });

    return res.json(catalog);
  } catch (error) {
    console.error("Catalog request failed:", {
      message: error.message,
      code: error.code,
      status: error.status,
      server: req.query.server,
    });

    return res.status(Number(error.status) || 500).json({
      success: false,
      message: getPublicChapsSmsMessage(
        error,
        "ChapsSms could not load the available countries and services. Please try again."
      ),
      code: getPublicChapsSmsCode(
        error,
        "CATALOG_LOAD_FAILED"
      ),
    });
  }
};

exports.getPrice = async (req, res) => {
  try {
    const server = normalizeServer(req.query.server);
    const country = String(req.query.country || "").trim();
    const service = String(req.query.service || "").trim();
    const countryName = String(
      req.query.countryName || ""
    ).trim();
    const serviceName = String(
      req.query.serviceName || ""
    ).trim();
    const requestedOperator =
      String(
        req.query.operator ||
        "any"
      ).trim();

    if (!country || !service) {
      return res.status(400).json({
        success: false,
        message: "Country and service are required",
      });
    }

    const pricingStrategy =
      await pricingService.resolvePricingStrategy({
        server,
        country,
        service,
        countryName,
        serviceName,
        requestedOperator,
      });

    let operator = pricingStrategy.operator;
    let quote;
    let automaticSelection = null;
    let pricingBasisNgn = null;

    if (pricingStrategy.pricingStyle === "cheapest_buffer") {
      automaticSelection =
        await automaticPricingService.resolveAutomaticQuote({
          server,
          country,
          service,
          maxPriceBufferPercent:
            pricingStrategy.maxPriceBufferPercent,
        });

      operator = automaticSelection.operator;
      quote = automaticSelection.quote;
      pricingBasisNgn = automaticSelection.pricingBasisNgn;
    } else {
      quote = await providerManager.getPrice({
        server,
        country,
        service,
        operator,
      });
    }

    const pricing =
      await pricingService.resolveCustomerPricing({
        server,
        country,
        service,
        countryName,
        serviceName,
        operator,
        providerPrice: quote.price,
        providerCurrency: quote.currency,
        pricingBasisNgn,
      });

    if (process.env.NODE_ENV !== "production") {
      console.log("[Pricing] customer live price:", {
        server,
        country,
        countryName,
        service,
        serviceName,
        operator,
        providerPrice: quote.price,
        providerCurrency: quote.currency,
        sellingPrice: pricing.sellingPrice,
        pricingSource: pricing.pricingSource,
        pricingRuleMatched:
          pricing.pricingRuleMatched,
        automaticStrategy:
          automaticSelection?.strategy ||
          null,
        automaticCandidateCount:
          automaticSelection?.candidateCount ||
          0,
      });
    }

    return res.json({
      success: true,
      server,
      country,
      service,
      operator,
      price: pricing.sellingPrice,
      stock: Number.isFinite(Number(quote.stock))
        ? Number(quote.stock)
        : 0,
      currency: "NGN",
      pricingMode: pricing.pricingMode,
      pricingSource: pricing.pricingSource,
      pricingRuleMatched:
        pricing.pricingRuleMatched,
    });
  } catch (error) {
    console.error("Live-price request failed:", {
      message: error.message,
      code: error.code,
      server: req.query.server,
      country: req.query.country,
      service: req.query.service,
    });

    return res.status(Number(error.status) || 500).json({
      success: false,
      message: getPublicChapsSmsMessage(
        error,
        "ChapsSms could not retrieve a live price right now. Please try again."
      ),
      code: getPublicChapsSmsCode(
        error,
        "PRICE_LOOKUP_FAILED"
      ),
    });
  }
};