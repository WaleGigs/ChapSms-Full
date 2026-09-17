// services/apiKeyService.js
import { apiKeys } from "@/data/api/apiKeys";

export const apiKeyService = {
  async getApiKeys() {
    return apiKeys;
  },

  async regenerateKey() {
    return {
      success: true,
      key: "chp_live_new_**********",
    };
  },
};