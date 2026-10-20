/**
 * Tiny in-memory cache for expensive admin reports.
 * Concurrent requests for the same key share one in-flight computation.
 */
function createResponseCache(ttlMs) {
  const entries = new Map();

  return async function cached(key, compute, { fresh = false } = {}) {
    const hit = entries.get(key);
    if (!fresh && hit && (hit.pending || hit.expiresAt > Date.now())) return hit.value;

    const pending = compute();
    entries.set(key, { pending: true, value: pending });
    try {
      const value = await pending;
      entries.set(key, { pending: false, value: Promise.resolve(value), expiresAt: Date.now() + ttlMs });
      return value;
    } catch (error) {
      entries.delete(key);
      throw error;
    }
  };
}

module.exports = { createResponseCache };
