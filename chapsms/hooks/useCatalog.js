"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { catalogService } from "@/services/catalogService";

const VALID_SERVERS = new Set([
  "server1",
  "server2",
]);

function normalizeServer(value) {
  const server = String(value || "")
    .trim()
    .toLowerCase();

  return VALID_SERVERS.has(server)
    ? server
    : "server1";
}

function unwrapCatalogResponse(response) {
  if (
    response?.countries !== undefined ||
    response?.services !== undefined
  ) {
    return response;
  }

  if (
    response?.data?.countries !== undefined ||
    response?.data?.services !== undefined
  ) {
    return response.data;
  }

  if (
    response?.data?.data?.countries !== undefined ||
    response?.data?.data?.services !== undefined
  ) {
    return response.data.data;
  }

  return response?.data || response || null;
}

function normalizeCollection(value, type) {
  if (Array.isArray(value)) {
    return value;
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  return Object.entries(value).map(
    ([key, item]) => {
      if (
        item &&
        typeof item === "object" &&
        !Array.isArray(item)
      ) {
        return {
          ...item,
          id:
            item.id ??
            item.code ??
            item.slug ??
            key,
          code:
            item.code ??
            item.id ??
            item.slug ??
            key,
          name:
            item.name ??
            item.title ??
            item.label ??
            item.eng ??
            key,
        };
      }

      return {
        id: key,
        code: key,
        name:
          String(item || "").trim() ||
          key,
        type,
        value: item,
      };
    }
  );
}

export function useCatalog(
  selectedServer = "server1"
) {
  const server = normalizeServer(
    selectedServer
  );

  const [catalog, setCatalog] =
    useState(null);

  const [countries, setCountries] =
    useState([]);

  const [services, setServices] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const requestSequenceRef =
    useRef(0);

  const loadCatalog = useCallback(
    async ({ refresh = false } = {}) => {
      const requestId =
        ++requestSequenceRef.current;

      try {
        setLoading(true);
        setError("");

        /*
         * Clear the previous server's catalog
         * immediately. This prevents old country
         * and service IDs from being sent to the
         * newly selected server.
         */
        setCatalog(null);
        setCountries([]);
        setServices([]);

        const response =
          await catalogService.getCatalog({
            server,
            refresh,
          });

        /*
         * Ignore responses belonging to an older
         * request after the selected server changes.
         */
        if (
          requestId !==
          requestSequenceRef.current
        ) {
          return null;
        }

        const catalogData =
          unwrapCatalogResponse(response);

        const responseServer = String(
          catalogData?.server || server
        )
          .trim()
          .toLowerCase();

        if (responseServer !== server) {
          throw new Error(
            `Received ${responseServer} catalog while ${server} is selected`
          );
        }

        const nextCountries =
          normalizeCollection(
            catalogData?.countries,
            "country"
          );

        const nextServices =
          normalizeCollection(
            catalogData?.services,
            "service"
          );

        const normalizedCatalog = {
          ...catalogData,
          server,
          countries: nextCountries,
          services: nextServices,
        };

        if (
          process.env.NODE_ENV ===
          "development"
        ) {
          console.log(
            "Selected server:",
            server
          );

          console.log(
            "Catalog API response:",
            response
          );

          console.log(
            "Resolved catalog:",
            normalizedCatalog
          );

          console.log(
            "Countries:",
            nextCountries.length
          );

          console.log(
            "Services:",
            nextServices.length
          );

          console.log(
            "First country:",
            nextCountries[0]
          );

          console.log(
            "First service:",
            nextServices[0]
          );
        }

        setCatalog(normalizedCatalog);
        setCountries(nextCountries);
        setServices(nextServices);

        return normalizedCatalog;
      } catch (requestError) {
        if (
          requestId !==
          requestSequenceRef.current
        ) {
          return null;
        }

        const message =
          requestError?.response?.data
            ?.message ||
          requestError?.data?.message ||
          requestError?.message ||
          "Unable to load available numbers";

        if (
          process.env.NODE_ENV ===
          "development"
        ) {
          console.warn(
            "Catalog loading failed:",
            requestError
          );
        }

        setCatalog(null);
        setCountries([]);
        setServices([]);
        setError(message);

        return null;
      } finally {
        if (
          requestId ===
          requestSequenceRef.current
        ) {
          setLoading(false);
        }
      }
    },
    [server]
  );

  useEffect(() => {
    loadCatalog();

    return () => {
      /*
       * Invalidate any request still running for
       * the previous server or component instance.
       */
      requestSequenceRef.current += 1;
    };
  }, [loadCatalog]);

  const reload = useCallback(() => {
    return loadCatalog({
      refresh: true,
    });
  }, [loadCatalog]);

  return {
    server,
    catalog,
    countries,
    services,
    loading,
    error,
    reload,
  };
}