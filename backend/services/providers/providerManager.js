const smsbower = require("./smsBower");
const benotp = require("./benOtp");

/**
 * Public server identifiers mapped to private SMS providers.
 *
 * Customers and frontend applications should only see:
 * - server1
 * - server2
 *
 * The real provider identities must remain internal.
 */
const SERVER_PROVIDER_MAP = Object.freeze({
  server1: {
    providerName: "smsbower",
    client: smsbower,
  },

  server2: {
    providerName: "benotp",
    client: benotp,
  },
});

/**
 * Reverse lookup used for existing orders that still store
 * the real provider name internally in MongoDB.
 */
const PROVIDER_SERVER_MAP = Object.freeze(
  Object.fromEntries(
    Object.entries(SERVER_PROVIDER_MAP).map(
      ([serverName, configuration]) => [
        configuration.providerName,
        serverName,
      ]
    )
  )
);

/**
 * Converts any supplied identifier into a normalized,
 * lowercase string.
 */
function normalizeIdentifier(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeServerName(value) {
  return normalizeIdentifier(value);
}

function normalizeProviderName(value) {
  return normalizeIdentifier(value);
}

/**
 * Creates a standardized manager error.
 *
 * The provider field is internal metadata only.
 * Controllers must never send it to customers.
 */
function createManagerError(
  message,
  {
    code = "SERVER_MANAGER_ERROR",
    status = 500,
    retryable = false,
    server,
    provider,
    failures,
    cause,
  } = {}
) {
  const error = new Error(message);

  error.code = code;
  error.status = status;
  error.retryable = retryable;

  if (server) {
    error.server = server;
  }

  if (provider) {
    error.provider = provider;
  }

  if (failures) {
    error.failures = failures;
  }

  if (cause) {
    error.cause = cause;
  }

  return error;
}

/**
 * Resolves a public server identifier.
 *
 * Example:
 * server1 -> smsbower client
 * server2 -> benotp client
 */
function getServerConfiguration(serverName) {
  const normalizedServerName =
    normalizeServerName(serverName);

  const configuration =
    SERVER_PROVIDER_MAP[normalizedServerName];

  if (!configuration) {
    throw createManagerError(
      `Unsupported SMS server: ${serverName}`,
      {
        code: "UNSUPPORTED_SERVER",
        status: 400,
        retryable: false,
        server:
          normalizedServerName ||
          serverName,
      }
    );
  }

  return {
    serverName: normalizedServerName,
    providerName:
      configuration.providerName,
    client: configuration.client,
  };
}

/**
 * Resolves either:
 *
 * 1. A public server identifier such as server1.
 * 2. An internally stored provider name such as smsbower.
 *
 * This allows existing MongoDB orders to continue working
 * while all new public API requests use server identifiers.
 */
function resolveServerReference(reference) {
  const normalizedReference =
    normalizeIdentifier(reference);

  if (SERVER_PROVIDER_MAP[normalizedReference]) {
    return getServerConfiguration(
      normalizedReference
    );
  }

  const mappedServerName =
    PROVIDER_SERVER_MAP[normalizedReference];

  if (mappedServerName) {
    return getServerConfiguration(
      mappedServerName
    );
  }

  throw createManagerError(
    `Unsupported SMS server reference: ${reference}`,
    {
      code: "UNSUPPORTED_SERVER",
      status: 400,
      retryable: false,
      server:
        normalizedReference ||
        reference,
    }
  );
}

/**
 * Internal compatibility helper.
 *
 * Existing backend code may still call getProvider() until
 * the remaining controllers have been migrated.
 */
function getProvider(providerOrServerName) {
  return resolveServerReference(
    providerOrServerName
  ).client;
}

/**
 * Converts an internal provider name into its safe,
 * public server identifier.
 */
function getServerForProvider(providerName) {
  const normalizedProviderName =
    normalizeProviderName(providerName);

  return (
    PROVIDER_SERVER_MAP[
      normalizedProviderName
    ] || null
  );
}

/**
 * Converts a public server identifier into its internal
 * provider name.
 */
function getProviderForServer(serverName) {
  return getServerConfiguration(
    serverName
  ).providerName;
}

/**
 * Removes provider-identifying properties recursively
 * before data is returned outside providerManager.
 */
function stripProviderFields(value) {
  if (!value || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(
      stripProviderFields
    );
  }

  const sanitizedValue = {};

  for (const [key, item] of Object.entries(value)) {
    if (
      key === "provider" ||
      key === "providerName" ||
      key === "provider_name"
    ) {
      continue;
    }

    sanitizedValue[key] =
      stripProviderFields(item);
  }

  return sanitizedValue;
}

/**
 * Builds a customer-safe result containing the public
 * server identifier rather than the provider identity.
 */
function buildPublicResult(
  result,
  serverName,
  additionalFields = {}
) {
  return {
    ...stripProviderFields(result),
    ...additionalFields,
    server: serverName,
  };
}
/**
 * Returns the preferred server order.
 *
 * Supports both the new SERVER_* variables and the
 * old PROVIDER_* variables for backwards compatibility.
 */
function getServerPriority() {
  const primaryServer =
    normalizeServerName(
      process.env.PRIMARY_SERVER ||
        getServerForProvider(
          process.env.PRIMARY_PROVIDER
        ) ||
        "server1"
    );

  const secondaryServer =
    normalizeServerName(
      process.env.SECONDARY_SERVER ||
        getServerForProvider(
          process.env.SECONDARY_PROVIDER
        ) ||
        "server2"
    );

  const priority = [];

  for (const serverName of [
    primaryServer,
    secondaryServer,
    ...Object.keys(SERVER_PROVIDER_MAP),
  ]) {
    if (
      SERVER_PROVIDER_MAP[serverName] &&
      !priority.includes(serverName)
    ) {
      priority.push(serverName);
    }
  }

  if (!priority.length) {
    throw createManagerError(
      "No SMS servers are configured.",
      {
        code: "NO_SERVERS_CONFIGURED",
        status: 500,
      }
    );
  }

  return priority;
}

/**
 * Determines whether a server is enabled.
 *
 * New env variables:
 *
 * SERVER1_ENABLED=true
 * SERVER2_ENABLED=true
 *
 * Old variables still work:
 *
 * SMSBOWER_ENABLED=true
 * BENOTP_ENABLED=true
 */
function isServerEnabled(serverName) {
  const configuration =
    getServerConfiguration(serverName);

  const serverVariable =
    `${configuration.serverName.toUpperCase()}_ENABLED`;

  const providerVariable =
    `${configuration.providerName.toUpperCase()}_ENABLED`;

  const configuredValue =
    process.env[serverVariable] ??
    process.env[providerVariable] ??
    "true";

  return (
    normalizeIdentifier(configuredValue) !==
    "false"
  );
}

/**
 * Converts provider failures into a customer-safe object.
 */
function serializeFailure(
  serverName,
  error
) {
  return {
    server: serverName,

    message:
      error?.message ||
      "Server request failed.",

    code:
      error?.code ||
      "SERVER_ERROR",

    status:
      Number(error?.status) || 502,

    retryable:
      Boolean(error?.retryable),
  };
}

/**
 * Returned only after every server has failed.
 */
function createAllServersFailedError(
  failures
) {
  const details = failures
    .map(
      failure =>
        `${failure.server}: ${failure.message}`
    )
    .join(" | ");

  return createManagerError(
    details
      ? `All SMS servers failed. ${details}`
      : "All SMS servers failed.",
    {
      code: "ALL_SERVERS_FAILED",
      status: 503,
      retryable: false,
      failures,
    }
  );
}

/**
 * Executes an operation against ONE specific server.
 *
 * No failover occurs here because the customer
 * intentionally selected that server.
 */
async function executeWithSelectedServer(
  serverName,
  operationName,
  operation
) {
  const configuration =
    getServerConfiguration(serverName);

  if (
    !isServerEnabled(
      configuration.serverName
    )
  ) {
    throw createManagerError(
      `${configuration.serverName} is currently unavailable.`,
      {
        code: "SERVER_DISABLED",
        status: 503,
        server:
          configuration.serverName,
        provider:
          configuration.providerName,
      }
    );
  }

  try {
    const result =
      await operation(
        configuration.client,
        configuration.serverName,
        configuration.providerName
      );

    if (
      !result ||
      typeof result !== "object"
    ) {
      throw createManagerError(
        `${configuration.serverName} returned an invalid ${operationName} response.`,
        {
          code:
            "INVALID_SERVER_RESPONSE",

          status: 502,

          server:
            configuration.serverName,

          provider:
            configuration.providerName,
        }
      );
    }

    return buildPublicResult(
      result,
      configuration.serverName
    );
  } catch (error) {
    error.server =
      error.server ||
      configuration.serverName;

    error.provider =
      error.provider ||
      configuration.providerName;

    throw error;
  }
}

/**
 * Executes an operation with automatic failover.
 *
 * This should ONLY be used BEFORE an activation
 * has been purchased.
 */
async function executeWithFailover(
  operationName,
  operation
) {
  const failures = [];

  for (const serverName of getServerPriority()) {
    const configuration =
      getServerConfiguration(
        serverName
      );

    if (
      !isServerEnabled(serverName)
    ) {
      failures.push({
        server: serverName,
        message:
          "Server is disabled.",
        code:
          "SERVER_DISABLED",
        status: 503,
        retryable: true,
      });

      continue;
    }

    try {
      const result =
        await operation(
          configuration.client,
          configuration.serverName,
          configuration.providerName
        );

      if (
        !result ||
        typeof result !== "object"
      ) {
        throw createManagerError(
          `${serverName} returned an invalid ${operationName} response.`,
          {
            code:
              "INVALID_SERVER_RESPONSE",

            status: 502,

            retryable: true,

            server:
              configuration.serverName,

            provider:
              configuration.providerName,
          }
        );
      }

      return buildPublicResult(
        result,
        configuration.serverName
      );
    } catch (error) {
      const failure =
        serializeFailure(
          configuration.serverName,
          error
        );

      failures.push(failure);

      console.warn(
        `[providerManager] ${operationName} failed through ${configuration.serverName}`,
        failure
      );

      /**
       * Permanent failures stop immediately.
       */
      if (!error.retryable) {
        error.server =
          configuration.serverName;

        error.provider =
          configuration.providerName;

        error.failures =
          failures;

        throw error;
      }
    }
  }

  throw createAllServersFailedError(
    failures
  );
}

/**
 * Returns whichever server the customer requested.
 *
 * Public API:
 *
 * {
 *     server: "server1"
 * }
 *
 * Legacy API:
 *
 * {
 *     provider: "smsbower"
 * }
 */
function getRequestedServer(
  options = {}
) {
  if (options.server) {
    return options.server;
  }

  if (options.provider) {
    return getServerForProvider(
      options.provider
    );
  }

  return null;
}
/**
 * Purchases a virtual number.
 *
 * Public API:
 *
 * {
 *     server: "server1"
 * }
 *
 * Internal:
 *
 * server1 -> smsbower
 * server2 -> benotp
 *
 * IMPORTANT:
 * Once a number has been purchased, the provider that owns the
 * activation is stored internally so future polling, SMS retrieval,
 * cancellation and completion always go to the correct provider.
 */
async function buyNumber(options = {}) {
  const requestedServer =
    getRequestedServer(options);

  /**
   * Never pass server/provider identifiers directly
   * to provider SDKs.
   */
  const providerOptions = {
    ...options,
  };

  delete providerOptions.server;
  delete providerOptions.provider;

  /**
   * Executes one purchase attempt.
   */
  const operation = async (
    providerClient,
    serverName,
    providerName
  ) => {
    let quotedPrice = null;

    /**
     * Ask the provider for a live price first.
     */
    if (
      typeof providerClient.getPrice ===
      "function"
    ) {
      quotedPrice =
        await providerClient.getPrice(
          providerOptions
        );
    }

    /**
     * Purchase the number.
     */
    const purchase =
      await providerClient.buyNumber(
        providerOptions
      );

    /**
     * ChapsSmS currently supports only
     * one activation per order.
     */
    if (
      purchase?.orders &&
      Array.isArray(purchase.orders)
    ) {
      throw createManagerError(
        "Bulk provider responses are not supported.",
        {
          code:
            "BULK_ORDER_NOT_SUPPORTED",

          status: 400,

          retryable: false,

          server: serverName,

          provider: providerName,
        }
      );
    }

    /**
     * Validate provider response.
     */
    if (
      !purchase?.providerOrderId ||
      !purchase?.phoneNumber
    ) {
      throw createManagerError(
        `${serverName} returned an invalid purchase response.`,
        {
          code:
            "INVALID_PURCHASE_RESPONSE",

          status: 502,

          retryable: false,

          server: serverName,

          provider: providerName,
        }
      );
    }

    /**
     * Determine the actual provider price.
     */
    const purchasePrice =
      Number(
        purchase.providerPrice
      );

    const quotedProviderPrice =
      Number(
        quotedPrice?.price
      );

    const providerPrice =
      Number.isFinite(
        purchasePrice
      ) &&
      purchasePrice > 0
        ? purchasePrice
        : Number.isFinite(
            quotedProviderPrice
          ) &&
          quotedProviderPrice > 0
        ? quotedProviderPrice
        : null;

    /**
     * IMPORTANT:
     *
     * internalProvider
     * is NOT for customers.
     *
     * orderController will save it
     * into MongoDB only.
     *
     * Before responding to the frontend
     * it will be removed.
     */
    return buildPublicResult(
      purchase,
      serverName,
      {
        providerOrderId:
          String(
            purchase.providerOrderId
          ),

        phoneNumber:
          String(
            purchase.phoneNumber
          ),

        providerPrice,

        providerCurrency:
          purchase.providerCurrency ||
          quotedPrice?.currency ||
          null,

        /**
         * Remove provider names
         * from quoted response.
         */
        priceQuote:
          quotedPrice
            ? stripProviderFields(
                quotedPrice
              )
            : null,

        /**
         * INTERNAL ONLY
         *
         * Stored inside MongoDB.
         *
         * Never return to frontend.
         */
        internalProvider:
          providerName,
      }
    );
  };

  /**
   * Customer selected a server.
   */
  if (requestedServer) {
    return executeWithSelectedServer(
      requestedServer,
      "number purchase",
      operation
    );
  }

  /**
   * Otherwise use automatic failover.
   */
  return executeWithFailover(
    "number purchase",
    operation
  );
}
/**
 * Returns the current price from one server.
 */
async function getPrice(options = {}) {
  const requestedServer =
    getRequestedServer(options);

  const providerOptions = {
    ...options,
  };

  delete providerOptions.server;
  delete providerOptions.provider;

  const operation = async (
    providerClient,
    serverName,
    providerName
  ) => {
    if (
      typeof providerClient.getPrice !==
      "function"
    ) {
      throw createManagerError(
        `${serverName} does not support price lookup.`,
        {
          code: "OPERATION_NOT_SUPPORTED",
          status: 400,
          retryable: false,
          server: serverName,
          provider: providerName,
        }
      );
    }

    const result =
      await providerClient.getPrice(
        providerOptions
      );

    const price = Number(result?.price);

    if (
      !Number.isFinite(price) ||
      price <= 0
    ) {
      throw createManagerError(
        `${serverName} returned an invalid price.`,
        {
          code: "INVALID_PRICE",
          status: 502,
          retryable: false,
          server: serverName,
          provider: providerName,
        }
      );
    }

    return buildPublicResult(
      result,
      serverName,
      {
        service:
          result.service ||
          providerOptions.service ||
          null,

        country:
          result.country ||
          providerOptions.country ||
          null,

        price,

        stock:
          Number.isFinite(
            Number(result.stock)
          )
            ? Number(result.stock)
            : 0,

        currency:
          result.currency || null,

        raw:
          stripProviderFields(
            result.raw ?? result
          ),
      }
    );
  };

  if (requestedServer) {
    return executeWithSelectedServer(
      requestedServer,
      "price request",
      operation
    );
  }

  return executeWithFailover(
    "price request",
    operation
  );
}


/**
 * Returns every available operator/provider option
 * for a country and service on one server.
 */
async function getOperators(options = {}) {
  const requestedServer =
    getRequestedServer(options);

  const providerOptions = {
    ...options,
  };

  delete providerOptions.server;
  delete providerOptions.provider;

  const operation = async (
    providerClient,
    serverName,
    providerName
  ) => {
    if (
      typeof providerClient.getOperators !==
      "function"
    ) {
      throw createManagerError(
        `${serverName} does not support operator lookup.`,
        {
          code:
            "OPERATION_NOT_SUPPORTED",
          status: 400,
          retryable: false,
          server: serverName,
          provider: providerName,
        }
      );
    }

    const result =
      await providerClient.getOperators(
        providerOptions
      );

    const operators =
      Array.isArray(result?.operators)
        ? result.operators
        : [];

    if (!operators.length) {
      throw createManagerError(
        `${serverName} returned no available operators.`,
        {
          code: "NO_OPERATORS",
          status: 409,
          retryable: true,
          server: serverName,
          provider: providerName,
        }
      );
    }

    return buildPublicResult(
      result,
      serverName,
      {
        country:
          result.country ||
          providerOptions.country ||
          null,
        service:
          result.service ||
          providerOptions.service ||
          null,
        currency:
          result.currency || null,
        operators:
          stripProviderFields(
            operators
          ),
        raw:
          stripProviderFields(
            result.raw ?? result
          ),
      }
    );
  };

  if (requestedServer) {
    return executeWithSelectedServer(
      requestedServer,
      "operator request",
      operation
    );
  }

  return executeWithFailover(
    "operator request",
    operation
  );
}

/**
 * Returns the balance of one server or,
 * when no server is specified,
 * automatically uses failover.
 */
async function getBalance(options = {}) {
  const requestedServer =
    typeof options === "string"
      ? options
      : options.server;

  const operation = async (
    providerClient,
    serverName,
    providerName
  ) => {
    if (
      typeof providerClient.getBalance !==
      "function"
    ) {
      throw createManagerError(
        `${serverName} does not support balance lookup.`,
        {
          code: "OPERATION_NOT_SUPPORTED",
          status: 400,
          retryable: false,
          server: serverName,
          provider: providerName,
        }
      );
    }

    const result =
      await providerClient.getBalance();

    return buildPublicResult(
      result,
      serverName
    );
  };

  if (requestedServer) {
    return executeWithSelectedServer(
      requestedServer,
      "balance request",
      operation
    );
  }

  return executeWithFailover(
    "balance request",
    operation
  );
}

/**
 * Returns every supported country from
 * one server.
 */
async function getCountries(options = {}) {
  const requestedServer =
    typeof options === "string"
      ? options
      : options.server;

  const operation = async (
    providerClient,
    serverName,
    providerName
  ) => {
    if (
      typeof providerClient.getCountries !==
      "function"
    ) {
      throw createManagerError(
        `${serverName} does not support country lookup.`,
        {
          code: "OPERATION_NOT_SUPPORTED",
          status: 400,
          retryable: false,
          server: serverName,
          provider: providerName,
        }
      );
    }

    const result =
      await providerClient.getCountries();

    return buildPublicResult(
      result,
      serverName,
      {
        countries:
          stripProviderFields(
            result.countries ||
              result
          ),

        raw:
          stripProviderFields(
            result.raw ??
              result
          ),
      }
    );
  };

  if (requestedServer) {
    return executeWithSelectedServer(
      requestedServer,
      "countries request",
      operation
    );
  }

  return executeWithFailover(
    "countries request",
    operation
  );
}

/**
 * Returns every supported service from
 * one server.
 */
async function getServices(options = {}) {
  const requestedServer =
    typeof options === "string"
      ? options
      : options.server;

  const operation = async (
    providerClient,
    serverName,
    providerName
  ) => {
    if (
      typeof providerClient.getServices !==
      "function"
    ) {
      throw createManagerError(
        `${serverName} does not support service lookup.`,
        {
          code: "OPERATION_NOT_SUPPORTED",
          status: 400,
          retryable: false,
          server: serverName,
          provider: providerName,
        }
      );
    }

    const result =
      await providerClient.getServices();

    return buildPublicResult(
      result,
      serverName,
      {
        services:
          stripProviderFields(
            result.services ||
              result
          ),

        raw:
          stripProviderFields(
            result.raw ??
              result
          ),
      }
    );
  };

  if (requestedServer) {
    return executeWithSelectedServer(
      requestedServer,
      "services request",
      operation
    );
  }

  return executeWithFailover(
    "services request",
    operation
  );
}
/**
 * Once an activation exists,
 * failover MUST NEVER happen.
 *
 * The stored internal provider determines
 * where every future request goes.
 *
 * providerOrServer may be:
 *
 * - "smsbower" (stored internally)
 * - "benotp" (stored internally)
 * - "server1" (public)
 * - "server2" (public)
 */
async function executeActivationOperation(
  providerOrServer,
  providerOrderId,
  operationName,
  operation
) {
  const configuration =
    resolveServerReference(
      providerOrServer
    );

  if (!providerOrderId) {
    throw createManagerError(
      "Provider order ID is required.",
      {
        code:
          "PROVIDER_ORDER_ID_REQUIRED",

        status: 400,

        retryable: false,

        server:
          configuration.serverName,

        provider:
          configuration.providerName,
      }
    );
  }

  try {
    const result =
      await operation(
        configuration.client,
        String(providerOrderId),
        configuration.serverName,
        configuration.providerName
      );

    if (
      !result ||
      typeof result !== "object"
    ) {
      throw createManagerError(
        `${configuration.serverName} returned an invalid ${operationName} response.`,
        {
          code:
            "INVALID_SERVER_RESPONSE",

          status: 502,

          retryable: false,

          server:
            configuration.serverName,

          provider:
            configuration.providerName,
        }
      );
    }

    return buildPublicResult(
      result,
      configuration.serverName,
      {
        providerOrderId: String(
          result.providerOrderId ||
            providerOrderId
        ),
      }
    );
  } catch (error) {
    error.server =
      error.server ||
      configuration.serverName;

    error.provider =
      error.provider ||
      configuration.providerName;

    throw error;
  }
}

/**
 * Polls the activation status.
 *
 * No failover.
 */
async function getOrder(
  providerOrServer,
  providerOrderId
) {
  return executeActivationOperation(
    providerOrServer,
    providerOrderId,
    "order request",
    async (
      providerClient,
      orderId
    ) => {
      if (
        typeof providerClient.getOrder !==
        "function"
      ) {
        throw createManagerError(
          "This server does not support order polling.",
          {
            code:
              "OPERATION_NOT_SUPPORTED",

            status: 400,

            retryable: false,
          }
        );
      }

      return providerClient.getOrder(
        orderId
      );
    }
  );
}

/**
 * Retrieves SMS messages.
 *
 * If the provider does not expose getSms(),
 * we fall back to getOrder().
 */
async function getSms(
  providerOrServer,
  providerOrderId
) {
  return executeActivationOperation(
    providerOrServer,
    providerOrderId,
    "sms request",
    async (
      providerClient,
      orderId
    ) => {
      if (
        typeof providerClient.getSms ===
        "function"
      ) {
        return providerClient.getSms(
          orderId
        );
      }

      if (
        typeof providerClient.getOrder ===
        "function"
      ) {
        return providerClient.getOrder(
          orderId
        );
      }

      throw createManagerError(
        "This server does not support SMS retrieval.",
        {
          code:
            "OPERATION_NOT_SUPPORTED",

          status: 400,

          retryable: false,
        }
      );
    }
  );
}
/**
 * Cancels an activation.
 *
 * IMPORTANT:
 * No failover is allowed because the activation
 * belongs to one specific provider.
 */
async function cancelOrder(
  providerOrServer,
  providerOrderId
) {
  return executeActivationOperation(
    providerOrServer,
    providerOrderId,
    "cancel request",
    async (
      providerClient,
      orderId
    ) => {

      if (
        typeof providerClient.cancelOrder !==
        "function"
      ) {
        throw createManagerError(
          "This server does not support activation cancellation.",
          {
            code:
              "OPERATION_NOT_SUPPORTED",

            status: 400,

            retryable: false,
          }
        );
      }

      return providerClient.cancelOrder(
        orderId
      );
    }
  );
}

/**
 * Completes an activation.
 *
 * Some providers support manually finishing
 * an activation after the OTP has been received.
 */
async function finishOrder(
  providerOrServer,
  providerOrderId
) {
  return executeActivationOperation(
    providerOrServer,
    providerOrderId,
    "finish request",
    async (
      providerClient,
      orderId,
      serverName,
      providerName
    ) => {

      if (
        typeof providerClient.finishOrder !==
        "function"
      ) {
        throw createManagerError(
          `${serverName} does not support manually finishing an activation.`,
          {
            code:
              "OPERATION_NOT_SUPPORTED",

            status: 400,

            retryable: false,

            server: serverName,

            provider: providerName,
          }
        );
      }

      return providerClient.finishOrder(
        orderId
      );
    }
  );
}
/**
 * Returns the health/balance information for every
 * configured server.
 *
 * Internally this still communicates with the
 * mapped provider.
 *
 * Public response:
 *
 * [
 *   {
 *     server: "server1",
 *     enabled: true,
 *     healthy: true,
 *     balance: ...
 *   }
 * ]
 */
async function getProviderBalances() {
  const serverEntries =
    Object.entries(
      SERVER_PROVIDER_MAP
    );

  const results =
    await Promise.allSettled(
      serverEntries.map(
        async ([
          serverName,
          configuration,
        ]) => {

          if (
            !isServerEnabled(
              serverName
            )
          ) {
            return {
              server:
                serverName,

              enabled: false,

              healthy: false,

              message:
                "Server is disabled.",
            };
          }

          if (
            typeof configuration.client
              .getBalance !==
            "function"
          ) {
            return {
              server:
                serverName,

              enabled: true,

              healthy: false,

              message:
                "Balance lookup not supported.",

              code:
                "OPERATION_NOT_SUPPORTED",
            };
          }

          const balance =
            await configuration.client.getBalance();

          return {
            ...stripProviderFields(
              balance
            ),

            server:
              serverName,

            enabled: true,

            healthy: true,
          };
        }
      )
    );

  return results.map(
    (result, index) => {

      const serverName =
        serverEntries[index][0];

      if (
        result.status ===
        "fulfilled"
      ) {
        return result.value;
      }

      return {
        server:
          serverName,

        enabled:
          isServerEnabled(
            serverName
          ),

        healthy: false,

        message:
          result.reason
            ?.message ||
          "Health check failed.",

        code:
          result.reason
            ?.code ||
          "SERVER_HEALTH_FAILED",
      };
    }
  );
}

/**
 * Export public API.
 *
 * Existing controllers can continue using
 * getProvider() until they are migrated.
 */
module.exports = {

  buyNumber,

  getPrice,

  getOperators,

  getBalance,

  getCountries,

  getServices,

  getOrder,

  getSms,

  cancelOrder,

  finishOrder,

  /**
   * Internal compatibility helpers.
   */
  getProvider,

  getProviderBalances,

  getProviderForServer,

  getServerForProvider,

  resolveServerReference,

  stripProviderFields,
};