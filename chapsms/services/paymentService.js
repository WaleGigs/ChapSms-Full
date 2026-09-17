import { api } from "@/lib/api";

export const paymentService = {
  async initializePayment({
    amount,
    paymentMethod = "bank",
  }) {
    return api("/payment/initialize", {
      method: "POST",
      body: JSON.stringify({
        amount: Number(amount),
        paymentMethod,
      }),
    });
  },

  async verifyPayment({
    transactionId,
    txRef,
  }) {
    return api("/payment/verify", {
      method: "POST",
      body: JSON.stringify({
        transactionId,
        txRef,
      }),
    });
  },

  async getPaymentStatus(
    txRef,
    {
      refresh = false,
    } = {},
  ) {
    const reference =
      encodeURIComponent(
        String(txRef || "").trim(),
      );

    return api(
      `/payment/status/${reference}${
        refresh
          ? "?refresh=1"
          : ""
      }`
    );
  },
};

export default paymentService;
