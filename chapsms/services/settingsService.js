import { api } from "@/lib/api";

const PUBLIC_CACHE_TTL_MS = 30 * 1000;

let publicCache = {
  settings: null,
  expiresAt: 0,
  pending: null,
};

export const settingsService = {
  async getPublicSettings({ forceRefresh = false } = {}) {
    if (
      !forceRefresh &&
      publicCache.settings &&
      Date.now() < publicCache.expiresAt
    ) {
      return publicCache.settings;
    }

    if (!publicCache.pending) {
      publicCache.pending = api("/settings/public")
        .then((response) => {
          publicCache.settings = response?.settings || null;
          publicCache.expiresAt = Date.now() + PUBLIC_CACHE_TTL_MS;
          return publicCache.settings;
        })
        .finally(() => {
          publicCache.pending = null;
        });
    }

    return publicCache.pending;
  },

  getAdminSettings() {
    return api("/admin/settings");
  },

  async updateAdminSettings(settings) {
    const response = await api("/admin/settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    });

    publicCache.expiresAt = 0;

    return response;
  },
};

export default settingsService;
