const providerManager = require("./providers/providerManager");
const pricingService = require("./pricingService");

const selectionCache = new Map();

function positiveInteger(value, fallback, maximum = 20) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, maximum);
}

function finiteNonNegative(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function normalizePoolPercent(value, fallback = 50) {
  const number = Number(value);
  const safe = Number.isFinite(number) ? number : fallback;
  const clamped = Math.min(100, Math.max(10, safe));
  return Math.round(clamped / 10) * 10;
}

function getCandidateLimit(percent) {
  return Math.min(10, Math.max(1, Math.ceil(normalizePoolPercent(percent) / 10)));
}

function getCacheTtlMs() {
  return positiveInteger(process.env.AUTO_OPERATOR_CACHE_TTL_MS, 15000, 120000);
}

function getOperatorId(operator) {
  return String(
    operator?.id ?? operator?.operator ?? operator?.providerId ?? operator?.poolId ?? ""
  )
    .trim()
    .toLowerCase();
}

function getOperatorPrice(operator) {
  return Number(operator?.price ?? operator?.cost ?? operator?.amount);
}

function getOperatorStock(operator) {
  const stock = Number(operator?.stock ?? operator?.count ?? operator?.quantity ?? 0);
  return Number.isFinite(stock) ? Math.max(0, stock) : 0;
}

function normalizeExcludedOperators(values = []) {
  const items = Array.isArray(values) ? values : [values];

  return new Set(
    items
      .map((value) => String(value || "").trim().toLowerCase())
      .filter((value) => value && value !== "any")
  );
}

function getProviderReliability(operator) {
  for (const value of [
    operator?.successRate,
    operator?.success_rate,
    operator?.deliveryRate,
    operator?.delivery_rate,
    operator?.rate,
    operator?.quality,
  ]) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) continue;
    if (number <= 1) return number;
    if (number <= 100) return number / 100;
  }

  return null;
}

function normalizeProviderTier(value) {
  const tier = String(value || "").trim().toLowerCase();
  return ["gold", "silver", "bronze"].includes(tier) ? tier : "";
}

function normalizeCandidate(operator, fallbackCurrency) {
  const id = getOperatorId(operator);
  const providerPrice = getOperatorPrice(operator);
  const stock = getOperatorStock(operator);

  if (
    !id ||
    operator?.available === false ||
    stock <= 0 ||
    !Number.isFinite(providerPrice) ||
    providerPrice <= 0
  ) {
    return null;
  }

  const providerCurrency = String(
    operator?.currency || fallbackCurrency || "NGN"
  )
    .trim()
    .toUpperCase();

  let providerCostNgn;
  try {
    providerCostNgn = pricingService.convertProviderCostToNaira(
      providerPrice,
      providerCurrency
    );
  } catch {
    return null;
  }

  const rank = Number(operator?.providerRank ?? operator?.rank);
  const salesCount = Number(
    operator?.providerSalesCount ?? operator?.salesCount ?? operator?.sales_count
  );

  return {
    operator: id,
    name: String(operator?.name || operator?.label || `Operator ${id}`).trim(),
    providerPrice,
    providerCurrency,
    providerCostNgn,
    stock,
    providerReliability: getProviderReliability(operator),
    providerTier: normalizeProviderTier(
      operator?.providerTier ?? operator?.tier ?? operator?.level
    ),
    providerRank:
      Number.isFinite(rank) && rank > 0 ? Math.floor(rank) : null,
    providerSalesCount:
      Number.isFinite(salesCount) && salesCount >= 0 ? salesCount : null,
    providerStatsSource: String(
      operator?.providerStatsSource ?? operator?.statsSource ?? ""
    ).trim(),
  };
}

function tierWeight(tier) {
  if (tier === "gold") return 3;
  if (tier === "silver") return 2;
  if (tier === "bronze") return 1;
  return 0;
}

/*
 * IMPORTANT:
 * Price determines only WHICH operators are candidates.
 * It does not determine the customer's selling price.
 *
 * Within that cheapest candidate pool, prefer SMSBower's own provider-side
 * ranking/statistics when present. getTopCountriesByService exposes Gold
 * partners in provider order. If SMSBower does not expose a ranking for the
 * requested pair, live stock is the fallback and lower cost breaks ties.
 */
function rankCandidatePool(pool) {
  return [...pool].sort((first, second) => {
    const firstTier = tierWeight(first.providerTier);
    const secondTier = tierWeight(second.providerTier);

    if (secondTier !== firstTier) {
      return secondTier - firstTier;
    }

    const firstRank = Number(first.providerRank);
    const secondRank = Number(second.providerRank);
    const firstHasRank = Number.isFinite(firstRank) && firstRank > 0;
    const secondHasRank = Number.isFinite(secondRank) && secondRank > 0;

    if (firstHasRank !== secondHasRank) {
      return firstHasRank ? -1 : 1;
    }

    if (firstHasRank && secondHasRank && firstRank !== secondRank) {
      return firstRank - secondRank;
    }

    const firstReliability = Number(first.providerReliability);
    const secondReliability = Number(second.providerReliability);
    const firstHasReliability = Number.isFinite(firstReliability);
    const secondHasReliability = Number.isFinite(secondReliability);

    if (firstHasReliability !== secondHasReliability) {
      return firstHasReliability ? -1 : 1;
    }

    if (
      firstHasReliability &&
      secondHasReliability &&
      firstReliability !== secondReliability
    ) {
      return secondReliability - firstReliability;
    }

    if (second.stock !== first.stock) {
      return second.stock - first.stock;
    }

    return first.providerCostNgn - second.providerCostNgn;
  });
}

