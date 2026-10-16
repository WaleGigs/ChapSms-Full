"use client";

// Last identifiable campaign touch: a new explicit campaign replaces an older one.
const KEY = "chapsms_first_touch_v1"; // Retain key to migrate existing browser data.
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;
const EMPTY = { registrationSource: "direct", registrationMedium: "", registrationCampaign: "", snapClickId: "", tiktokClickId: "" };
const trim = (value, length) => String(value || "").trim().slice(0, length);

function readSaved() {
  try {
    const value = JSON.parse(window.localStorage.getItem(KEY) || "null");
    if (!value || typeof value !== "object") return null;
    if (!Number.isFinite(value.capturedAt) || Date.now() - value.capturedAt > MAX_AGE_MS || value.capturedAt > Date.now()) return null;
    return value;
  } catch { return null; }
}

export function getAcquisition() {
  if (typeof window === "undefined") return { ...EMPTY };
  // Also capture here so a signup action uses the latest URL even if a page effect has not run yet.
  captureAcquisition();
  const value = readSaved();
  if (!value) return { ...EMPTY };
  return {
    registrationSource: trim(value.registrationSource || "direct", 30),
    registrationMedium: trim(value.registrationMedium, 100),
    registrationCampaign: trim(value.registrationCampaign, 200),
    snapClickId: trim(value.snapClickId, 512),
    tiktokClickId: trim(value.tiktokClickId, 512),
  };
}

export function captureAcquisition() {
  if (typeof window === "undefined") return;
  try {
    const params = new URLSearchParams(window.location.search);
    const utm = trim(params.get("utm_source"), 80).toLowerCase();
    const medium = trim(params.get("utm_medium"), 100).toLowerCase();
    const snapClickId = trim(params.get("ScCid") || params.get("sc_cid"), 512);
    const tiktokClickId = trim(params.get("ttclid"), 512);
    const fbclid = trim(params.get("fbclid"), 512);
    const paid = /^(paid|paid_social|cpc|ppc|ads?|social_paid)$/.test(medium);

    let source = "";
    // Explicit UTM source wins over stray click IDs from other platforms.
    if (/^(snapchat|snap)$/.test(utm)) source = "snapchat";
    else if (/^(tiktok|tik_tok)$/.test(utm)) source = "tiktok";
    else if (/^(instagram|ig)$/.test(utm)) source = paid ? "instagram" : "organic";
    else if (/^(facebook|fb|meta)$/.test(utm)) source = paid ? "facebook" : "organic";
    else if (utm) source = "other";
    else if (snapClickId) source = "snapchat";
    else if (tiktokClickId) source = "tiktok";
    else if (fbclid) source = "other"; // fbclid does not distinguish Facebook from Instagram.

    const previous = readSaved();
    if (source) {
      // New tagged campaign replaces old attribution; a revisit to the same tagged URL
      // does not reset its timestamp or needlessly rewrite browser storage.
      const campaign = trim(params.get("utm_campaign"), 200);
      if (previous && previous.registrationSource === source &&
          previous.registrationMedium === medium &&
          previous.registrationCampaign === campaign &&
          previous.snapClickId === snapClickId &&
          previous.tiktokClickId === tiktokClickId) return;
      window.localStorage.setItem(KEY, JSON.stringify({
        registrationSource: source,
        registrationMedium: medium,
        registrationCampaign: campaign,
        snapClickId: source === "snapchat" ? snapClickId : "",
        tiktokClickId: source === "tiktok" ? tiktokClickId : "",
        capturedAt: Date.now(),
      }));
      return;
    }

    // An untagged internal page or direct return must not erase the latest campaign.
    if (previous) return;
    let fallback = "direct";
    if (document.referrer) {
      try {
        const ref = new URL(document.referrer);
        if (ref.origin !== window.location.origin) fallback = "organic";
      } catch { /* Ignore invalid referrer */ }
    }
    window.localStorage.setItem(KEY, JSON.stringify({ ...EMPTY, registrationSource: fallback, capturedAt: Date.now() }));
  } catch { /* Attribution failure must never interrupt authentication. */ }
}

export function trackSnapSignUp() {
  if (typeof window !== "undefined") window.snaptr?.("track", "SIGN_UP");
}

export function trackSnapPurchase(tx) {
  if (typeof window === "undefined" || !window.snaptr) return false;
  const ref = trim(tx?.reference, 200);
  const price = Number(tx?.amount);
  if (!ref || !Number.isFinite(price) || price <= 0) return false;
  const key = `chapsms_snap_purchase_${ref}`;
  try { if (window.localStorage.getItem(key)) return false; } catch {}
  window.snaptr("track", "PURCHASE", { price, currency: "NGN", transaction_id: ref });
  try { window.localStorage.setItem(key, "1"); } catch {}
  return true;
}
