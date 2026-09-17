const mongoose = require("mongoose");

const PricingRule = require("../models/PricingRule");
const Order = require("../models/Order");
const User = require("../models/User");
const Wallet = require("../models/Wallet");
const providerManager = require(
  "../services/providers/providerManager"
);
const pricingService = require(
  "../services/pricingService"
);
const automaticPricingService = require(
  "../services/automaticPricingService"
);

function parseBoolean(value, fallback = undefined) {
  if (value === undefined) {
    return fallback;
  }

  return ["true", "1", "yes"].includes(
    String(value).trim().toLowerCase()
  );
}

function parsePositiveInteger(value, fallback, maximum) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, maximum);
}

function createDateRange(query = {}) {
  const range = {};

  if (query.dateFrom) {
    const dateFrom = new Date(query.dateFrom);
    if (!Number.isNaN(dateFrom.getTime())) {
      range.$gte = dateFrom;
    }
  }

  if (query.dateTo) {
    const dateTo = new Date(query.dateTo);
    if (!Number.isNaN(dateTo.getTime())) {
      dateTo.setHours(23, 59, 59, 999);
      range.$lte = dateTo;
    }
  }

  return Object.keys(range).length ? range : null;
}

function getDashboardTrackingStartAt() {
  const value = String(
    process.env.ADMIN_DASHBOARD_START_AT || ""
  ).trim();

  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    console.warn(
      "ADMIN_DASHBOARD_START_AT is invalid. Dashboard will use all-time data."
    );
    return null;
  }

  return date;
}

function getEffectiveDashboardDateRange(query = {}) {
  const requestedRange = createDateRange(query) || {};
  const trackingStartAt = getDashboardTrackingStartAt();

  if (
    trackingStartAt &&
    (
      !requestedRange.$gte ||
      requestedRange.$gte < trackingStartAt
    )
  ) {
    requestedRange.$gte = trackingStartAt;
  }

  return Object.keys(requestedRange).length
    ? requestedRange
    : null;
}

function getLagosDayStart(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const values = Object.fromEntries(
    parts
      .filter((part) => ["year", "month", "day"].includes(part.type))
      .map((part) => [part.type, part.value])
  );

  return new Date(
    `${values.year}-${values.month}-${values.day}T00:00:00+01:00`
  );
}


function normalizeLookupKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function humanizeIdentifier(value) {
  const text = String(value ?? "").trim();

  if (!text || /^\d+$/.test(text)) {
    return "";
  }

  return text
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function unwrapProviderCollection(response, possibleKeys) {
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
      if (Object.prototype.hasOwnProperty.call(container, key)) {
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
    return Object.entries(collection);
  }

  return [];
}

function createCountryNameMap(response) {
  const rawCountries = unwrapProviderCollection(response, [
    "countries",
    "country",
    "countryList",
    "items",
  ]);
  const map = {};

  for (const [key, item] of collectionEntries(rawCountries)) {
    const objectItem =
      item && typeof item === "object" && !Array.isArray(item)
        ? item
        : {};
    const primitiveName =
      typeof item === "string" ? item.trim() : "";
    const name = String(
      objectItem.eng ??
        objectItem.name ??
        objectItem.title ??
        objectItem.label ??
        objectItem.countryName ??
        objectItem.country_name ??
        primitiveName ??
        key
    ).trim();

    if (!name) {
      continue;
    }

    const identifiers = [
      objectItem.id,
      objectItem.code,
      objectItem.iso2,
      objectItem.iso,
      objectItem.country,
      objectItem.countryCode,
      key,
    ];

    for (const identifier of identifiers) {
      const lookupKey = normalizeLookupKey(identifier);
      if (lookupKey) {
        map[lookupKey] = name;
      }
    }
  }

  return map;
}

function createServiceNameMap(response) {
  const rawServices = unwrapProviderCollection(response, [
    "services",
    "service",
    "serviceList",
    "items",
  ]);
  const map = {};

  for (const [key, item] of collectionEntries(rawServices)) {
    const objectItem =
      item && typeof item === "object" && !Array.isArray(item)
        ? item
        : {};
    const primitiveName =
      typeof item === "string" ? item.trim() : "";
    const name = String(
      objectItem.name ??
        objectItem.serviceName ??
        objectItem.title ??
        objectItem.label ??
        primitiveName ??
        key
    ).trim();

    if (!name) {
      continue;
    }

    const identifiers = [
      objectItem.id,
      objectItem.code,
      objectItem.service,
      objectItem.slug,
      key,
    ];

    for (const identifier of identifiers) {
      const lookupKey = normalizeLookupKey(identifier);
      if (lookupKey) {
        map[lookupKey] = name;
      }
    }
  }

  return map;
}

async function loadAdminDisplayMaps(servers = []) {
  const maps = {};

  await Promise.all(
    servers.map(async (server) => {
      const [countriesResult, servicesResult] =
        await Promise.allSettled([
          providerManager.getCountries({ server }),
          providerManager.getServices({ server }),
        ]);

      maps[server] = {
        countries:
          countriesResult.status === "fulfilled"
            ? createCountryNameMap(countriesResult.value)
            : {},
        services:
          servicesResult.status === "fulfilled"
            ? createServiceNameMap(servicesResult.value)
            : {},
      };
    })
  );

  return maps;
}

function getAdminCountryName(order, displayMaps) {
  const storedName = String(order?.countryName || "").trim();
  if (storedName) {
    return storedName;
  }

  const key = normalizeLookupKey(order?.country);
  const server = normalizeLookupKey(order?.server);
  const resolved = displayMaps?.[server]?.countries?.[key];

  if (resolved) {
    return resolved;
  }

  // Never expose a provider numeric country ID such as "36".
  return humanizeIdentifier(order?.country);
}

function getAdminServiceName(order, displayMaps) {
  const storedName = String(order?.serviceName || "").trim();
  if (storedName) {
    return storedName;
  }

  const key = normalizeLookupKey(order?.service);
  const server = normalizeLookupKey(order?.server);
  const resolved = displayMaps?.[server]?.services?.[key];

  return resolved || humanizeIdentifier(order?.service) || "—";
}

function ruleResponse(rule) {
  return {
    id: String(rule._id),
    server: rule.server,
    country: rule.country,
    countryName: rule.countryName,
    service: rule.service,
    serviceName: rule.serviceName,
    operator: rule.operator,
    pricingStyle:
      pricingService.normalizePricingStyle(
        rule.pricingStyle,
        rule.operator
      ),
    maxPriceBufferPercent:
      Number.isFinite(Number(rule.maxPriceBufferPercent))
        ? Number(rule.maxPriceBufferPercent)
        : 50,
    pricingMode: rule.pricingMode,
    fixedSellingPrice: rule.fixedSellingPrice,
    markupPercent: rule.markupPercent,
    fixedMarkup: rule.fixedMarkup,
    minimumSellingPrice: rule.minimumSellingPrice,
    isActive: rule.isActive,
    notes: rule.notes,
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt,
  };
}

exports.listRules = async (req, res) => {
  try {
    const page = parsePositiveInteger(req.query.page, 1, 100000);
    const limit = parsePositiveInteger(req.query.limit, 25, 100);
    const filter = {};

    if (req.query.server) {
      filter.server = pricingService.normalizeServer(req.query.server);
    }

    if (req.query.country) {
      filter.country = pricingService.normalizeCountry(req.query.country);
    }

    if (req.query.service) {
      filter.service = pricingService.normalizeService(req.query.service);
    }

    const active = parseBoolean(req.query.isActive);
    if (active !== undefined) {
      filter.isActive = active;
    }

    const [rules, total] = await Promise.all([
      PricingRule.find(filter)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      PricingRule.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      rules: rules.map(ruleResponse),
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Unable to load pricing rules",
      code: error.code || "PRICING_RULES_LOAD_FAILED",
    });
  }
};

exports.upsertRule = async (req, res) => {
  try {
    const input = pricingService.normalizeRuleInput(req.body);

    const rule = await PricingRule.findOneAndUpdate(
      {
        server: input.server,
        country: input.country,
        service: input.service,
        operator: input.operator,
      },
      {
        $set: {
          ...input,
          updatedBy: req.user._id,
        },
        $setOnInsert: {
          createdBy: req.user._id,
        },
      },
      {
        upsert: true,
        returnDocument: "after",
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    return res.status(201).json({
      success: true,
      rule: ruleResponse(rule),
      message: "Pricing rule saved successfully",
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A pricing rule already exists for this selection",
        code: "DUPLICATE_PRICING_RULE",
      });
    }

    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Unable to save pricing rule",
      code: error.code || "PRICING_RULE_SAVE_FAILED",
    });
  }
};

