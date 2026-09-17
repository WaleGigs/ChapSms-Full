const axios = require("axios");

const DEFAULT_BASE_URL =
  "https://neurapay.com.ng/api/v1";

function requireEnvironment(name) {
  const value = String(
    process.env[name] || ""
  ).trim();

  if (!value) {
    const error = new Error(
      `${name} is not configured`
    );

    error.code =
      "NEURAPAY_CONFIGURATION_ERROR";
    error.status = 500;

    throw error;
  }

  return value;
}

function getBaseUrl() {
  return String(
    process.env.NEURAPAY_BASE_URL ||
      DEFAULT_BASE_URL
  )
    .trim()
    .replace(/\/+$/, "");
}

function getHeaders() {
  /*
   * Official NeuraPay documentation supplied by the merchant shows:
   *
   * Authorization: Bearer <SECRET KEY>
   * Content-Type: application/json
   * X-Business-Id: <BUSINESS ID>
   *
   * The API key shown in the dashboard is intentionally NOT sent here
   * because the supplied API examples do not use it.
   */
  return {
    Authorization:
      `Bearer ${requireEnvironment(
        "NEURAPAY_SECRET_KEY"
      )}`,
    "Content-Type":
      "application/json",
    Accept:
      "application/json",
    "X-Business-Id":
      requireEnvironment(
        "NEURAPAY_BUSINESS_ID"
      ),
  };
}

function createNeuraPayError(
  message,
  {
    code =
      "NEURAPAY_REQUEST_FAILED",
    status = 502,
    retryable = false,
    responseData,
  } = {}
) {
  const error =
    new Error(message);

  error.code = code;
  error.status = status;
  error.retryable =
    Boolean(retryable);

  if (
    responseData !== undefined
  ) {
    error.responseData =
      responseData;
  }

  return error;
}

function normalizeProviderChannel(
  value
) {
  const raw =
    String(
      value || "Paga"
    ).trim();

  const normalized =
    raw.toLowerCase();

  if (normalized === "paga") {
    return "Paga";
  }

  if (
    normalized === "palmpay"
  ) {
    return "PalmPay";
  }

  throw createNeuraPayError(
    "Unsupported NeuraPay provider channel",
    {
      code:
        "INVALID_PROVIDER_CHANNEL",
      status: 400,
    }
  );
}

function normalizeReference(
  value
) {
  const reference =
    String(value || "").trim();

  if (!reference) {
    throw createNeuraPayError(
      "NeuraPay transaction reference is required",
      {
        code:
          "INVALID_TRANSACTION_REFERENCE",
        status: 400,
      }
    );
  }

  return reference;
}

function getErrorMessage(
  error,
  fallback
) {
  const responseData =
    error?.response?.data;

  return String(
    responseData?.message ||
      responseData?.error ||
      error?.message ||
      fallback
  ).trim();
}

function mapAxiosError(
  error,
  fallback
) {
  if (
    error?.code ===
      "NEURAPAY_CONFIGURATION_ERROR" ||
    error?.code ===
      "INVALID_PROVIDER_CHANNEL" ||
    error?.code ===
      "INVALID_TRANSACTION_REFERENCE"
  ) {
    return error;
  }

  const upstreamStatus =
    Number(
      error?.response?.status
    ) || 0;

  const status =
    upstreamStatus >= 400 &&
    upstreamStatus < 500
      ? upstreamStatus
      : 502;

  const retryable =
    !upstreamStatus ||
    upstreamStatus === 408 ||
    upstreamStatus === 409 ||
    upstreamStatus === 425 ||
    upstreamStatus === 429 ||
    upstreamStatus >= 500;

  return createNeuraPayError(
    getErrorMessage(
      error,
      fallback
    ),
    {
      status,
      retryable,
      responseData:
        error?.response?.data,
    }
  );
}

