const PurchaseAttempt = require('../models/PurchaseAttempt');

/*
 * Failed-purchase recorder for the admin User Activity page.
 *
 * Call once at the top of a buy handler, after input validation:
 *
 *   const attempt = trackPurchaseAttempt(req, res, { kind: 'number', service, country });
 *   attempt.amount = sellingPrice;   // fill in as you learn more
 *   attempt.orderId = () => order?._id; // social order created, then failed
 *
 * Every response the handler sends with status >= 400 is saved when it
 * finishes, with the code and message the user saw. This hooks the response
 * instead of every `return res.status(...)`, so a new failure path is
 * recorded without anyone remembering to.
 *
 * Fire-and-forget: a failed write logs and never affects the request.
 */

// Status -> reason when the response carried no code.
const REASON_BY_STATUS = {
  402: 'insufficient_balance',
  404: 'unavailable',
  409: 'out_of_stock',
  503: 'provider_unavailable',
};

const clip = (value, max) => (value == null || value === '' ? null : String(value).slice(0, max));

function trackPurchaseAttempt(req, res, base = {}) {
  const ctx = { ...base };
  let body;
  const origJson = res.json.bind(res);
  res.json = (b) => { body = b; return origJson(b); };

  res.on('finish', () => {
    if (res.statusCode < 400 || ctx.skip || !req.user?._id) return;
    const amount = ctx.amount == null ? null : Number(ctx.amount);
    // A function lets the handler point at an order it creates later.
    const orderId = typeof ctx.orderId === 'function' ? ctx.orderId() : ctx.orderId;
    PurchaseAttempt.create({
      user: req.user._id,
      kind: ctx.kind === 'social' ? 'social' : 'number',
      reason: String(ctx.reason || body?.code || REASON_BY_STATUS[res.statusCode] || 'error').toLowerCase().slice(0, 64),
      message: String(body?.message || body?.error || '').slice(0, 500),
      httpStatus: res.statusCode,
      provider: clip(ctx.provider, 64),
      server: clip(ctx.server, 16),
      country: clip(ctx.country, 64),
      service: clip(ctx.service, 64),
      label: clip(ctx.label, 200),
      amount: Number.isFinite(amount) ? amount : null,
      orderId: orderId || null,
      detail: ctx.detail && typeof ctx.detail === 'object' ? ctx.detail : {},
    }).catch((error) => {
      console.warn('[purchaseAttempts] insert failed:', error.message);
    });
  });

  return ctx;
}

module.exports = { trackPurchaseAttempt };
