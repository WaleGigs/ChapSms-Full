import { api } from "@/lib/api";

const VALID_SERVERS = new Set([
  "server1",
  "server2",
]);

function normalizeServer(value) {
  const server = String(value || "")
    .trim()
    .toLowerCase();

  if (!VALID_SERVERS.has(server)) {
    throw new Error(
      "Please select a valid server"
    );
  }

  return server;
}

function normalizeOrderData(
  orderData = {}
) {
  const server = normalizeServer(
    orderData.server
  );

  const country = String(
    orderData.country || ""
  ).trim();

  const countryName = String(
    orderData.countryName || ""
  ).trim();

  const service = String(
    orderData.service || ""
  ).trim();

  const serviceName = String(
    orderData.serviceName || ""
  ).trim();

  const operator = String(
    orderData.operator || "any"
  ).trim();

  if (!country) {
    throw new Error(
      "Please select a country"
    );
  }

  if (!service) {
    throw new Error(
      "Please select a service"
    );
  }

  return {
    server,
    country,
    countryName,
    service,
    serviceName,
    operator: operator || "any",
  };
}

export const orderService = {
  async createOrder(orderData) {
    const payload =
      normalizeOrderData(orderData);

    return api("/orders", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async recoverPendingPurchases() {
    return api("/orders/recover-pending", {
      method: "POST",
    });
  },

  async getOrders() {
    const response =
      await api("/orders");

    return Array.isArray(
      response?.orders
    )
      ? response.orders
      : [];
  },

  async getOrder(orderId) {
    const normalizedOrderId =
      String(orderId || "").trim();

    if (!normalizedOrderId) {
      throw new Error(
        "A valid order ID is required"
      );
    }

    const response = await api(
      `/orders/${encodeURIComponent(
        normalizedOrderId
      )}`
    );

    return response?.order || null;
  },

  async checkOrder(orderId) {
    const normalizedOrderId =
      String(orderId || "").trim();

    if (!normalizedOrderId) {
      throw new Error(
        "A valid order ID is required"
      );
    }

    const response = await api(
      `/orders/${encodeURIComponent(
        normalizedOrderId
      )}/check`
    );

    return response?.order || null;
  },

  async cancelOrder(orderId) {
    const normalizedOrderId =
      String(orderId || "").trim();

    if (!normalizedOrderId) {
      throw new Error(
        "A valid order ID is required"
      );
    }

    return api(
      `/orders/${encodeURIComponent(
        normalizedOrderId
      )}/cancel`,
      {
        method: "POST",
      }
    );
  },
};
