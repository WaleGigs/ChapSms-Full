const User = require("../models/User");
const { verifyToken } = require("../utils/jwt");
const platformSettings = require("../services/platformSettingsService");

/*
 * Requests that must keep working while maintenance mode is on:
 * - the public settings endpoint (so the frontend can show the notice)
 * - admin routes (they enforce their own admin check)
 * - login, Google sign-in and /me (the controllers block non-admins, and
 *   admins need to sign in to switch maintenance off)
 * - payment webhooks and verification, so money already paid is credited
 */
const ALLOWED_PREFIXES = [
  "/api/settings/public",
  "/api/admin",
  "/api/auth/login",
  "/api/auth/google",
  "/api/auth/me",
  "/api/payment/webhook",
  "/api/payment/verify",
  "/api/payment/status",
  "/api/payment/neurapay/webhook",
  "/api/payment/neurapay/verify",
];

function isAllowedPath(path) {
  return ALLOWED_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

async function isAdminRequest(req) {
  const authorization = String(req.headers.authorization || "").trim();

  if (!authorization.startsWith("Bearer ")) {
    return false;
  }

  try {
    const decoded = verifyToken(authorization.slice(7).trim());

    if (!decoded?.id) {
      return false;
    }

    const user = await User.findById(decoded.id).select("role").lean();
    return user?.role === "admin";
  } catch {
    return false;
  }
}

const MAINTENANCE_MESSAGE =
  "We are currently performing maintenance. Please try again shortly.";

async function maintenanceGuard(req, res, next) {
  const path = String(req.path || "");

  if (!path.startsWith("/api/") || isAllowedPath(path)) {
    return next();
  }

  const settings = await platformSettings.getSettings();

  if (!settings.maintenanceMode || (await isAdminRequest(req))) {
    return next();
  }

  return res.status(503).json({
    success: false,
    code: "MAINTENANCE_MODE",
    message: MAINTENANCE_MESSAGE,
  });
}

module.exports = {
  maintenanceGuard,
  MAINTENANCE_MESSAGE,
};