exports.updateRule = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid pricing rule ID",
      });
    }

    const existing = await PricingRule.findById(req.params.id);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Pricing rule not found",
      });
    }

    const input = pricingService.normalizeRuleInput({
      ...existing.toObject(),
      ...req.body,
    });

    Object.assign(existing, input, {
      updatedBy: req.user._id,
    });

    await existing.save();

    return res.json({
      success: true,
      rule: ruleResponse(existing),
      message: "Pricing rule updated successfully",
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Unable to update pricing rule",
      code: error.code || "PRICING_RULE_UPDATE_FAILED",
    });
  }
};

exports.disableRule = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid pricing rule ID",
      });
    }

    const rule = await PricingRule.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          isActive: false,
          updatedBy: req.user._id,
        },
      },
      { returnDocument: "after" }
    );

    if (!rule) {
      return res.status(404).json({
        success: false,
        message: "Pricing rule not found",
      });
    }

    return res.json({
      success: true,
      rule: ruleResponse(rule),
      message: "Pricing rule disabled",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Unable to disable pricing rule",
    });
  }
};

exports.getOperators = async (req, res) => {
  try {
    const server =
      pricingService.normalizeServer(
        req.query.server
      );

    const country =
      pricingService.normalizeCountry(
        req.query.country
      );

    const service =
      pricingService.normalizeService(
        req.query.service
      );

    if (!country || !service) {
      return res.status(400).json({
        success: false,
        message:
          "Country and service are required",
        code:
          "ADMIN_OPERATOR_SELECTION_REQUIRED",
      });
    }

    const result =
      await providerManager.getOperators({
        server,
        country,
        service,
      });

    return res.json({
      success: true,
      server:
        result?.server || server,
      country:
        result?.country || country,
      service:
        result?.service || service,
      currency:
        result?.currency || null,
      operators:
        Array.isArray(
          result?.operators
        )
          ? result.operators
          : [],
    });
  } catch (error) {
    return res
      .status(error.status || 500)
      .json({
        success: false,
        message:
          error.message ||
          "Unable to load operators",
        code:
          error.code ||
          "ADMIN_OPERATORS_LOAD_FAILED",
      });
  }
};

exports.getExchangeRate = async (_req, res) => {
  try {
    const exchangeRate = await pricingService.getExchangeRate({
      forceRefresh: true,
    });

    return res.json({
      success: true,
      exchangeRate: {
        currencyFrom: "USD",
        currencyTo: "NGN",
        ...exchangeRate,
      },
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Unable to load exchange rate",
      code: error.code || "EXCHANGE_RATE_LOAD_FAILED",
    });
  }
};

exports.updateExchangeRate = async (req, res) => {
  try {
    const exchangeRate = await pricingService.setExchangeRate(
      req.body?.rate,
      req.user?._id || null
    );

    return res.json({
      success: true,
      exchangeRate: {
        currencyFrom: "USD",
        currencyTo: "NGN",
        ...exchangeRate,
      },
      message: "USD to NGN rate updated successfully",
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Unable to update exchange rate",
      code: error.code || "EXCHANGE_RATE_UPDATE_FAILED",
    });
  }
};

