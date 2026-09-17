// services/favoritesService.js
export const favoritesService = {
  getFavorites() {
    if (typeof window === "undefined") {
      return {
        countries: [],
        services: [],
      };
    }

    const saved = localStorage.getItem("chapsms-favorites");

    return saved
      ? JSON.parse(saved)
      : {
          countries: [],
          services: [],
        };
  },

  saveFavorites(favorites) {
    localStorage.setItem("chapsms-favorites", JSON.stringify(favorites));
  },
};