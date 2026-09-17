import { api } from "@/lib/api";

export const walletService = {
  async getWallet() {
    const data = await api("/wallet");
    return data.wallet;
  },

  async getTransactions() {
    const data = await api("/wallet/transactions");
    return data.transactions || [];
  },
};
