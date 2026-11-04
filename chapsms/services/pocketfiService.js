import { api } from "@/lib/api";

export const pocketfiService = {
  async getAccount() {
    const response = await api("/payment/pocketfi/account");

    return response?.account || null;
  },

  createAccount() {
    return api("/payment/pocketfi/account", { method: "POST" });
  },
};

export default pocketfiService;
