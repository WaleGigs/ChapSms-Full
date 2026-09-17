"use client";

import Badge from "@/components/ui/Badge";
import FavoriteButton from "@/components/favorites/FavoriteButton";

export default function ServiceCard({ service, selected, onClick }) {
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
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{service.icon}</span>

          <div>
            <h3 className="font-black text-[var(--foreground)]">
              {service.name}
            </h3>

            <p className="text-sm text-[var(--muted)]">
              Delivery: {service.delivery}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <FavoriteButton id={service.id} type="service" />

          {service.trending && <Badge variant="warning">Trending</Badge>}
        </div>
      </div>
    </div>
  );
}