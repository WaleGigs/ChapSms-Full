"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  orderService,
} from "@/services/orderService";

const ORDERS_CACHE_TTL_MS = 15000;

let cachedOrders = null;
let cachedOrdersAt = 0;
let activeOrdersRequest = null;

function cacheIsFresh() {
  return (
    Array.isArray(cachedOrders) &&
    Date.now() - cachedOrdersAt <
      ORDERS_CACHE_TTL_MS
  );
}

function writeOrdersCache(
  orders
) {
  cachedOrders =
    Array.isArray(orders)
      ? orders
      : [];

  cachedOrdersAt =
    Date.now();

  return cachedOrders;
}

async function fetchOrdersShared({
  force = false,
} = {}) {
  if (
    !force &&
    cacheIsFresh()
  ) {
    return cachedOrders;
  }

  if (
    !force &&
    activeOrdersRequest
  ) {
    return activeOrdersRequest;
  }

  activeOrdersRequest =
    Promise.resolve(
      orderService.getOrders()
    )
      .then((orderList) =>
        writeOrdersCache(
          Array.isArray(orderList)
            ? orderList
            : []
        )
      )
      .finally(() => {
        activeOrdersRequest = null;
      });

  return activeOrdersRequest;
}

export function useOrders() {
  const [orders, setOrders] =
    useState(() =>
      Array.isArray(cachedOrders)
        ? cachedOrders
        : []
    );

  const [loading, setLoading] =
    useState(
      () =>
        !Array.isArray(
          cachedOrders
        )
    );

  const [error, setError] =
    useState("");

  const loadOrders = useCallback(
    async ({
      force = false,
      showLoading = true,
    } = {}) => {
      try {
        if (
          showLoading &&
          !Array.isArray(
            cachedOrders
          )
        ) {
          setLoading(true);
        }

        setError("");

        const orderList =
          await fetchOrdersShared({
            force,
          });

        setOrders(orderList);

        return orderList;
      } catch (loadError) {
        console.error(
          "Orders loading failed:",
          loadError
        );

        setError(
          loadError?.message ||
            "Unable to load orders"
        );

        throw loadError;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  async function createOrder(
    orderData
  ) {
    const response =
      await orderService.createOrder(
        orderData
      );

    if (!response?.order) {
      throw new Error(
        "The server did not return the new order"
      );
    }

    setOrders(
      (currentOrders) => {
        const nextOrders = [
          response.order,
          ...currentOrders.filter(
            (order) =>
              order._id !==
              response.order._id
          ),
        ];

        writeOrdersCache(
          nextOrders
        );

        return nextOrders;
      }
    );

    return response;
  }

  function updateOrder(
    updatedOrder
  ) {
    if (
      !updatedOrder?._id
    ) {
      return;
    }

    setOrders(
      (currentOrders) => {
        const nextOrders =
          currentOrders.map(
            (order) =>
              order._id ===
              updatedOrder._id
                ? updatedOrder
                : order
          );

        writeOrdersCache(
          nextOrders
        );

        return nextOrders;
      }
    );
  }

  function removeOrder(
    orderId
  ) {
    setOrders(
      (currentOrders) => {
        const nextOrders =
          currentOrders.filter(
            (order) =>
              order._id !==
              orderId
          );

        writeOrdersCache(
          nextOrders
        );

        return nextOrders;
      }
    );
  }

  useEffect(() => {
    /*
     * Orders are important data, but they do not need to hold up the
     * first authenticated paint. Start after React has committed the
     * page. requestIdleCallback is used when available, with a short
     * timeout fallback for mobile browsers.
     */
    let idleId = null;
    let timerId = null;
    let cancelled = false;

    const run = () => {
      if (cancelled) {
        return;
      }

      loadOrders({
        showLoading: true,
      }).catch(() => {});
    };

    if (
      typeof window !==
        "undefined" &&
      typeof window
        .requestIdleCallback ===
        "function"
    ) {
      idleId =
        window.requestIdleCallback(
          run,
          {
            timeout: 650,
          }
        );
    } else {
      timerId =
        window.setTimeout(
          run,
          250
        );
    }

    return () => {
      cancelled = true;

      if (
        idleId !== null &&
        typeof window
          .cancelIdleCallback ===
          "function"
      ) {
        window.cancelIdleCallback(
          idleId
        );
      }

      if (timerId !== null) {
        window.clearTimeout(
          timerId
        );
      }
    };
  }, [loadOrders]);

  return {
    orders,
    loading,
    error,
    createOrder,
    updateOrder,
    removeOrder,

    refreshOrders: () =>
      loadOrders({
        force: true,
        showLoading: false,
      }),
  };
}
