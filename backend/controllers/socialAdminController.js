const crypto = require("node:crypto");

const SocialProduct = require(
  "../models/SocialProduct"
);

const SocialCatalogRule = require(
  "../models/SocialCatalogRule"
);

const HouseStockItem = require(
  "../models/HouseStockItem"
);

const SocialOrder = require(
  "../models/SocialOrder"
);

const SocialPricingRule = require(
  "../models/SocialPricingRule"
);

const socialPricingService = require(
  "../services/socialPricingService"
);

const PROVIDERS = new Set([
  "sameeha",
  "loggsplug",
]);

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

function normalizeProvider(value) {
  const provider =
    String(value || "")
      .trim()
      .toLowerCase();

  if (!PROVIDERS.has(provider)) {
    const error =
      new Error(
        "Invalid social provider"
      );

    error.status = 400;
    error.code =
      "INVALID_SOCIAL_PROVIDER";

    throw error;
  }

  return provider;
}

function positiveNumber(
  value,
  {
    field = "value",
    allowZero = true,
  } = {}
) {
  const parsed = Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed < 0 ||
    (!allowZero &&
      parsed <= 0)
  ) {
    const error =
      new Error(
        `Enter a valid ${field}`
      );

    error.status = 400;
    error.code =
      "INVALID_SOCIAL_VALUE";

    throw error;
  }

  return parsed;
}

function productRuleKey(
  provider,
  providerProductId
) {
  return `product:${provider}:${String(
    providerProductId
  ).trim()}`;
}

function categoryRuleKey(
  provider,
  category
) {
  return `category:${provider}:${slugify(
    category
  )}`;
}

function getAlternativeKey(
  item
) {
  return `${item.provider}:${item.providerProductId}`;
}

function getProviderAlternatives(
  product
) {
  const alternatives =
    Array.isArray(
      product?.alternatives
    )
      ? product.alternatives
      : [];

  const values = [
    ...alternatives.map(
      (item) => ({
        provider:
          String(
            item.provider || ""
          ),
        providerProductId:
          String(
            item.providerProductId ||
              ""
          ),
        providerCurrency:
          String(
            item.providerCurrency ||
              "NGN"
          ),
        providerUnitPrice:
          Number(
            item.providerUnitPrice ||
              0
          ),
        providerCostNgn:
          Number(
            item.providerCostNgn ||
              0
          ),
        stock:
          Number(
            item.stock || 0
          ),
        inStock:
          Boolean(
            item.inStock
          ),
      })
    ),
  ];

  const primary = {
    provider:
      String(
        product?.provider || ""
      ),
    providerProductId:
      String(
        product?.providerProductId ||
          ""
      ),
    providerCurrency:
      String(
        product?.providerCurrency ||
          "NGN"
      ),
    providerUnitPrice:
      Number(
        product?.providerUnitPrice ||
          0
      ),
    providerCostNgn:
      Number(
        product?.providerCostNgn ||
          0
      ),
    stock:
      Number(
        product?.stock || 0
      ),
    inStock:
      Boolean(
        product?.inStock
      ),
  };

  if (
    PROVIDERS.has(
      primary.provider
    ) &&
    primary.providerProductId
  ) {
    values.push(primary);
  }

  const deduped =
    new Map();

  for (const value of values) {
    if (
      !PROVIDERS.has(
        value.provider
      ) ||
      !value.providerProductId
    ) {
      continue;
    }

    deduped.set(
      getAlternativeKey(value),
      value
    );
  }

  return [
    ...deduped.values(),
  ];
}

