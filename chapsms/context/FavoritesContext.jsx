"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { favoritesService } from "@/services/favoritesService";

const FavoritesContext = createContext(null);

const emptyFavorites = {
  countries: [],
  services: [],
};

function getStoredArray(key) {
  const saved = localStorage.getItem(key);
  return saved ? JSON.parse(saved) : [];
}

export function FavoritesProvider({ children }) {
  const [favorites, setFavorites] = useState(emptyFavorites);
  const [recentCountries, setRecentCountries] = useState([]);
  const [recentServices, setRecentServices] = useState([]);

  useEffect(() => {
    queueMicrotask(() => {
      setFavorites(favoritesService.getFavorites());
      setRecentCountries(getStoredArray("chapsms-recent-countries"));
      setRecentServices(getStoredArray("chapsms-recent-services"));
    });
  }, []);

  function toggleFavoriteCountry(countryCode) {
    setFavorites((prev) => {
      const exists = prev.countries.includes(countryCode);

      const updated = {
        ...prev,
        countries: exists
          ? prev.countries.filter((code) => code !== countryCode)
          : [...prev.countries, countryCode],
      };

      favoritesService.saveFavorites(updated);
      return updated;
    });
  }

  function toggleFavoriteService(serviceId) {
    setFavorites((prev) => {
      const exists = prev.services.includes(serviceId);

      const updated = {
        ...prev,
        services: exists
          ? prev.services.filter((id) => id !== serviceId)
          : [...prev.services, serviceId],
      };

      favoritesService.saveFavorites(updated);
      return updated;
    });
  }

  function addRecentCountry(countryCode) {
    setRecentCountries((prev) => {
      const updated = [countryCode, ...prev.filter((code) => code !== countryCode)].slice(0, 5);
      localStorage.setItem("chapsms-recent-countries", JSON.stringify(updated));
      return updated;
    });
  }

  function addRecentService(serviceId) {
    setRecentServices((prev) => {
      const updated = [serviceId, ...prev.filter((id) => id !== serviceId)].slice(0, 5);
      localStorage.setItem("chapsms-recent-services", JSON.stringify(updated));
      return updated;
    });
  }

  return (
    <FavoritesContext.Provider
      value={{
        favorites,
        recentCountries,
        recentServices,
        toggleFavoriteCountry,
        toggleFavoriteService,
        addRecentCountry,
        addRecentService,
      }}
    >
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  return useContext(FavoritesContext);
}