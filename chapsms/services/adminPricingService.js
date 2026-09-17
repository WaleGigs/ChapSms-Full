import { api } from "@/lib/api";

const VALID_SERVERS = new Set([
  "server1",
  "server2",
]);

function normalizeServer(value, { optional = false } = {}) {
  const server = String(value || "")
    .trim()
    .toLowerCase();

  if (!server && optional) {
    return "";
  }

  if (!VALID_SERVERS.has(server)) {
    throw new Error("Please select a valid server");
  }

  return server;
}

function appendQueryValue(query, key, value) {
  if (
    value === undefined ||
    value === null ||
    value === "" ||
    value === "all"
  ) {
    return;
  }

  query.set(key, String(value));
}

function buildQuery(values = {}) {
  const query = new URLSearchParams();

  Object.entries(values).forEach(([key, value]) => {
    appendQueryValue(query, key, value);
  });

  const queryString = query.toString();

  return queryString ? `?${queryString}` : "";
}

function normalizeRulePayload(input = {}) {
  const server = normalizeServer(input.server);
  const country = String(input.country || "").trim();
  const service = String(input.service || "").trim();
  const pricingStyle = String(
    input.pricingStyle ||
      (String(input.operator || "any").trim().toLowerCase() === "any"
        ? "cheapest_buffer"
        : "fixed_operator")
  )
    .trim()
    .toLowerCase();
  const operator =
    pricingStyle === "cheapest_buffer"
      ? "any"
      : String(input.operator || "").trim();
  const pricingMode = String(input.pricingMode || "fixed")
    .trim()
    .toLowerCase();

  if (!country) {
    throw new Error("Please select a country");
  }

  if (!service) {
    throw new Error("Please select a service");
  }

  return {
    server,
    country,
    countryName: String(input.countryName || "").trim(),
    service,
    serviceName: String(input.serviceName || "").trim(),
    operator,
    pricingStyle,
    maxPriceBufferPercent: Number(input.maxPriceBufferPercent ?? 50),
    pricingMode,
    fixedSellingPrice: Number(input.fixedSellingPrice || 0),
    markupPercent: Number(input.markupPercent || 0),
    fixedMarkup: Number(input.fixedMarkup || 0),
    minimumSellingPrice: Number(input.minimumSellingPrice || 0),
    isActive: input.isActive !== false,
    notes: String(input.notes || "").trim(),
  };
}

export const adminPricingService = {
  async getExchangeRate() {
    return api("/admin/pricing/exchange-rate");
  },

  async updateExchangeRate(rate) {
    const numericRate = Number(rate);

    if (!Number.isFinite(numericRate) || numericRate <= 0) {
      throw new Error("Enter a valid USD to NGN exchange rate");
    }

    return api("/admin/pricing/exchange-rate", {
      method: "PATCH",
      body: JSON.stringify({ rate: numericRate }),
    });
  },

  async getRules({
    page = 1,
    limit = 25,
    server = "",
    country = "",
    service = "",
    isActive = "",
  } = {}) {
    const selectedServer = normalizeServer(server, {
      optional: true,
    });

    return api(
      `/admin/pricing/rules${buildQuery({
        page,
        limit,
        server: selectedServer,
        country,
        service,
        isActive,
      })}`
    );
  },

  async getOperators({
    server,
    country,
    service,
  }) {
    const selectedServer =
      normalizeServer(server);

    const normalizedCountry =
      String(country || "").trim();

    const normalizedService =
      String(service || "").trim();

    if (
      !normalizedCountry ||
      !normalizedService
    ) {
      throw new Error(
        "Country and service are required"
      );
    }

    return api(
      `/admin/pricing/operators${buildQuery({
        server: selectedServer,
        country: normalizedCountry,
        service: normalizedService,
      })}`
    );
  },

  async saveRule(ruleData) {
    return api("/admin/pricing/rules", {
      method: "POST",
      body: JSON.stringify(
        normalizeRulePayload(ruleData)
      ),
    });
  },

  async updateRule(ruleId, ruleData) {
    const normalizedRuleId = String(ruleId || "").trim();

    if (!normalizedRuleId) {
      throw new Error("A valid pricing rule ID is required");
    }

    return api(
      `/admin/pricing/rules/${encodeURIComponent(
        normalizedRuleId
      )}`,
      {
        method: "PATCH",
        body: JSON.stringify(
          normalizeRulePayload(ruleData)
        ),
      }
    );
  },

  async disableRule(ruleId) {
    const normalizedRuleId = String(ruleId || "").trim();

    if (!normalizedRuleId) {
      throw new Error("A valid pricing rule ID is required");
    }

    return api(
      `/admin/pricing/rules/${encodeURIComponent(
        normalizedRuleId
      )}`,
      {
        method: "DELETE",
      }
    );
  },

  async previewPricing(ruleData) {
    return api("/admin/pricing/preview", {
      method: "POST",
      body: JSON.stringify(
        normalizeRulePayload(ruleData)
      ),
    });
  },

  async getSummary({
    server = "",
    dateFrom = "",
    dateTo = "",
  } = {}) {
    const selectedServer = normalizeServer(server, {
      optional: true,
    });

    return api(
      `/admin/pricing/summary${buildQuery({
        server: selectedServer,
        dateFrom,
        dateTo,
      })}`
    );
  },

  async getSales({
    page = 1,
    limit = 25,
    server = "",
    status = "",
    country = "",
    service = "",
    search = "",
    dateFrom = "",
    dateTo = "",
  } = {}) {
    const selectedServer = normalizeServer(server, {
      optional: true,
    });

    return api(
      `/admin/pricing/sales${buildQuery({
        page,
        limit,
        server: selectedServer,
        status,
        country,
        service,
        search,
        dateFrom,
        dateTo,
      })}`
    );
  },

  async getPayments({
    page = 1,
    limit = 50,
    type = "",
    status = "",
    search = "",
    dateFrom = "",
    dateTo = "",
  } = {}) {
    return api(
      `/admin/pricing/payments${buildQuery({
        page,
        limit,
        type,
        status,
        search,
        dateFrom,
        dateTo,
      })}`
    );
  },
};