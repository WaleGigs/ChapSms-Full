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

export const catalogService = {
  async getCatalog({
    server = "server1",
    refresh = false,
  } = {}) {
    const selectedServer =
      normalizeServer(server);

    const query =
      new URLSearchParams();

    query.set(
      "server",
      selectedServer
    );

    if (refresh) {
      query.set(
        "refresh",
        "true"
      );
    }

    return api(
      `/catalog?${query.toString()}`
    );
  },

  async getPrice({
    server,
    country,
    countryName = "",
    service,
    serviceName = "",
    operator = "any",
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

    const query =
      new URLSearchParams({
        server: selectedServer,
        country:
          normalizedCountry,
        service:
          normalizedService,
        operator:
          String(
            operator || "any"
          ),
      });

    const normalizedCountryName =
      String(countryName || "").trim();

    const normalizedServiceName =
      String(serviceName || "").trim();

    if (normalizedCountryName) {
      query.set(
        "countryName",
        normalizedCountryName
      );
    }

    if (normalizedServiceName) {
      query.set(
        "serviceName",
        normalizedServiceName
      );
    }

    return api(
      `/catalog/price?${query.toString()}`
    );
  },
};