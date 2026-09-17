const SocialPricingRule = require("../models/SocialPricingRule");

const VALID_PROVIDERS = new Set(["sameeha", "loggsplug"]);

function normalizeProvider(value) {
  const provider = String(value || "").trim().toLowerCase();
  if (!VALID_PROVIDERS.has(provider)) {
    const error = new Error("Invalid social provider");
    error.status = 400;
    error.code = "INVALID_SOCIAL_PROVIDER";
    throw error;
  }
  return provider;
}

function normalizeId(value) {
  return String(value || "").trim();
}

function safeNonNegative(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function globalRuleKey(provider) {
  return `global:${normalizeProvider(provider)}`;
}

function productRuleKey(provider, providerProductId) {
  return `product:${normalizeProvider(provider)}:${normalizeId(providerProductId)}`;
}

function roundUpToNextHundred(value) {
  const number = safeNonNegative(value, 0);
  if (number <= 0) return 0;
  return Math.ceil(number / 100) * 100;
}

function getEnvironmentDefaultMarkup() {
  return safeNonNegative(process.env.SOCIAL_MARKUP_PERCENT, 0);
}

function getEnvironmentMinimumPrice() {
  return safeNonNegative(
    process.env.SOCIAL_MINIMUM_SELLING_PRICE_NGN,
    0
  );
}

async function loadPricingIndex() {
  const rules = await SocialPricingRule.find({}).lean();
  const globals = new Map();
  const products = new Map();

  for (const rule of rules) {
    if (rule.scope === "global") {
      globals.set(rule.provider, rule);
      continue;
    }

    if (rule.scope === "product" && rule.providerProductId) {
      products.set(
        `${rule.provider}:${rule.providerProductId}`,
        rule
      );
    }
  }

  return { globals, products };
}

function resolveFromIndex({
  provider,
  providerProductId,
  providerCostNgn,
  index,
}) {
  const normalizedProvider = normalizeProvider(provider);
  const productId = normalizeId(providerProductId);
  const cost = safeNonNegative(providerCostNgn, 0);

  const productRule =
    index?.products?.get(`${normalizedProvider}:${productId}`) || null;
  const globalRule = index?.globals?.get(normalizedProvider) || null;

  const minimumSellingPrice = Math.max(
    getEnvironmentMinimumPrice(),
    safeNonNegative(globalRule?.minimumSellingPrice, 0)
  );

  let pricingSource = "global";
  let pricingMode = "markup";
  let markupPercent = safeNonNegative(
    globalRule?.markupPercent,
    getEnvironmentDefaultMarkup()
  );
  let fixedSellingPrice = 0;

  if (productRule?.pricingEnabled === true) {
    pricingSource = "product_override";
    pricingMode =
      String(productRule.pricingMode || "markup").toLowerCase() === "fixed"
        ? "fixed"
        : "markup";

    if (pricingMode === "fixed") {
      fixedSellingPrice = safeNonNegative(
        productRule.fixedSellingPrice,
        0
      );
    } else {
      markupPercent = safeNonNegative(productRule.markupPercent, 0);
    }
  }

  let sellingPrice;

  if (pricingMode === "fixed" && fixedSellingPrice > 0) {
    sellingPrice = fixedSellingPrice;
  } else {
    sellingPrice = roundUpToNextHundred(
      cost * (1 + markupPercent / 100)
    );
  }

  sellingPrice = Math.max(sellingPrice, minimumSellingPrice);

  return {
    sellingPrice,
    pricingSource,
    pricingMode,
    markupPercent,
    minimumSellingPrice,
    note: String(productRule?.note || ""),
    logoUrl: String(productRule?.logoUrl || ""),
  };
}

async function resolvePrice(args) {
  const index = args.index || (await loadPricingIndex());
  return resolveFromIndex({ ...args, index });
}

module.exports = {
  normalizeProvider,
  globalRuleKey,
  productRuleKey,
  roundUpToNextHundred,
  loadPricingIndex,
  resolveFromIndex,
  resolvePrice,
};