"use client";

import FavoriteButton from "@/components/favorites/FavoriteButton";

export default function CountryCard({ country, selected, onClick }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick();
      }}
      className={`w-full cursor-pointer rounded-2xl border p-4 text-left transition-all duration-300 hover:scale-[1.02] ${
        selected
          ? "border-blue-600 bg-blue-50 shadow-lg dark:bg-blue-950/30"
          : "border-[var(--border)] bg-[var(--card)]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{country.flag}</span>

          <div>
            <h3 className="font-black text-[var(--foreground)]">
              {country.name}
            </h3>

            <p className="text-sm text-[var(--muted)]">
              {country.available.toLocaleString()} available
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <FavoriteButton id={country.code} type="country" />

          <div className="text-right">
            <p className="font-black text-blue-600">${country.price}</p>
            <p className="text-xs text-[var(--muted)]">per number</p>
          </div>
        </div>
      </div>
    </div>
  );
}