"use client";

import { Star } from "lucide-react";
import { useFavorites } from "@/context/FavoritesContext";

export default function FavoriteButton({
  id,
  type,
  className = "",
}) {
  const {
    favorites,
    toggleFavoriteCountry,
    toggleFavoriteService,
  } = useFavorites();

  const active =
    type === "country"
      ? favorites.countries.includes(id)
      : favorites.services.includes(id);

  function handleClick(e) {
    e.stopPropagation();

    if (type === "country") {
      toggleFavoriteCountry(id);
    } else {
      toggleFavoriteService(id);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`rounded-full p-2 transition ${
        active
          ? "bg-yellow-100 text-yellow-500 dark:bg-yellow-900/20"
          : "text-[var(--muted-foreground)] hover:bg-[var(--background)]"
      } ${className}`}
    >
      <Star
        size={18}
        fill={active ? "currentColor" : "none"}
      />
    </button>
  );
}