async function createVirtualAccount({
  customerName,
  customerEmail,
  providerChannel = "Paga",
  reference,
  identityType,
  licenseNumber,
}) {
  const provider =
    normalizeProviderChannel(
      providerChannel
    );

  const name =
    String(
      customerName || ""
    ).trim();

  const email =
    String(
      customerEmail || ""
    )
      .trim()
      .toLowerCase();

  const requestReference =
    String(
      reference || ""
    ).trim();

  if (
    !name ||
    !email ||
    !requestReference
  ) {
    throw createNeuraPayError(
      "Customer name, email and reference are required",
      {
        code:
          "INVALID_VIRTUAL_ACCOUNT_REQUEST",
        status: 400,
      }
    );
  }

  const payload = {
    customer_name: name,
    customer_email: email,
    provider_channel:
      provider,
    reference:
      requestReference,
  };

  /*
   * PalmPay requires identity verification.
   * Paga does not require these fields.
   */
  if (
    provider === "PalmPay"
  ) {
    const normalizedIdentityType =
      String(
        identityType || ""
      ).trim();

    const normalizedLicenseNumber =
      String(
        licenseNumber || ""
      ).trim();

    const allowedIdentityTypes =
      new Set([
        "personal",
        "personal_nin",
        "company",
      ]);

    if (
      !allowedIdentityTypes.has(
        normalizedIdentityType
      ) ||
      !normalizedLicenseNumber
    ) {
      throw createNeuraPayError(
        "PalmPay requires a valid identity type and license number",
        {
          code:
            "PALMPAY_IDENTITY_REQUIRED",
          status: 400,
        }
      );
    }

    payload.identity_type =
      normalizedIdentityType;

    payload.license_number =
      normalizedLicenseNumber;
  }

  try {
    const response =
      await axios.post(
        `${getBaseUrl()}/virtual-accounts`,
        payload,
        {
          timeout: 20000,
          headers:
            getHeaders(),
        }
      );

    const result =
      response?.data;

    if (
      String(
        result?.status || ""
      ).toLowerCase() !==
        "success" ||
      !result?.data
    ) {
      throw createNeuraPayError(
        result?.message ||
          "NeuraPay did not return a valid virtual account",
        {
          code:
            "INVALID_VIRTUAL_ACCOUNT_RESPONSE",
          status: 502,
          responseData:
            result,
        }
      );
    }

    return result;
  } catch (error) {
    if (
      error?.code ===
        "INVALID_VIRTUAL_ACCOUNT_RESPONSE"
    ) {
      throw error;
    }

    throw mapAxiosError(
      error,
      "Unable to create NeuraPay virtual account"
    );
  }
}

async function getTransactionStatus(
  reference,
  {
    attempts = 3,
    delayMs = 500,
  } = {}
) {
  const normalizedReference =
    normalizeReference(
      reference
    );

  let lastError = null;

  for (
    let attempt = 1;
    attempt <= attempts;
    attempt += 1
  ) {
    try {
      const response =
        await axios.get(
          `${getBaseUrl()}/transactions/${encodeURIComponent(
            normalizedReference
          )}`,
          {
            timeout: 20000,
            headers:
              getHeaders(),
          }
        );

      const result =
        response?.data;

      if (
        String(
          result?.status || ""
        ).toLowerCase() !==
          "success" ||
        !result?.data
      ) {
        throw createNeuraPayError(
          result?.message ||
            "NeuraPay returned an invalid transaction response",
          {
            code:
              "INVALID_TRANSACTION_RESPONSE",
            status: 502,
            responseData:
              result,
          }
        );
      }

      return result;
    } catch (error) {
      lastError =
        error?.code ===
          "INVALID_TRANSACTION_RESPONSE"
          ? error
          : mapAxiosError(
              error,
              "Unable to verify NeuraPay transaction"
            );

      if (
        !lastError.retryable ||
        attempt >= attempts
      ) {
        break;
      }

      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            delayMs * attempt
          )
      );
    }
  }

  throw lastError;
}

module.exports = {
  createVirtualAccount,
  getTransactionStatus,
  normalizeProviderChannel,
};