function buildSelectionPool(candidates, percent) {
  const selectionPercent = normalizePoolPercent(percent, 50);
  const candidateLimit = getCandidateLimit(selectionPercent);

  const sortedByPrice = [...candidates].sort((first, second) => {
    if (first.providerCostNgn !== second.providerCostNgn) {
      return first.providerCostNgn - second.providerCostNgn;
    }
    return second.stock - first.stock;
  });

  const cheapestPool = sortedByPrice.slice(0, candidateLimit);
  const ranked = rankCandidatePool(cheapestPool);

  return {
    selectionPercent,
    candidateLimit,
    floorCostNgn: sortedByPrice[0]?.providerCostNgn || 0,
    ranked,
  };
}

function cacheKey({ server, country, service, selectionPercent, exchangeRate }) {
  return [server, country, service, selectionPercent, exchangeRate]
    .map((value) => String(value ?? "").trim().toLowerCase())
    .join("|");
}

function getCached(key) {
  const cached = selectionCache.get(key);
  if (!cached) return null;

  if (Date.now() > cached.expiresAt) {
    selectionCache.delete(key);
    return null;
  }

  return cached;
}

function putCached(key, value) {
  selectionCache.set(key, {
    ...value,
    expiresAt: Date.now() + getCacheTtlMs(),
  });
}

async function quoteOperator({ server, country, service, operator }) {
  const quote = await providerManager.getPrice({
    server,
    country,
    service,
    operator,
  });

  const price = Number(quote?.price);
  const stock = Number(quote?.stock);

  if (!Number.isFinite(price) || price <= 0) {
    const error = new Error("The selected operator returned an invalid price");
    error.status = 502;
    error.code = "INVALID_PRICE";
    throw error;
  }

  if (Number.isFinite(stock) && stock <= 0) {
    const error = new Error("The selected operator has no stock");
    error.status = 409;
    error.code = "NO_NUMBERS";
    throw error;
  }

  return quote;
}

function summarizeCandidate(item) {
  return {
    operator: item.operator,
    providerCostNgn: item.providerCostNgn,
    stock: item.stock,
    providerTier: item.providerTier || null,
    providerRank: item.providerRank ?? null,
    providerSalesCount: item.providerSalesCount ?? null,
    providerReliability:
      Number.isFinite(item.providerReliability)
        ? item.providerReliability
        : null,
    providerStatsSource: item.providerStatsSource || null,
  };
}