exports.previewPricing = async (req, res) => {
  try {
    const server = pricingService.normalizeServer(req.body.server);
    const country = pricingService.normalizeCountry(req.body.country);
    const service = pricingService.normalizeService(req.body.service);
    const draftRule = pricingService.normalizeRuleInput(req.body);

    let operator = draftRule.operator;
    let quote;
    let automaticSelection = null;
    let pricingBasisNgn = null;

    if (draftRule.pricingStyle === "cheapest_buffer") {
      automaticSelection = await automaticPricingService.resolveAutomaticQuote({
        server,
        country,
        service,
        maxPriceBufferPercent: draftRule.maxPriceBufferPercent,
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

    const pricing = await pricingService.resolveCustomerPricing({
      server,
      country,
      service,
      countryName: String(req.body.countryName || "").trim(),
      serviceName: String(req.body.serviceName || "").trim(),
      operator,
      providerPrice: quote.price,
      providerCurrency: quote.currency,
      pricingBasisNgn,
      draftRule: req.body,
    });

    return res.json({
      success: true,
      preview: {
        server,
        country,
        service,
        operator,
        providerCost: pricing.providerPrice,
        providerCurrency: pricing.providerCurrency,
        providerCostNgn: pricing.providerCostNgn,
        exchangeRateNgnPerUsd: pricing.exchangeRateNgnPerUsd,
        floorCostNgn:
          automaticSelection?.floorCostNgn ?? pricing.providerCostNgn,
        pricingBasisNgn: pricing.pricingBasisNgn,
        sellingPrice: pricing.sellingPrice,
        profit: pricing.profit,
        stock: Number.isFinite(Number(quote.stock))
          ? Number(quote.stock)
          : 0,
        pricingMode: pricing.pricingMode,
        pricingStyle: pricing.pricingStyle,
        pricingSource: pricing.pricingSource,
        candidateCount: automaticSelection?.candidateCount || 0,
        eligibleCount: automaticSelection?.eligibleCount || 0,
        candidateLimit: automaticSelection?.candidateLimit || 0,
        selectionPercent:
          automaticSelection?.selectionPercent ??
          draftRule.maxPriceBufferPercent,
        selectionStrategy: automaticSelection?.strategy || "fixed_operator",
        providerTier: automaticSelection?.providerTier ?? null,
        providerRank: automaticSelection?.providerRank ?? null,
        providerSalesCount:
          automaticSelection?.providerSalesCount ?? null,
        providerReliability:
          automaticSelection?.providerReliability ?? null,
        providerStatsSource:
          automaticSelection?.providerStatsSource ?? null,
        providerStatsAvailable:
          automaticSelection?.providerStatsAvailable === true,

        /* Legacy response keys retained as null/zero for older admin clients. */
        otpSuccessRate: null,
        otpSuccessCount: 0,
        otpFailureCount: 0,
        otpSampleSize: 0,
        reliabilityProven: false,
        pricingRuleId: pricing.pricingRuleId
          ? String(pricing.pricingRuleId)
          : null,
      },
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Unable to preview pricing",
      code: error.code || "PRICING_PREVIEW_FAILED",
    });
  }
};
exports.getDashboardSummary = async (req, res) => {
  try {
    const match = {};
    const todayStart = getLagosDayStart();

    const effectiveDateRange =
      getEffectiveDashboardDateRange(
        req.query
      );

    if (effectiveDateRange) {
      match.createdAt =
        effectiveDateRange;
    }

    if (req.query.server) {
      match.server =
        pricingService.normalizeServer(
          req.query.server
        );
    }

    const userMatch = {
      role: "user",
    };

    if (effectiveDateRange) {
      userMatch.createdAt =
        effectiveDateRange;
    }

    const [
      orderResults,
      totalUsers,
      todayUsers,
      walletBalanceResults,
      walletDeltaResults,
      providerBalanceResults,
    ] = await Promise.all([
      Order.aggregate([
        {
          $match: match,
        },

        {
          $facet: {
            /*
             * TOTAL ORDERS
             *
             * Count EVERY order attempt.
             *
             * This intentionally includes:
             * - waiting
             * - cancelling
             * - cancelled
             * - expired
             * - received
             * - refunded orders
             *
             * This is the correct denominator for
             * delivery/success-rate metrics.
             */
            orderCount: [
              {
                $count: "count",
              },
            ],

            todayOrderCount: [
              {
                $match: {
                  createdAt: { $gte: todayStart },
                },
              },
              {
                $count: "count",
              },
            ],

            /*
             * MONEY METRICS
             *
             * Refunded orders must NOT inflate
             * revenue/cost/profit.
             */
            financialTotals: [
              {
                $match: {
                  refunded: {
                    $ne: true,
                  },
                },
              },

              {
                $group: {
                  _id: null,

                  totalRevenue: {
                    $sum: {
                      $ifNull: [
                        "$sellingPrice",
                        "$price",
                      ],
                    },
                  },

                  totalProviderCost: {
                    $sum: {
                      $ifNull: [
                        "$providerCostNgn",
                        0,
                      ],
                    },
                  },

                  totalProfit: {
                    $sum: {
                      $ifNull: [
                        "$profit",
                        0,
                      ],
                    },
                  },
                },
              },
            ],

            todayFinancialTotals: [
              {
                $match: {
                  createdAt: { $gte: todayStart },
                  refunded: { $ne: true },
                },
              },
              {
                $group: {
                  _id: null,
                  totalRevenue: {
                    $sum: { $ifNull: ["$sellingPrice", "$price"] },
                  },
                  totalProviderCost: {
                    $sum: { $ifNull: ["$providerCostNgn", 0] },
                  },
                  totalProfit: {
                    $sum: { $ifNull: ["$profit", 0] },
                  },
                },
              },
            ],

            /*
             * Count every order by status.
             */
            statuses: [
              {
                $group: {
                  _id: "$status",

                  count: {
                    $sum: 1,
                  },
                },
              },
            ],

            /*
             * RECEIVED OTP
             *
             * An order is successful when an OTP
             * was actually received.
             *
             * Do NOT remove it from this metric
             * merely because its financial state
             * was later changed.
             */
            receivedOtps: [
              {
                $match: {
                  $or: [
                    {
                      otpReceivedAt: {
                        $exists: true,
                        $ne: null,
                      },
                    },

                    {
                      status:
                        "received",
                    },
                  ],
                },
              },

              {
                $count: "count",
              },
            ],

            todayReceivedOtps: [
              {
                $match: {
                  createdAt: { $gte: todayStart },
                  $or: [
                    {
                      otpReceivedAt: { $exists: true, $ne: null },
                    },
                    { status: "received" },
                  ],
                },
              },
              { $count: "count" },
            ],

            /*
             * Existing server financial breakdown.
             *
             * Keep refunded orders out of these
             * financial figures.
             */
            servers: [
              {
                $match: {
                  refunded: {
                    $ne: true,
                  },
                },
              },

              {
                $group: {
                  _id: "$server",

                  orders: {
                    $sum: 1,
                  },

                  revenue: {
                    $sum: {
                      $ifNull: [
                        "$sellingPrice",
                        "$price",
                      ],
                    },
                  },

                  providerCost: {
                    $sum: {
                      $ifNull: [
                        "$providerCostNgn",
                        0,
                      ],
                    },
                  },

                  profit: {
                    $sum: {
                      $ifNull: [
                        "$profit",
                        0,
                      ],
                    },
                  },
                },
              },
            ],
          },
        },
      ]),

      User.countDocuments(
        userMatch
      ),

      User.countDocuments({
        role: "user",
        createdAt: { $gte: todayStart },
      }),

      Wallet.aggregate([
        {
          $lookup: {
            from: "users",
            localField: "user",
            foreignField: "_id",
            as: "customer",
          },
        },

        {
          $unwind: {
            path: "$customer",
            preserveNullAndEmptyArrays:
              false,
          },
        },

        {
          $match: {
            "customer.role":
              "user",

            ...(effectiveDateRange
              ? {
                  "customer.createdAt":
                    effectiveDateRange,
                }
              : {}),
          },
        },

        {
          $group: {
            _id: null,

            usersBalance: {
              $sum: {
                $ifNull: [
                  "$balance",
                  0,
                ],
              },
            },
          },
        },
      ]),

      Wallet.aggregate([
        { $unwind: "$transactions" },
        {
          $lookup: {
            from: "users",
            localField: "user",
            foreignField: "_id",
            as: "customer",
          },
        },
        { $unwind: "$customer" },
        {
          $match: {
            "customer.role": "user",
            "transactions.createdAt": { $gte: todayStart },
          },
        },
        {
          $group: {
            _id: null,
            delta: {
              $sum: {
                $switch: {
                  branches: [
                    {
                      case: {
                        $and: [
                          { $eq: ["$transactions.type", "deposit"] },
                          { $eq: ["$transactions.status", "completed"] },
                        ],
                      },
                      then: { $ifNull: ["$transactions.amount", 0] },
                    },
                    {
                      case: { $eq: ["$transactions.type", "refund"] },
                      then: { $ifNull: ["$transactions.amount", 0] },
                    },
                    {
                      case: {
                        $in: ["$transactions.type", ["purchase", "withdraw"]],
                      },
                      then: {
                        $multiply: [
                          { $ifNull: ["$transactions.amount", 0] },
                          -1,
                        ],
                      },
                    },
                  ],
                  default: 0,
                },
              },
            },
          },
        },
      ]),

      /*
       * Fetch SMSBower + BenOTP balances.
       *
       * providerManager already uses
       * Promise.allSettled internally, so one
       * unavailable provider does not have to
       * destroy the whole dashboard.
       */
      providerManager
        .getProviderBalances()
        .catch((error) => {
          console.error(
            "Unable to load provider balances:",
            error
          );

          return [];
        }),
    ]);

    const result =
      orderResults?.[0] || {};

    const financialTotals =
      result?.financialTotals?.[0] || {
        totalRevenue: 0,
        totalProviderCost: 0,
        totalProfit: 0,
      };

    const todayFinancialTotals =
      result?.todayFinancialTotals?.[0] || {
        totalRevenue: 0,
        totalProviderCost: 0,
        totalProfit: 0,
      };

    /*
     * IMPORTANT:
     * This is now EVERY order matching the
     * dashboard period, including cancelled/
     * refunded/expired orders.
     */
    const totalOrders =
      Number(
        result?.orderCount?.[0]
          ?.count || 0
      );

    const todayOrders =
      Number(
        result?.todayOrderCount?.[0]
          ?.count || 0
      );

    const statuses =
      Object.fromEntries(
        (
          result?.statuses || []
        ).map((item) => [
          item._id,
          Number(
            item.count || 0
          ),
        ])
      );

    const servers =
      Object.fromEntries(
        (
          result?.servers || []
        ).map((item) => [
          item._id,

          {
            orders:
              Number(
                item.orders || 0
              ),

            revenue:
              Number(
                item.revenue || 0
              ),

            providerCost:
              Number(
                item.providerCost ||
                  0
              ),

            profit:
              Number(
                item.profit || 0
              ),
          },
        ])
      );

    const receivedOtps =
      Number(
        result?.receivedOtps?.[0]
          ?.count || 0
      );

    const todayReceivedOtps =
      Number(
        result?.todayReceivedOtps?.[0]
          ?.count || 0
      );

    const usersBalance =
      Number(
        walletBalanceResults?.[0]
          ?.usersBalance || 0
      );

    const todayUsersBalanceDelta =
      Number(walletDeltaResults?.[0]?.delta || 0);

    /*
     * Useful metric for later:
     *
     * Received OTPs / Every Order × 100
     */
    const otpSuccessRate =
      totalOrders > 0
        ? Number(
            (
              (
                receivedOtps /
                totalOrders
              ) *
              100
            ).toFixed(2)
          )
        : 0;

    /*
     * Admin-safe provider balance representation.
     *
     * Provider identities remain private from
     * CUSTOMER endpoints, but this is the
     * authenticated ADMIN dashboard.
     */
    const providerNames = {
      server1: "SMSBower",
      server2: "BenOTP",
    };

    const defaultCurrencies = {
      server1: "USD",
      server2: "NGN",
    };

    const providerBalances =
      Array.isArray(
        providerBalanceResults
      )
        ? providerBalanceResults.map(
            (item) => {
              const numericBalance =
                Number(
                  item?.balance
                );

              return {
                server:
                  item?.server || "",

                name:
                  providerNames[
                    item?.server
                  ] ||
                  item?.server ||
                  "Provider",

                enabled:
                  item?.enabled !==
                  false,

                healthy:
                  Boolean(
                    item?.healthy
                  ),

                balance:
                  Number.isFinite(
                    numericBalance
                  )
                    ? numericBalance
                    : null,

                currency:
                  String(
                    item?.currency ||
                      defaultCurrencies[
                        item?.server
                      ] ||
                      ""
                  )
                    .trim()
                    .toUpperCase(),

                message:
                  String(
                    item?.message ||
                      ""
                  ),
              };
            }
          )
        : [];

    /*
     * Guarantee both cards exist even if one
     * provider's balance request fails.
     */
    const balanceByServer =
      Object.fromEntries(
        providerBalances.map(
          (item) => [
            item.server,
            item,
          ]
        )
      );

    const safeProviderBalances = [
      balanceByServer.server1 || {
        server: "server1",
        name: "SMSBower",
        enabled: true,
        healthy: false,
        balance: null,
        currency: "USD",
        message:
          "Balance unavailable",
      },

      balanceByServer.server2 || {
        server: "server2",
        name: "BenOTP",
        enabled: true,
        healthy: false,
        balance: null,
        currency: "NGN",
        message:
          "Balance unavailable",
      },
    ];

    const trackingStartAt =
      getDashboardTrackingStartAt();

    return res.json({
      success: true,

      summary: {
        /*
         * Financial metrics.
         */
        totalRevenue:
          Number(
            financialTotals
              .totalRevenue || 0
          ),

        totalProviderCost:
          Number(
            financialTotals
              .totalProviderCost ||
              0
          ),

        totalCost:
          Number(
            financialTotals
              .totalProviderCost ||
              0
          ),

        totalProfit:
          Number(
            financialTotals
              .totalProfit || 0
          ),

        todayRevenue:
          Number(todayFinancialTotals.totalRevenue || 0),

        todayProviderCost:
          Number(todayFinancialTotals.totalProviderCost || 0),

        todayCost:
          Number(todayFinancialTotals.totalProviderCost || 0),

        todayProfit:
          Number(todayFinancialTotals.totalProfit || 0),

        /*
         * Order metrics.
         */
        totalOrders,
        todayOrders,
        receivedOtps,
        todayReceivedOtps,
        otpSuccessRate,

        waitingOrders:
          statuses.waiting || 0,

        cancellingOrders:
          statuses.cancelling ||
          0,

        receivedOrders:
          statuses.received || 0,

        cancelledOrders:
          statuses.cancelled ||
          0,

        expiredOrders:
          statuses.expired || 0,

        /*
         * User metrics.
         */
        totalUsers:
          Number(
            totalUsers || 0
          ),

        todayUsers:
          Number(todayUsers || 0),

        usersBalance,

        todayUsersBalanceDelta,

        /*
         * SMS provider balances.
         */
        providerBalances:
          safeProviderBalances,

        /*
         * Existing server breakdown.
         */
        server1:
          servers.server1 || {
            orders: 0,
            revenue: 0,
            providerCost: 0,
            profit: 0,
          },

        server2:
          servers.server2 || {
            orders: 0,
            revenue: 0,
            providerCost: 0,
            profit: 0,
          },

        trackingStartAt:
          trackingStartAt
            ? trackingStartAt.toISOString()
            : null,
      },
    });
  } catch (error) {
    console.error(
      "Admin dashboard summary failed:",
      error
    );

    return res
      .status(
        error.status || 500
      )
      .json({
        success: false,

        message:
          error.message ||
          "Unable to load dashboard summary",
      });
  }
};

exports.getSales = async (req, res) => {
  try {
    const page = parsePositiveInteger(req.query.page, 1, 100000);
    const limit = parsePositiveInteger(req.query.limit, 25, 100);
    const filter = {};
    const dateRange = createDateRange(req.query);

    if (dateRange) {
      filter.createdAt = dateRange;
    }

    if (req.query.server) {
      filter.server = pricingService.normalizeServer(req.query.server);
    }

    if (req.query.status) {
      filter.status = String(req.query.status).trim().toLowerCase();
    }

    if (req.query.country) {
      filter.country = pricingService.normalizeCountry(req.query.country);
    }

    if (req.query.service) {
      filter.service = pricingService.normalizeService(req.query.service);
    }

    if (req.query.search) {
      const search = String(req.query.search).trim();
      filter.$or = [
        { customerEmail: { $regex: search, $options: "i" } },
        { phoneNumber: { $regex: search, $options: "i" } },
        { otpCode: { $regex: search, $options: "i" } },
      ];
    }

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("user", "firstName lastName email")
        .lean(),
      Order.countDocuments(filter),
    ]);

    const servers = [
      ...new Set(
        orders
          .map((order) => normalizeLookupKey(order?.server))
          .filter((server) =>
            ["server1", "server2"].includes(server)
          )
      ),
    ];

    const displayMaps = await loadAdminDisplayMaps(servers);

    const sales = orders.map((order) => ({
      id: String(order._id),
      server: order.server,
      customer: {
        id: order.user?._id ? String(order.user._id) : null,
        firstName: order.user?.firstName || "",
        lastName: order.user?.lastName || "",
        email: order.customerEmail || order.user?.email || "",
      },
      country: order.country,
      countryName: getAdminCountryName(order, displayMaps),
      service: order.service,
      serviceName: getAdminServiceName(order, displayMaps),
      operator: order.operator,
      phoneNumber: order.phoneNumber,
      otpCode: order.otpCode,
      status: order.status,
      providerCost: order.providerPrice,
      providerCurrency: order.providerCurrency,
      providerCostNgn: order.providerCostNgn,
      sellingPrice: order.sellingPrice || order.price,
      profit: order.profit,
      refunded: order.refunded,
      financialStatus: order.financialStatus,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      otpReceivedAt: order.otpReceivedAt,
    }));

    return res.json({
      success: true,
      sales,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Unable to load sales records",
    });
  }
};

exports.getPayments = async (req, res) => {
  try {
    const page = parsePositiveInteger(
      req.query.page,
      1,
      100000
    );
    const limit = parsePositiveInteger(
      req.query.limit,
      50,
      100
    );

    const match = {};

    if (req.query.type) {
      match["transactions.type"] =
        String(req.query.type)
          .trim()
          .toLowerCase();
    }

    if (req.query.status) {
      match["transactions.status"] =
        String(req.query.status)
          .trim()
          .toLowerCase();
    }

    const dateRange =
      createDateRange(req.query);

    if (dateRange) {
      match["transactions.createdAt"] =
        dateRange;
    }

    const search = String(
      req.query.search || ""
    ).trim();

    const pipeline = [
      {
        $unwind:
          "$transactions",
      },
      ...(Object.keys(match).length
        ? [{ $match: match }]
        : []),
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "customer",
        },
      },
      {
        $unwind: {
          path: "$customer",
          preserveNullAndEmptyArrays:
            true,
        },
      },
      {
        $lookup: {
          from: "orders",
          localField:
            "transactions.orderId",
          foreignField: "_id",
          as: "linkedOrder",
        },
      },
      {
        $unwind: {
          path: "$linkedOrder",
          preserveNullAndEmptyArrays:
            true,
        },
      },
      ...(search
        ? [
            {
              $match: {
                $or: [
                  {
                    "customer.email": {
                      $regex: search,
                      $options: "i",
                    },
                  },
                  {
                    "customer.username": {
                      $regex: search,
                      $options: "i",
                    },
                  },
                  {
                    "transactions.reference": {
                      $regex: search,
                      $options: "i",
                    },
                  },
                  {
                    "transactions.transactionId": {
                      $regex: search,
                      $options: "i",
                    },
                  },
                  {
                    "transactions.description": {
                      $regex: search,
                      $options: "i",
                    },
                  },
                  {
                    "transactions.paymentGateway": {
                      $regex: search,
                      $options: "i",
                    },
                  },
                  {
                    "linkedOrder.serviceName": {
                      $regex: search,
                      $options: "i",
                    },
                  },
                  {
                    "linkedOrder.countryName": {
                      $regex: search,
                      $options: "i",
                    },
                  },
                ],
              },
            },
          ]
        : []),
      {
        $sort: {
          "transactions.createdAt":
            -1,
        },
      },
      {
        $facet: {
          rows: [
            {
              $skip:
                (page - 1) *
                limit,
            },
            {
              $limit:
                limit,
            },
            {
              $project: {
                _id: 0,
                id: {
                  $toString:
                    "$transactions._id",
                },
                walletId: {
                  $toString:
                    "$_id",
                },
                userId: {
                  $toString:
                    "$user",
                },
                customer: {
                  username:
                    "$customer.username",
                  firstName:
                    "$customer.firstName",
                  lastName:
                    "$customer.lastName",
                  email:
                    "$customer.email",
                },
                type:
                  "$transactions.type",
                amount:
                  "$transactions.amount",
                status:
                  "$transactions.status",
                reference:
                  "$transactions.reference",
                transactionId:
                  "$transactions.transactionId",
                gateway:
                  "$transactions.paymentGateway",
                method:
                  "$transactions.paymentMethod",
                description:
                  "$transactions.description",
                server: {
                  $ifNull: [
                    "$transactions.server",
                    "$linkedOrder.server",
                  ],
                },
                orderId: {
                  $cond: [
                    {
                      $ne: [
                        "$transactions.orderId",
                        null,
                      ],
                    },
                    {
                      $toString:
                        "$transactions.orderId",
                    },
                    null,
                  ],
                },
                service:
                  "$linkedOrder.service",
                country:
                  "$linkedOrder.country",
                serviceName: {
                  $ifNull: [
                    "$transactions.serviceName",
                    "$linkedOrder.serviceName",
                  ],
                },
                countryName: {
                  $ifNull: [
                    "$transactions.countryName",
                    "$linkedOrder.countryName",
                  ],
                },
                environment:
                  "$transactions.environment",
                createdAt:
                  "$transactions.createdAt",
              },
            },
          ],
          meta: [
            {
              $count:
                "total",
            },
          ],
        },
      },
    ];

    const [result] =
      await Wallet.aggregate(
        pipeline
      );

    const payments =
      result?.rows || [];

    const total =
      result?.meta?.[0]?.total ||
      0;

    return res.json({
      success: true,
      payments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(
          1,
          Math.ceil(
            total / limit
          )
        ),
      },
    });
  } catch (error) {
    console.error(
      "Admin wallet payments error:",
      error
    );

    return res
      .status(
        error.status || 500
      )
      .json({
        success: false,
        message:
          error.message ||
          "Unable to load latest payment history",
      });
  }
};