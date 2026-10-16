"use client";

const KEY = "chapsms_first_touch_v1";
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;
const EMPTY = { registrationSource: "direct", registrationMedium: "", registrationCampaign: "", snapClickId: "", tiktokClickId: "" };
const trim = (value, length) => String(value || "").trim().slice(0, length);

function readSaved() {
  try {
    const value = JSON.parse(window.localStorage.getItem(KEY) || "null");
    if (!value || typeof value !== "object") return null;
    if (value.capturedAt && Date.now() - value.capturedAt > MAX_AGE_MS) return null;
    return value;
  } catch { return null; }
}

export function getAcquisition() {
  if (typeof window === "undefined") return { ...EMPTY };
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
    if (snapClickId || /^(snapchat|snap)$/.test(utm)) source = "snapchat";
    else if (tiktokClickId || /^(tiktok|tik_tok)$/.test(utm)) source = "tiktok";
    else if (/^(instagram|ig)$/.test(utm)) source = paid ? "instagram" : "organic";
    else if (/^(facebook|fb|meta)$/.test(utm)) source = paid ? "facebook" : "organic";
    else if (utm) source = "other";
    else if (fbclid) source = "other"; // fbclid alone does not identify Instagram versus Facebook.
    else if (document.referrer) {
      try {
        const ref = new URL(document.referrer);
        if (ref.hostname !== window.location.hostname) source = "organic";
      } catch { /* Ignore malformed referrer */ }
    }
    const previous = readSaved();
    // A prior untagged visit should not permanently mask a later tagged ad visit.
    // Keep the earliest identifiable source, but upgrade legacy/default direct values.
    if (previous && previous.registrationSource && previous.registrationSource !== "direct" && previous.registrationSource !== "other") return;
    if (previous && !source) return;
    const data = {
      registrationSource: source || "direct",
      registrationMedium: trim(medium, 100),
      registrationCampaign: trim(params.get("utm_campaign"), 200),
      snapClickId,
      tiktokClickId,
      capturedAt: Date.now(),
    };
    window.localStorage.setItem(KEY, JSON.stringify(data));
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