async function buildFreshSelection({
  server,
  country,
  service,
  maxPriceBufferPercent = 50,
  excludeOperators = [],
}) {
  const response = await providerManager.getOperators({
    server,
    country,
    service,
  });

  const currency = response?.currency || "NGN";
  const excludedOperators = normalizeExcludedOperators(excludeOperators);

  const candidates = (
    Array.isArray(response?.operators) ? response.operators : []
  )
    .map((item) => normalizeCandidate(item, currency))
    .filter(Boolean)
    .filter((item) => !excludedOperators.has(item.operator));

  if (!candidates.length) {
    const error = new Error(
      excludedOperators.size
        ? "No fallback operator with live stock is currently available"
        : "No operator with live stock is currently available"
    );
    error.status = 409;
    error.code = "NO_NUMBERS";
    throw error;
  }

  const pool = buildSelectionPool(candidates, maxPriceBufferPercent);

  if (!pool.ranked.length) {
    const error = new Error("No automatic operator candidate is currently available");
    error.status = 409;
    error.code = "NO_NUMBERS";
    throw error;
  }

  let lastError = null;

  for (const candidate of pool.ranked) {
    try {
      const quote = await quoteOperator({
        server,
        country,
        service,
        operator: candidate.operator,
      });

      const freshCostNgn = pricingService.convertProviderCostToNaira(
        quote.price,
        quote.currency
      );

      const selected = {
        ...candidate,
        providerCostNgn: freshCostNgn,
      };

      const providerStatsAvailable =
        Boolean(selected.providerTier) ||
        (selected.providerRank !== null &&
          selected.providerRank !== undefined &&
          Number.isFinite(Number(selected.providerRank))) ||
        (selected.providerReliability !== null &&
          selected.providerReliability !== undefined &&
          Number.isFinite(Number(selected.providerReliability)));

      return {
        operator: candidate.operator,
        quote,
        selected,
        candidateCount: candidates.length,
        eligibleCount: pool.ranked.length,
        candidateLimit: pool.candidateLimit,
        selectionPercent: pool.selectionPercent,
        maxPriceBufferPercent: pool.selectionPercent,
        floorCostNgn: pool.floorCostNgn,

        /*
         * This must be the ACTUAL selected operator cost. The operator-pool
         * percentage is selection-only and is never allowed to inflate price.
         */
        pricingBasisNgn: freshCostNgn,

        providerTier: selected.providerTier || null,
        providerRank: selected.providerRank ?? null,
        providerSalesCount: selected.providerSalesCount ?? null,
        providerReliability:
          Number.isFinite(selected.providerReliability)
            ? selected.providerReliability
            : null,
        providerStatsSource: selected.providerStatsSource || null,
        providerStatsAvailable,
        cheapPool: pool.ranked.map(summarizeCandidate),
        strategy: providerStatsAvailable
          ? "cheapest_n_smsbower_provider_ranking"
          : "cheapest_n_live_stock_fallback",
      };
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) throw lastError;

  const error = new Error("No automatic operator could provide a valid live quote");
  error.status = 409;
  error.code = "NO_NUMBERS";
  throw error;
}

async function resolveAutomaticQuote({
  server,
  country,
  service,
  maxPriceBufferPercent = 50,
}) {
  const exchangeRate = await pricingService.getExchangeRate();
  const selectionPercent = normalizePoolPercent(maxPriceBufferPercent, 50);
  const key = cacheKey({
    server,
    country,
    service,
    selectionPercent,
    exchangeRate: exchangeRate.rate,
  });

  const cached = getCached(key);

  if (cached?.operator) {
    try {
      const quote = await quoteOperator({
        server,
        country,
        service,
        operator: cached.operator,
      });

      const costNgn = pricingService.convertProviderCostToNaira(
        quote.price,
        quote.currency
      );

      return {
        ...cached,
        quote,
        pricingBasisNgn: costNgn,
        selected: cached.selected
          ? { ...cached.selected, providerCostNgn: costNgn }
          : null,
        strategy: `${cached.strategy}_cached`,
      };
    } catch {
      selectionCache.delete(key);
    }
  }

  try {
    const selection = await buildFreshSelection({
      server,
      country,
      service,
      maxPriceBufferPercent: selectionPercent,
    });

    putCached(key, {
      operator: selection.operator,
      selected: selection.selected,
      candidateCount: selection.candidateCount,
      eligibleCount: selection.eligibleCount,
      candidateLimit: selection.candidateLimit,
      selectionPercent: selection.selectionPercent,
      maxPriceBufferPercent: selection.maxPriceBufferPercent,
      floorCostNgn: selection.floorCostNgn,
      pricingBasisNgn: selection.pricingBasisNgn,
      providerTier: selection.providerTier,
      providerRank: selection.providerRank,
      providerSalesCount: selection.providerSalesCount,
      providerReliability: selection.providerReliability,
      providerStatsSource: selection.providerStatsSource,
      providerStatsAvailable: selection.providerStatsAvailable,
      cheapPool: selection.cheapPool,
      strategy: selection.strategy,
    });

    return selection;
  } catch (operatorError) {
    /*
     * Read-only fallback only. If operator-list/statistics lookup is temporarily
     * unavailable, keep pricing usable with the provider's normal quote. The
     * selector percentage still never changes the selling-price basis.
     */
    try {
      const quote = await providerManager.getPrice({
        server,
        country,
        service,
        operator: "any",
      });

      const providerCostNgn = pricingService.convertProviderCostToNaira(
        quote.price,
        quote.currency
      );

      return {
        operator:
          String(quote?.operator || "any").trim().toLowerCase() || "any",
        quote,
        selected: null,
        candidateCount: 0,
        eligibleCount: 0,
        candidateLimit: getCandidateLimit(selectionPercent),
        selectionPercent,
        maxPriceBufferPercent: selectionPercent,
        floorCostNgn: providerCostNgn,
        pricingBasisNgn: providerCostNgn,
        providerTier: null,
        providerRank: null,
        providerSalesCount: null,
        providerReliability: null,
        providerStatsSource: null,
        providerStatsAvailable: false,
        cheapPool: [],
        strategy: "provider_any_fallback",
      };
    } catch {
      throw operatorError;
    }
  }
}


async function resolveFixedOperatorFallbackQuote({
  server,
  country,
  service,
  excludeOperators = [],
  maxPriceBufferPercent = 100,
}) {
  /*
   * Fixed-operator failover deliberately bypasses the normal selection cache.
   * We need a fresh provider list after the preferred fixed operator reports
   * NO_NUMBERS/NO_STOCK so we do not immediately select that same operator
   * from stale cached data.
   *
   * The fallback still follows the normal selector:
   *   1. Keep only live-stock operators with valid prices.
   *   2. Consider the cheapest N candidates.
   *   3. Prefer SMSBower provider-side ranking/statistics when available.
   *   4. Otherwise prefer live stock, then lower cost.
   */
  const selection = await buildFreshSelection({
    server,
    country,
    service,
    maxPriceBufferPercent,
    excludeOperators,
  });

  return {
    ...selection,
    strategy: `fixed_operator_failover_${selection.strategy}`,
  };
}

module.exports = {
  resolveAutomaticQuote,
  resolveFixedOperatorFallbackQuote,
  normalizePoolPercent,
  getCandidateLimit,
};