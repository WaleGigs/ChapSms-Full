"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

function getServiceId(service) {
  return String(service?.id || service?.code || service?.service || "");
}

function getServiceName(service) {
  return String(
    service?.name || service?.serviceName || service?.title || service?.label || "Unknown",
  );
}

export default function SearchableServiceSelect({
  services = [],
  value = "",
  onChange,
  disabled = false,
}) {
  const rootRef = useRef(null);
  const searchRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(
    () => services.find((service) => getServiceId(service) === String(value)),
    [services, value],
  );

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return services;

    return services.filter((service) =>
      `${getServiceName(service)} ${getServiceId(service)}`
        .toLowerCase()
        .includes(normalized),
    );
  }, [query, services]);

  useEffect(() => {
    if (!open) return undefined;

    searchRef.current?.focus();

    function closeOutside(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    function closeWithEscape(event) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", closeOutside);
    window.addEventListener("keydown", closeWithEscape);

    return () => {
      document.removeEventListener("mousedown", closeOutside);
      window.removeEventListener("keydown", closeWithEscape);
    };
  }, [open]);

  function selectService(service) {
    const id = getServiceId(service);
    if (!id) return;
    onChange?.(id);
    setOpen(false);
    setQuery("");
  }

  const placeholder = disabled ? "Select a country first" : "Choose a service";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 text-left text-sm font-semibold text-[var(--foreground)] outline-none transition hover:border-blue-400 focus-visible:ring-4 focus-visible:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-[var(--muted)] disabled:text-[var(--muted-foreground)]"
      >
        <span className="min-w-0 truncate">
          {selected ? (
            getServiceName(selected)
          ) : (
            <span className="text-[var(--muted-foreground)]">{placeholder}</span>
          )}
        </span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-[var(--muted-foreground)] transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div className="absolute z-40 mt-2 w-full overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--popover)] shadow-2xl">
          <div className="border-b border-[var(--border)] p-3">
            <div className="relative">
              <Search
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
              />
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search services..."
                className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] pl-10 pr-3 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)] focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20"
              />
            </div>
          </div>

          <div role="listbox" className="max-h-64 overflow-y-auto p-2">
            {filtered.length ? (
              filtered.map((service, index) => {
                const id = getServiceId(service);
                const active = id === String(value);

                return (
                  <button
                    key={`${id || "service"}-${index}`}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => selectService(service)}
                    className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition hover:bg-[var(--muted)]"
                  >
                    <span className="min-w-0 truncate font-semibold text-[var(--foreground)]">
                      {getServiceName(service)}
                    </span>
                    {active ? <Check size={17} className="shrink-0 text-blue-600" /> : null}
                  </button>
                );
              })
            ) : (
              <p className="px-3 py-6 text-center text-sm text-[var(--muted-foreground)]">
                No service found.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
