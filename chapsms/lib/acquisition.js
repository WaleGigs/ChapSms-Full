"use client";
const KEY = "chapsms_first_touch_v1";
export function getAcquisition() {
  if (typeof window === "undefined") return { registrationSource: "direct" };
  try { return JSON.parse(window.localStorage.getItem(KEY)) || { registrationSource: "direct" }; }
  catch { return { registrationSource: "direct" }; }
}
export function captureAcquisition() {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem(KEY)) return;
    const q = new URLSearchParams(window.location.search);
    const utm = String(q.get("utm_source") || "").toLowerCase();
    const snapClickId = q.get("ScCid") || q.get("sc_cid") || "";
    const tiktokClickId = q.get("ttclid") || "";
    const source = snapClickId || /snap(chat)?/.test(utm) ? "snapchat" : tiktokClickId || /tiktok/.test(utm) ? "tiktok" : utm ? "other" : document.referrer && new URL(document.referrer).hostname !== window.location.hostname ? "organic" : "direct";
    const data = { registrationSource: source, registrationMedium: (q.get("utm_medium") || "").slice(0,100), registrationCampaign: (q.get("utm_campaign") || "").slice(0,200), snapClickId: snapClickId.slice(0,512), tiktokClickId: tiktokClickId.slice(0,512) };
    window.localStorage.setItem(KEY, JSON.stringify(data));
  } catch { /* Storage disabled: signup still works. */ }
}
export function trackSnapSignUp() {
  if (typeof window !== "undefined") window.snaptr?.("track", "SIGN_UP");
}
export function trackSnapPurchase(tx) {
  if (typeof window === "undefined" || !window.snaptr) return false;
  const ref = String(tx?.reference || "").trim();
  const price = Number(tx?.amount);
  if (!ref || !Number.isFinite(price) || price <= 0) return false;
  const key = `chapsms_snap_purchase_${ref}`;
  try { if (window.localStorage.getItem(key)) return false; } catch {}
  window.snaptr("track", "PURCHASE", { price, currency: "NGN", transaction_id: ref });
  try { window.localStorage.setItem(key, "1"); } catch {}
  return true;
}