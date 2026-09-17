import {
  api,
} from "@/lib/api";

function normalizeProviderChannel(
  value
) {
  const provider =
    String(
      value || "Paga"
    ).trim();

  if (
    provider.toLowerCase() ===
    "paga"
  ) {
    return "Paga";
  }

  if (
    provider.toLowerCase() ===
    "palmpay"
  ) {
    return "PalmPay";
  }

  throw new Error(
    "Please select a valid NeuraPay bank provider"
  );
}

export const neurapayService = {
  async getAccount({
    providerChannel =
      "Paga",
  } = {}) {
    const provider =
      normalizeProviderChannel(
        providerChannel
      );

    const query =
      new URLSearchParams({
        providerChannel:
          provider,
      });

    const response =
      await api(
        `/payment/neurapay/account?${query.toString()}`
      );

    return (
      response?.account ||
      null
    );
  },

  async createAccount({
    providerChannel =
      "Paga",
    identityType,
    licenseNumber,
  } = {}) {
    const provider =
      normalizeProviderChannel(
        providerChannel
      );

    const payload = {
      providerChannel:
        provider,
    };

    if (
      provider === "PalmPay"
    ) {
      payload.identityType =
        String(
          identityType ||
            ""
        ).trim();

      payload.licenseNumber =
        String(
          licenseNumber ||
            ""
        ).trim();
    }

    return api(
      "/payment/neurapay/account",
      {
        method: "POST",
        body:
          JSON.stringify(
            payload
          ),
      }
    );
  },

  async verifyTransaction(
    reference
  ) {
    const normalizedReference =
      String(
        reference || ""
      ).trim();

    if (
      !normalizedReference
    ) {
      throw new Error(
        "Transaction reference is required"
      );
    }

    return api(
      "/payment/neurapay/verify",
      {
        method: "POST",
        body:
          JSON.stringify({
            reference:
              normalizedReference,
          }),
      }
    );
  },
};

export default neurapayService;
