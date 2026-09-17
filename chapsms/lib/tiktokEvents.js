"use client";

function getTikTokQueue() {
  if (typeof window === "undefined" || !window.ttq) return null;
  return window.ttq;
}

export function trackTikTokEvent(eventName, parameters = {}) {
  const ttq = getTikTokQueue();
  if (!ttq || typeof ttq.track !== "function") return false;
  ttq.track(eventName, parameters);
  return true;
}

export function trackCompleteRegistration() {
  return trackTikTokEvent("CompleteRegistration");
}

export function trackInitiateCheckout({
  value,
  currency = "NGN",
  description = "ChapsSms wallet funding started",
} = {}) {
  const amount = Number(value);
  const hasAmount = Number.isFinite(amount) && amount > 0;

  return trackTikTokEvent("InitiateCheckout", {
    content_id: "wallet-funding",
    content_type: "product",
    content_name: "ChapsSms Wallet Funding",
    quantity: 1,
    description,
    ...(hasAmount
      ? {
          price: amount,
          value: amount,
          currency,
        }
      : {}),
  });
}

export function trackWalletFundingPurchase({
  value,
  currency = "NGN",
  gateway = "",
  reference = "",
} = {}) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return false;

  return trackTikTokEvent("Purchase", {
    content_id: reference ? String(reference) : "wallet-funding",
    content_type: "product",
    content_name: "ChapsSms Wallet Funding",
    quantity: 1,
    price: amount,
    value: amount,
    currency,
    description: gateway
      ? `ChapsSms wallet funded via ${gateway}`
      : "ChapsSms wallet funded",
  });
}

export function trackNumberPurchased({
  value,
  currency = "NGN",
  orderId,
  serviceName = "Virtual number",
} = {}) {
  const amount = Number(value);

  return trackTikTokEvent("NumberPurchased", {
    content_id: orderId ? String(orderId) : "virtual-number",
    content_type: "product",
    content_name: String(serviceName || "Virtual number"),
    quantity: 1,
    ...(Number.isFinite(amount) && amount > 0
      ? {
          price: amount,
          value: amount,
          currency,
        }
      : {}),
    description: String(serviceName || "Virtual number"),
  });
}