async function loadHiddenRuleKeys() {
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

function isHidden({
  provider,
  category,
  providerProductId,
  hiddenRuleKeys,
}) {
  return (
    hiddenRuleKeys.has(
      categoryRuleKey(
        provider,
        category
      )
    ) ||
    hiddenRuleKeys.has(
      productRuleKey(
        provider,
        providerProductId
      )
    )
  );
}

async function syncHouseStock(
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

function normalizeInventoryLines(
  value
) {
  const raw =
    Array.isArray(value)
      ? value
      : String(value || "")
          .split(/\r?\n/);

  const unique =
    new Map();

  for (const entry of raw) {
    const details =
      String(entry || "")
        .trim();

    if (!details) {
      continue;
    }

    const contentHash =
      crypto
        .createHash("sha256")
        .update(details)
        .digest("hex");

    if (
      !unique.has(
        contentHash
      )
    ) {
      unique.set(
        contentHash,
        details
      );
    }
  }

  return [
    ...unique.entries(),
  ].map(
    ([
      contentHash,
      details,
    ]) => ({
      contentHash,
      details,
    })
  );
}

async function addInventoryItems({
  productId,
  items,
}) {
  const normalized =
    normalizeInventoryLines(
      items
    );

  if (
    normalized.length === 0
  ) {
    return {
      added: 0,
      duplicates: 0,
      stock:
        await syncHouseStock(
          productId
        ),
    };
  }

  const operations =
    normalized.map(
      (item) => ({
        updateOne: {
          filter: {
            product:
              productId,
            contentHash:
              item.contentHash,
          },

          update: {
            $setOnInsert: {
              product:
                productId,
              details:
                item.details,
              contentHash:
                item.contentHash,
              status:
                "available",
            },
          },

          upsert: true,
        },
      })
    );

  const result =
    await HouseStockItem
      .bulkWrite(
        operations,
        {
          ordered: false,
        }
      );

  const added =
    Number(
      result.upsertedCount ||
        0
    );

  const stock =
    await syncHouseStock(
      productId
    );

  return {
    added,
    duplicates:
      Math.max(
        0,
        normalized.length -
          added
      ),
    stock,
  };
}

function sanitizeHouseProduct(
  product,
  counts = {}
) {
  return {
    id:
      String(
        product?._id ||
          ""
      ),

    name:
      product?.name || "",

    category:
      product?.category ||
      "Other",

    costPrice:
      Number(
        product
          ?.providerCostNgn ||
          0
      ),

    sellingPrice:
      Number(
        product
          ?.sellingPrice ||
          0
      ),

    stock:
      Number(
        counts.available ??
          product?.stock ??
          0
      ),

    sold:
      Number(
        counts.sold || 0
      ),

    reserved:
      Number(
        counts.reserved || 0
      ),

    isActive:
      Boolean(
        product?.isActive
      ),

    createdAt:
      product?.createdAt,

    updatedAt:
      product?.updatedAt,
  };
}

/* =========================================================
   PROVIDER CATALOG VISIBILITY
========================================================= */

exports.getAdminCatalog =
  async (req, res) => {
    try {
      const [
        products,
        hiddenRuleKeys,
      ] =
        await Promise.all([
          SocialProduct
            .find({
              provider: {
                $in: [
                  "sameeha",
                  "loggsplug",
                ],
              },

              isActive: true,
            })
            .sort({
              category: 1,
              name: 1,
            })
            .lean(),

          loadHiddenRuleKeys(),
        ]);

      const variants = [];
      const categoryMap =
        new Map();

      for (
        const product of
        products
      ) {
        const alternatives =
          getProviderAlternatives(
            product
          );

        for (
          const alternative of
          alternatives
        ) {
          const categoryHidden =
            hiddenRuleKeys.has(
              categoryRuleKey(
                alternative.provider,
                product.category
              )
            );

          const productHidden =
            hiddenRuleKeys.has(
              productRuleKey(
                alternative.provider,
                alternative
                  .providerProductId
              )
            );

          variants.push({
            id:
              `${alternative.provider}:${alternative.providerProductId}`,

            provider:
              alternative.provider,

            providerProductId:
              alternative
                .providerProductId,

            name:
              product.name,

            category:
              product.category,

            providerCurrency:
              alternative
                .providerCurrency,

            providerUnitPrice:
              Number(
                alternative
                  .providerUnitPrice ||
                  0
              ),

            providerCostNgn:
              Number(
                alternative
                  .providerCostNgn ||
                  0
              ),

            stock:
              Number(
                alternative.stock ||
                  0
              ),

            inStock:
              Boolean(
                alternative
                  .inStock &&
                  Number(
                    alternative
                      .stock ||
                      0
                  ) > 0
              ),

            visible:
              !categoryHidden &&
              !productHidden,

            hiddenByCategory:
              categoryHidden,

            hiddenByProduct:
              productHidden,
          });

          const categoryId =
            `${alternative.provider}:${slugify(
              product.category
            )}`;

          if (
            !categoryMap.has(
              categoryId
            )
          ) {
            categoryMap.set(
              categoryId,
              {
                id:
                  categoryId,

                provider:
                  alternative
                    .provider,

                category:
                  product
                    .category,

                visible:
                  !categoryHidden,

                productCount: 0,
              }
            );
          }

          categoryMap.get(
            categoryId
          ).productCount += 1;
        }
      }

      return res.json({
        success: true,

        categories: [
          ...categoryMap.values(),
        ].sort(
          (a, b) =>
            a.category.localeCompare(
              b.category
            )
        ),

        products:
          variants.sort(
            (a, b) =>
              a.category.localeCompare(
                b.category
              ) ||
              a.name.localeCompare(
                b.name
              ) ||
              a.provider.localeCompare(
                b.provider
              )
          ),
      });
    } catch (error) {
      console.error(
        "Load social admin catalog error:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          code:
            "SOCIAL_ADMIN_CATALOG_FAILED",
          message:
            "Unable to load social catalog controls.",
        });
    }
  };

exports.setVisibility =
  async (req, res) => {
    try {
      const scope =
        String(
          req.body?.scope ||
            ""
        )
          .trim()
          .toLowerCase();

      if (
        ![
          "category",
          "product",
        ].includes(scope)
      ) {
        return res
          .status(400)
          .json({
            success: false,
            code:
              "INVALID_VISIBILITY_SCOPE",
            message:
              "Visibility scope must be category or product.",
          });
      }

      const provider =
        normalizeProvider(
          req.body?.provider
        );

      const visible =
        req.body?.visible !==
        false;

      let ruleKey = "";
      let category = "";
      let categoryKey = "";
      let providerProductId =
        "";

      if (
        scope ===
        "category"
      ) {
        category =
          normalizeText(
            req.body?.category
          );

        if (!category) {
          return res
            .status(400)
            .json({
              success: false,
              code:
                "CATEGORY_REQUIRED",
              message:
                "Category is required.",
            });
        }

        categoryKey =
          slugify(category);

        ruleKey =
          categoryRuleKey(
            provider,
            category
          );
      } else {
        providerProductId =
          String(
            req.body
              ?.providerProductId ||
              ""
          ).trim();

        if (
          !providerProductId
        ) {
          return res
            .status(400)
            .json({
              success: false,
              code:
                "PROVIDER_PRODUCT_REQUIRED",
              message:
                "Provider product ID is required.",
            });
        }

        ruleKey =
          productRuleKey(
            provider,
            providerProductId
          );
      }

      if (visible) {
        await SocialCatalogRule
          .deleteOne({
            ruleKey,
          });
      } else {
        await SocialCatalogRule
          .findOneAndUpdate(
            {
              ruleKey,
            },

            {
              $set: {
                ruleKey,
                scope,
                provider,
                category,
                categoryKey,
                providerProductId,
                hidden: true,
                updatedBy:
                  req.user?._id ||
                  null,
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

      return res.json({
        success: true,
        scope,
        provider,
        category,
        providerProductId,
        visible,
      });
    } catch (error) {
      console.error(
        "Update social visibility error:",
        error
      );

      return res
        .status(
          Number(
            error?.status
          ) || 500
        )
        .json({
          success: false,
          code:
            error?.code ||
            "SOCIAL_VISIBILITY_UPDATE_FAILED",
          message:
            error?.message ||
            "Unable to update social visibility.",
        });
    }
  };

/* =========================================================
   HOUSE STOCK
========================================================= */

exports.getHouseProducts =
  async (req, res) => {
    try {
      const products =
        await SocialProduct
          .find({
            sourceType:
              "house",
          })
          .sort({
            createdAt: -1,
          })
          .lean();

      const productIds =
        products.map(
          (product) =>
            product._id
        );

      const grouped =
        productIds.length
          ? await HouseStockItem
              .aggregate([
                {
                  $match: {
                    product: {
                      $in:
                        productIds,
                    },
                  },
                },

                {
                  $group: {
                    _id: {
                      product:
                        "$product",
                      status:
                        "$status",
                    },

                    count: {
                      $sum: 1,
                    },
                  },
                },
              ])
          : [];

      const countsByProduct =
        new Map();

      for (
        const row of grouped
      ) {
        const productId =
          String(
            row?._id
              ?.product ||
              ""
          );

        if (
          !countsByProduct.has(
            productId
          )
        ) {
          countsByProduct.set(
            productId,
            {
              available: 0,
              reserved: 0,
              sold: 0,
            }
          );
        }

        const status =
          String(
            row?._id
              ?.status ||
              ""
          );

        if (
          [
            "available",
            "reserved",
            "sold",
          ].includes(status)
        ) {
          countsByProduct.get(
            productId
          )[status] =
            Number(
              row.count || 0
            );
        }
      }

      return res.json({
        success: true,

        products:
          products.map(
            (product) =>
              sanitizeHouseProduct(
                product,
                countsByProduct.get(
                  String(
                    product._id
                  )
                )
              )
          ),
      });
    } catch (error) {
      console.error(
        "Load house stock products error:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          code:
            "HOUSE_STOCK_LOAD_FAILED",
          message:
            "Unable to load house stock.",
        });
    }
  };

exports.createHouseProduct =
  async (req, res) => {
    try {
      const name =
        normalizeText(
          req.body?.name
        );

      const category =
        normalizeText(
          req.body?.category
        );

      if (
        !name ||
        !category
      ) {
        return res
          .status(400)
          .json({
            success: false,
            code:
              "HOUSE_PRODUCT_DETAILS_REQUIRED",
            message:
              "Product name and category are required.",
          });
      }

      const costPrice =
        positiveNumber(
          req.body?.costPrice ??
            req.body
              ?.providerCostNgn ??
            0,
          {
            field:
              "cost price",
          }
        );

      const sellingPrice =
        positiveNumber(
          req.body
            ?.sellingPrice,
          {
            field:
              "selling price",
            allowZero: false,
          }
        );

      const product =
        new SocialProduct({
          sourceType:
            "house",

          catalogKey:
            `house::${slugify(
              category
            )}::${slugify(
              name
            )}::${crypto
              .randomBytes(5)
              .toString("hex")}`,

          name,
          category,

          provider:
            "house",

          providerProductId:
            "pending",

          providerCurrency:
            "NGN",

          providerUnitPrice:
            costPrice,

          providerCostNgn:
            costPrice,

          sellingPrice,

          stock: 0,
          inStock: false,
          alternatives: [],
          isActive:
            req.body
              ?.isActive !==
            false,
          lastSyncedAt:
            new Date(),
        });

      product.providerProductId =
        String(
          product._id
        );

      await product.save();

      const inventory =
        await addInventoryItems(
          {
            productId:
              product._id,

            items:
              req.body?.items ??
              req.body
                ?.stockText ??
              [],
          }
        );

      const refreshed =
        await SocialProduct
          .findById(
            product._id
          )
          .lean();

      return res
        .status(201)
        .json({
          success: true,

          message:
            "House stock product created.",

          inventory,

          product:
            sanitizeHouseProduct(
              refreshed,
              {
                available:
                  inventory.stock,
              }
            ),
        });
    } catch (error) {
      console.error(
        "Create house stock product error:",
        error
      );

      return res
        .status(
          Number(
            error?.status
          ) || 500
        )
        .json({
          success: false,
          code:
            error?.code ||
            "HOUSE_PRODUCT_CREATE_FAILED",
          message:
            error?.message ||
            "Unable to create house stock product.",
        });
    }
  };

exports.updateHouseProduct =
  async (req, res) => {
    try {
      const product =
        await SocialProduct
          .findOne({
            _id:
              req.params.id,
            sourceType:
              "house",
          });

      if (!product) {
        return res
          .status(404)
          .json({
            success: false,
            code:
              "HOUSE_PRODUCT_NOT_FOUND",
            message:
              "House stock product not found.",
          });
      }

      if (
        req.body?.name !==
        undefined
      ) {
        const name =
          normalizeText(
            req.body.name
          );

        if (!name) {
          return res
            .status(400)
            .json({
              success: false,
              message:
                "Product name cannot be empty.",
            });
        }

        product.name =
          name;
      }

      if (
        req.body?.category !==
        undefined
      ) {
        const category =
          normalizeText(
            req.body.category
          );

        if (!category) {
          return res
            .status(400)
            .json({
              success: false,
              message:
                "Category cannot be empty.",
            });
        }

        product.category =
          category;
      }

      if (
        req.body?.costPrice !==
        undefined
      ) {
        const cost =
          positiveNumber(
            req.body
              .costPrice,
            {
              field:
                "cost price",
            }
          );

        product
          .providerUnitPrice =
          cost;

        product
          .providerCostNgn =
          cost;
      }

      if (
        req.body
          ?.sellingPrice !==
        undefined
      ) {
        product.sellingPrice =
          positiveNumber(
            req.body
              .sellingPrice,
            {
              field:
                "selling price",
              allowZero: false,
            }
          );
      }

      if (
        req.body?.isActive !==
        undefined
      ) {
        product.isActive =
          Boolean(
            req.body
              .isActive
          );
      }

      product.lastSyncedAt =
        new Date();

      await product.save();

      const stock =
        await syncHouseStock(
          product._id
        );

      return res.json({
        success: true,
        message:
          "House stock product updated.",
        product:
          sanitizeHouseProduct(
            product,
            {
              available:
                stock,
            }
          ),
      });
    } catch (error) {
      console.error(
        "Update house stock product error:",
        error
      );

      return res
        .status(
          Number(
            error?.status
          ) || 500
        )
        .json({
          success: false,
          code:
            error?.code ||
            "HOUSE_PRODUCT_UPDATE_FAILED",
          message:
            error?.message ||
            "Unable to update house stock product.",
        });
    }
  };

exports.addHouseStock =
  async (req, res) => {
    try {
      const product =
        await SocialProduct
          .findOne({
            _id:
              req.params.id,
            sourceType:
              "house",
          });

      if (!product) {
        return res
          .status(404)
          .json({
            success: false,
            code:
              "HOUSE_PRODUCT_NOT_FOUND",
            message:
              "House stock product not found.",
          });
      }

      const inventory =
        await addInventoryItems(
          {
            productId:
              product._id,

            items:
              req.body?.items ??
              req.body
                ?.stockText ??
              [],
          }
        );

      return res.json({
        success: true,
        message:
          `${inventory.added} new item${
            inventory.added ===
            1
              ? ""
              : "s"
          } added.`,

        ...inventory,
      });
    } catch (error) {
      console.error(
        "Add house stock error:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          code:
            "HOUSE_STOCK_ADD_FAILED",
          message:
            "Unable to add house stock.",
        });
    }
  };


/* =========================================================
   SOCIAL PRICING RULES
========================================================= */

function serializeSocialPricingRule(rule) {
  if (!rule) return null;

  return {
    id: String(rule._id || rule.id || ""),
    scope: rule.scope,
    provider: rule.provider,
    providerProductId: rule.providerProductId || "",
    productName: rule.productName || "",
    category: rule.category || "",
    pricingEnabled: Boolean(rule.pricingEnabled),
    pricingMode: rule.pricingMode || "markup",
    markupPercent: Number(rule.markupPercent || 0),
    fixedSellingPrice: Number(rule.fixedSellingPrice || 0),
    minimumSellingPrice: Number(rule.minimumSellingPrice || 0),
    note: rule.note || "",
    logoUrl: rule.logoUrl || "",
    updatedAt: rule.updatedAt || null,
  };
}

exports.getSocialPricing = async (req, res) => {
  try {
    const rules = await SocialPricingRule.find({})
      .sort({ provider: 1, scope: 1, category: 1, productName: 1 })
      .lean();

    const globals = {};
    const productRules = [];

    for (const rule of rules) {
      if (rule.scope === "global") {
        globals[rule.provider] = serializeSocialPricingRule(rule);
      } else {
        productRules.push(serializeSocialPricingRule(rule));
      }
    }

    for (const provider of ["loggsplug", "sameeha"]) {
      if (!globals[provider]) {
        globals[provider] = {
          id: "",
          scope: "global",
          provider,
          providerProductId: "",
          productName: "",
          category: "",
          pricingEnabled: true,
          pricingMode: "markup",
          markupPercent: Number(process.env.SOCIAL_MARKUP_PERCENT || 0),
          fixedSellingPrice: 0,
          minimumSellingPrice: Number(
            process.env.SOCIAL_MINIMUM_SELLING_PRICE_NGN || 0
          ),
          note: "",
          logoUrl: "",
          updatedAt: null,
        };
      }
    }

    return res.json({
      success: true,
      globals,
      productRules,
    });
  } catch (error) {
    console.error("Load social pricing failed:", error);
    return res.status(500).json({
      success: false,
      code: "SOCIAL_PRICING_LOAD_FAILED",
      message: "Unable to load social pricing rules.",
    });
  }
};

exports.saveSocialGlobalPricing = async (req, res) => {
  try {
    const provider = normalizeProvider(req.body?.provider);
    const markupPercent = positiveNumber(req.body?.markupPercent, {
      field: "markup percentage",
      allowZero: true,
    });
    const minimumSellingPrice = positiveNumber(
      req.body?.minimumSellingPrice ?? 0,
      { field: "minimum selling price", allowZero: true }
    );

    const rule = await SocialPricingRule.findOneAndUpdate(
      { ruleKey: socialPricingService.globalRuleKey(provider) },
      {
        $set: {
          scope: "global",
          provider,
          providerProductId: "",
          pricingEnabled: true,
          pricingMode: "markup",
          markupPercent,
          fixedSellingPrice: 0,
          minimumSellingPrice,
          updatedBy: req.user?._id || null,
        },
      },
      {
        upsert: true,
        returnDocument: "after",
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    return res.json({
      success: true,
      rule: serializeSocialPricingRule(rule),
      message: "Social markup saved.",
    });
  } catch (error) {
    return res.status(error.status || 400).json({
      success: false,
      code: error.code || "SOCIAL_GLOBAL_PRICING_SAVE_FAILED",
      message: error.message || "Unable to save social markup.",
    });
  }
};

exports.saveSocialProductRule = async (req, res) => {
  try {
    const provider = normalizeProvider(req.body?.provider);
    const providerProductId = String(req.body?.providerProductId || "").trim();

    if (!providerProductId) {
      return res.status(400).json({
        success: false,
        code: "SOCIAL_PRODUCT_ID_REQUIRED",
        message: "Choose a social product.",
      });
    }

    const pricingMode =
      String(req.body?.pricingMode || "markup").trim().toLowerCase() === "fixed"
        ? "fixed"
        : "markup";

    const pricingEnabled = req.body?.pricingEnabled !== false;
    const markupPercent = positiveNumber(req.body?.markupPercent ?? 0, {
      field: "markup percentage",
      allowZero: true,
    });
    const fixedSellingPrice = positiveNumber(
      req.body?.fixedSellingPrice ?? 0,
      { field: "selling price", allowZero: true }
    );

    if (pricingEnabled && pricingMode === "fixed" && fixedSellingPrice <= 0) {
      return res.status(400).json({
        success: false,
        code: "SOCIAL_FIXED_PRICE_REQUIRED",
        message: "Enter a fixed selling price greater than zero.",
      });
    }

    const rule = await SocialPricingRule.findOneAndUpdate(
      {
        ruleKey: socialPricingService.productRuleKey(
          provider,
          providerProductId
        ),
      },
      {
        $set: {
          scope: "product",
          provider,
          providerProductId,
          productName: normalizeText(req.body?.productName),
          category: normalizeText(req.body?.category),
          pricingEnabled,
          pricingMode,
          markupPercent,
          fixedSellingPrice,
          note: String(req.body?.note || "").trim(),
          logoUrl: String(req.body?.logoUrl || "").trim(),
          updatedBy: req.user?._id || null,
        },
      },
      {
        upsert: true,
        returnDocument: "after",
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    return res.json({
      success: true,
      rule: serializeSocialPricingRule(rule),
      message: "Social product rule saved.",
    });
  } catch (error) {
    return res.status(error.status || 400).json({
      success: false,
      code: error.code || "SOCIAL_PRODUCT_RULE_SAVE_FAILED",
      message: error.message || "Unable to save social product rule.",
    });
  }
};

exports.deleteSocialProductRule = async (req, res) => {
  try {
    const provider = normalizeProvider(req.params?.provider);
    const providerProductId = String(req.params?.providerProductId || "").trim();

    await SocialPricingRule.deleteOne({
      ruleKey: socialPricingService.productRuleKey(
        provider,
        providerProductId
      ),
    });

    return res.json({
      success: true,
      message: "Product override removed. Global pricing now applies.",
    });
  } catch (error) {
    return res.status(error.status || 400).json({
      success: false,
      code: error.code || "SOCIAL_PRODUCT_RULE_DELETE_FAILED",
      message: error.message || "Unable to remove social product rule.",
    });
  }
};

/* =========================================================
   SOCIAL PROVIDER BALANCES + DASHBOARD METRICS
========================================================= */

async function fetchJson(url, { headers = {}, timeoutMs = 15000 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json", ...headers },
      signal: controller.signal,
    });

    const raw = await response.text();
    let data = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = { raw };
    }

    if (!response.ok) {
      throw new Error(
        data?.detail || data?.message || data?.error || `HTTP ${response.status}`
      );
    }

    return data;
  } finally {
    clearTimeout(timeout);
  }
}

function parseProviderBalanceValue(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const cleaned = String(value ?? "")
    .replace(/,/g, "")
    .replace(/[^0-9+\-.]/g, "")
    .trim();

  if (!cleaned) return null;

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractProviderBalance(payload) {
  const preferredKeys = [
    "balance",
    "wallet_balance",
    "walletBalance",
    "available_balance",
    "availableBalance",
    "credit",
    "credits",
    "funds",
  ];

  const queue = [{ value: payload, depth: 0 }];
  const seen = new Set();

  while (queue.length) {
    const { value, depth } = queue.shift();
    if (!value || typeof value !== "object" || seen.has(value) || depth > 4) continue;
    seen.add(value);

    for (const key of preferredKeys) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        const parsed = parseProviderBalanceValue(value[key]);
        if (parsed !== null) return parsed;
      }
    }

    for (const child of Object.values(value)) {
      if (child && typeof child === "object") queue.push({ value: child, depth: depth + 1 });
    }
  }

  return null;
}

async function getSameehaBalance() {
  const baseUrl = String(
    process.env.SAMEEHA_API_BASE_URL || "https://sameehasocialhub.com/api/v1"
  ).replace(/\/+$/, "");
  const apiKey = String(process.env.SAMEEHA_API_KEY || "").trim();

  if (!apiKey) throw new Error("SAMEEHA_API_KEY is missing");

  const data = await fetchJson(`${baseUrl}/balance`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  const balance = extractProviderBalance(data);
  return {
    provider: "sameeha",
    name: "SameehaSocialHub Reseller",
    healthy: Number.isFinite(balance),
    balance: Number.isFinite(balance) ? balance : null,
    currency: String(data?.currency || data?.data?.currency || "NGN").toUpperCase(),
  };
}

async function getLoggsplugBalance() {
  const baseUrl = String(
    process.env.LOGGSPLUG_API_BASE_URL || "https://loggsplug.online/api/reseller"
  ).replace(/\/+$/, "");
  const apiKey = String(process.env.LOGGSPLUG_API_KEY || "").trim();

  if (!apiKey) throw new Error("LOGGSPLUG_API_KEY is missing");

  let data;

  try {
    data = await fetchJson(`${baseUrl}/me`, {
      headers: { "X-Api-Key": apiKey },
    });
  } catch (xApiKeyError) {
    // LoggsPlug also supports Bearer authentication on reseller endpoints.
    // Retry with Bearer before declaring the admin balance unavailable.
    try {
      data = await fetchJson(`${baseUrl}/me`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
    } catch (bearerError) {
      const error = new Error(
        bearerError?.message ||
        xApiKeyError?.message ||
        "Unable to load LoggsPlug balance"
      );
      throw error;
    }
  }

  const balance = extractProviderBalance(data);
  return {
    provider: "loggsplug",
    name: "LoggsPlug Reseller",
    healthy: Number.isFinite(balance),
    balance: Number.isFinite(balance) ? balance : null,
    currency: "NGN",
  };
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

exports.getSocialAdminSummary = async (req, res) => {
  try {
    const todayStart = getLagosDayStart();
    const [metrics, balanceResults] = await Promise.all([
      SocialOrder.aggregate([
        {
          $facet: {
            orderCount: [{ $count: "count" }],
            todayOrderCount: [
              { $match: { createdAt: { $gte: todayStart } } },
              { $count: "count" },
            ],
            completedFinancials: [
              {
                $match: {
                  status: "completed",
                  refunded: { $ne: true },
                },
              },
              {
                $group: {
                  _id: null,
                  revenue: { $sum: { $ifNull: ["$sellingPrice", 0] } },
                  cost: { $sum: { $ifNull: ["$providerCostNgn", 0] } },
                  profit: { $sum: { $ifNull: ["$profit", 0] } },
                  completedOrders: { $sum: 1 },
                },
              },
            ],
            todayCompletedFinancials: [
              {
                $match: {
                  createdAt: { $gte: todayStart },
                  status: "completed",
                  refunded: { $ne: true },
                },
              },
              {
                $group: {
                  _id: null,
                  revenue: { $sum: { $ifNull: ["$sellingPrice", 0] } },
                  cost: { $sum: { $ifNull: ["$providerCostNgn", 0] } },
                  profit: { $sum: { $ifNull: ["$profit", 0] } },
                  completedOrders: { $sum: 1 },
                },
              },
            ],
            statuses: [
              { $group: { _id: "$status", count: { $sum: 1 } } },
            ],
          },
        },
      ]),
      Promise.allSettled([getLoggsplugBalance(), getSameehaBalance()]),
    ]);

    const result = metrics?.[0] || {};
    const financials = result?.completedFinancials?.[0] || {};
    const todayFinancials = result?.todayCompletedFinancials?.[0] || {};
    const statuses = Object.fromEntries(
      (result?.statuses || []).map((item) => [item._id, Number(item.count || 0)])
    );

    const balances = balanceResults.map((result, index) => {
      const provider = index === 0 ? "loggsplug" : "sameeha";
      const name =
        provider === "loggsplug"
          ? "LoggsPlug Reseller"
          : "SameehaSocialHub Reseller";

      if (result.status === "fulfilled") return result.value;

      return {
        provider,
        name,
        healthy: false,
        balance: null,
        currency: "NGN",
        message: result.reason?.message || "Balance unavailable",
      };
    });

    return res.json({
      success: true,
      summary: {
        totalOrders: Number(result?.orderCount?.[0]?.count || 0),
        completedOrders: Number(financials.completedOrders || 0),
        totalRevenue: Number(financials.revenue || 0),
        totalCost: Number(financials.cost || 0),
        totalProfit: Number(financials.profit || 0),
        todayOrders: Number(result?.todayOrderCount?.[0]?.count || 0),
        todayRevenue: Number(todayFinancials.revenue || 0),
        todayCost: Number(todayFinancials.cost || 0),
        todayProfit: Number(todayFinancials.profit || 0),
        processingOrders: statuses.processing || 0,
        failedOrders: statuses.failed || 0,
        refundedOrders: statuses.refunded || 0,
        reviewRequiredOrders: statuses.review_required || 0,
        providerBalances: balances,
      },
    });
  } catch (error) {
    console.error("Social admin summary failed:", error);
    return res.status(500).json({
      success: false,
      code: "SOCIAL_ADMIN_SUMMARY_FAILED",
      message: "Unable to load social dashboard metrics.",
    });
  }
};

/* =========================================================
   ADMIN SOCIAL ORDERS
========================================================= */

exports.getAdminSocialOrders = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query?.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query?.limit, 10) || 25));
    const status = String(req.query?.status || "").trim().toLowerCase();
    const search = String(req.query?.search || "").trim();

    const filter = {};
    if (status && status !== "all") filter.status = status;

    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "i");
      filter.$or = [
        { productName: regex },
        { category: regex },
        { providerOrderId: regex },
      ];
    }

    const [orders, total] = await Promise.all([
      SocialOrder.find(filter)
        .populate("user", "email username firstName lastName")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      SocialOrder.countDocuments(filter),
    ]);

    const rows = orders.map((order) => ({
      id: String(order._id),
      customer: order.user
        ? {
            id: String(order.user._id || ""),
            email: order.user.email || "",
            name:
              order.user.username ||
              [order.user.firstName, order.user.lastName].filter(Boolean).join(" ") ||
              "",
          }
        : null,
      productName: order.productName,
      category: order.category,
      quantity: Number(order.quantity || 0),
      unitSellingPrice: Number(order.unitSellingPrice || 0),
      sellingPrice: Number(order.sellingPrice || 0),
      providerCostNgn: Number(order.providerCostNgn || 0),
      profit: Number(order.profit || 0),
      provider: order.provider,
      providerOrderId: order.providerOrderId || "",
      deliveredItems: getReadableDeliveredItems(
        order.deliveredItems,
        order.providerResponse
      ),
      status: order.status,
      refunded: Boolean(order.refunded),
      failureReason: order.failureReason || "",
      createdAt: order.createdAt,
      completedAt: order.completedAt,
    }));

    return res.json({
      success: true,
      orders: rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    console.error("Load admin social orders failed:", error);
    return res.status(500).json({
      success: false,
      code: "ADMIN_SOCIAL_ORDERS_FAILED",
      message: "Unable to load social orders.",
    });
  }
};