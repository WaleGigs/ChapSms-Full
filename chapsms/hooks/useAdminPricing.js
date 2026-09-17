"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import { adminPricingService } from "@/services/adminPricingService";

function toPrimitiveString(value, seen = new WeakSet()) {
  if (value === null || value === undefined) {
    return "";
  }

  const valueType = typeof value;

  if (
    valueType === "string" ||
    valueType === "number" ||
    valueType === "bigint" ||
    valueType === "boolean"
  ) {
    const text = String(value).trim();

    return text === "[object Object]"
      ? ""
      : text;
  }

  if (valueType === "object") {
    if (seen.has(value)) {
      return "";
    }

    seen.add(value);

    for (const key of [
      "$oid",
      "_id",
      "id",
      "value",
      "code",
    ]) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) {
        continue;
      }

      const text = toPrimitiveString(value[key], seen);

      if (text) {
        return text;
      }
    }
  }

  return "";
}

function normalizeRule(rule) {
  if (!rule || typeof rule !== "object") {
    return null;
  }

  return {
    ...rule,
    id: toPrimitiveString(
      rule.id ?? rule._id
    ),
  };
}

export function useAdminPricingRules({
  server = "",
  page = 1,
  limit = 25,
  isActive = "",
} = {}) {
  const [rules, setRules] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit,
    total: 0,
    pages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadRules = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response =
        await adminPricingService.getRules({
          server,
          page,
          limit,
          isActive,
        });

      const nextRules = Array.isArray(response?.rules)
        ? response.rules
            .map(normalizeRule)
            .filter(Boolean)
        : [];

      setRules(nextRules);
      setPagination(
        response?.pagination || {
          page,
          limit,
          total: nextRules.length,
          pages: 1,
        }
      );

      return response;
    } catch (requestError) {
      setRules([]);
      setError(
        requestError?.message ||
          "Unable to load pricing rules"
      );

      return null;
    } finally {
      setLoading(false);
    }
  }, [server, page, limit, isActive]);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  return {
    rules,
    pagination,
    loading,
    error,
    reload: loadRules,
  };
}

export function useAdminSummary(filters = {}) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadSummary = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response =
        await adminPricingService.getSummary(filters);

      setSummary(response?.summary || null);

      return response?.summary || null;
    } catch (requestError) {
      setSummary(null);
      setError(
        requestError?.message ||
          "Unable to load admin summary"
      );

      return null;
    } finally {
      setLoading(false);
    }
  }, [filters.server, filters.dateFrom, filters.dateTo]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  return {
    summary,
    loading,
    error,
    reload: loadSummary,
  };
}