import {
  api,
} from "@/lib/api";

function normalizeQuantity(
  value
) {
  const quantity =
    Number.parseInt(
      value,
      10
    );

  if (
    !Number.isFinite(
      quantity
    ) ||
    quantity <= 0
  ) {
    throw new Error(
      "Enter a valid quantity"
    );
  }

  return quantity;
}

function normalizeId(
  value,
  message =
    "A valid ID is required"
) {
  const id =
    String(value || "")
      .trim();

  if (!id) {
    throw new Error(
      message
    );
  }

  return id;
}

export const socialService = {
  /* =========================
     CUSTOMER
  ========================= */

  async getCatalog() {
    const response =
      await api(
        "/social/catalog"
      );

    return {
      products:
        Array.isArray(
          response?.products
        )
          ? response.products
          : [],

      categories:
        Array.isArray(
          response?.categories
        )
          ? response.categories
          : [],

      stale:
        Boolean(
          response?.stale
        ),
    };
  },

  async getOrders() {
    const response =
      await api(
        "/social/orders"
      );

    return Array.isArray(
      response?.orders
    )
      ? response.orders
      : [];
  },

  async buyProduct({
    productId,
    quantity = 1,
  }) {
    const normalizedProductId =
      normalizeId(
        productId,
        "Please select a product"
      );

    return api(
      "/social/orders",
      {
        method: "POST",

        body:
          JSON.stringify({
            productId:
              normalizedProductId,

            quantity:
              normalizeQuantity(
                quantity
              ),
          }),
      }
    );
  },

  async refreshCatalog() {
    return api(
      "/social/refresh",
      {
        method: "POST",
      }
    );
  },

  /* =========================
     ADMIN — PROVIDER CATALOG
  ========================= */

  async getAdminCatalog() {
    const response =
      await api(
        "/social/admin/catalog"
      );

    return {
      categories:
        Array.isArray(
          response?.categories
        )
          ? response.categories
          : [],

      products:
        Array.isArray(
          response?.products
        )
          ? response.products
          : [],
    };
  },

  async setVisibility({
    scope,
    provider,
    category = "",
    providerProductId = "",
    visible,
  }) {
    return api(
      "/social/admin/visibility",
      {
        method: "PATCH",

        body:
          JSON.stringify({
            scope,
            provider,
            category,
            providerProductId,
            visible:
              Boolean(
                visible
              ),
          }),
      }
    );
  },

  /* =========================
     ADMIN — HOUSE STOCK
  ========================= */

  async getHouseProducts() {
    const response =
      await api(
        "/social/admin/house-products"
      );

    return Array.isArray(
      response?.products
    )
      ? response.products
      : [];
  },

  async createHouseProduct({
    name,
    category,
    costPrice,
    sellingPrice,
    stockText = "",
    isActive = true,
  }) {
    return api(
      "/social/admin/house-products",
      {
        method: "POST",

        body:
          JSON.stringify({
            name,
            category,
            costPrice,
            sellingPrice,
            stockText,
            isActive,
          }),
      }
    );
  },

  async updateHouseProduct(
    productId,
    payload
  ) {
    const id =
      normalizeId(
        productId
      );

    return api(
      `/social/admin/house-products/${encodeURIComponent(
        id
      )}`,
      {
        method: "PATCH",

        body:
          JSON.stringify(
            payload || {}
          ),
      }
    );
  },

  async addHouseStock(
    productId,
    stockText
  ) {
    const id =
      normalizeId(
        productId
      );

    return api(
      `/social/admin/house-products/${encodeURIComponent(
        id
      )}/stock`,
      {
        method: "POST",

        body:
          JSON.stringify({
            stockText:
              String(
                stockText || ""
              ),
          }),
      }
    );
  },

  /* =========================
     ADMIN — SOCIAL PRICING
  ========================= */

  async getAdminPricing() {
    return api("/social/admin/pricing");
  },

  async saveGlobalPricing({
    provider,
    markupPercent,
    minimumSellingPrice = 0,
  }) {
    return api("/social/admin/pricing/global", {
      method: "PUT",
      body: JSON.stringify({
        provider,
        markupPercent: Number(markupPercent || 0),
        minimumSellingPrice: Number(minimumSellingPrice || 0),
      }),
    });
  },

  async saveProductRule(payload) {
    return api("/social/admin/pricing/product", {
      method: "PUT",
      body: JSON.stringify(payload || {}),
    });
  },

  async deleteProductRule(provider, providerProductId) {
    const safeProvider = normalizeId(provider, "Provider is required");
    const safeProductId = normalizeId(providerProductId, "Product is required");

    return api(
      `/social/admin/pricing/product/${encodeURIComponent(safeProvider)}/${encodeURIComponent(safeProductId)}`,
      { method: "DELETE" }
    );
  },

  async getAdminSummary() {
    const response = await api("/social/admin/summary");
    return response?.summary || null;
  },

  async getAdminOrders({
    page = 1,
    limit = 25,
    status = "",
    search = "",
  } = {}) {
    const query = new URLSearchParams();
    query.set("page", String(page));
    query.set("limit", String(limit));
    if (status && status !== "all") query.set("status", status);
    if (search) query.set("search", search);
    return api(`/social/admin/orders?${query.toString()}`);
  },

};