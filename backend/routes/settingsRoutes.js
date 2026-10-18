const express = require("express");

const { protect } = require("../middleware/authMiddleware");
const adminOnly = require("../middleware/adminMiddleware");
const platformSettings = require("../services/platformSettingsService");

/*
 * Public: GET /api/settings/public
 */
const publicRouter = express.Router();

publicRouter.get("/public", async (_req, res) => {
  const settings = await platformSettings.getPublicSettings();

  res.set("Cache-Control", "no-store");

  return res.json({
    success: true,
    settings,
  });
});

/*
 * Admin: GET/PUT /api/admin/settings
 */
const adminRouter = express.Router();

adminRouter.use(protect, adminOnly);

adminRouter.get("/", async (_req, res) => {
  try {
    const result = await platformSettings.getSettingsWithMeta();

    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Admin settings load error:", error);

    return res.status(error.status || 500).json({
      success: false,
      code: error.code || "SETTINGS_LOAD_FAILED",
      message: "Unable to load platform settings",
    });
  }
});

adminRouter.put("/", async (req, res) => {
  try {
    const result = await platformSettings.updateSettings(req.body || {}, {
      adminId: req.user?._id || null,
    });

    return res.json({
      success: true,
      message: "Settings saved successfully",
      ...result,
    });
  } catch (error) {
    if (error.status && error.status < 500) {
      return res.status(error.status).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }

    console.error("Admin settings update error:", error);

    return res.status(error.status || 500).json({
      success: false,
      code: error.code || "SETTINGS_UPDATE_FAILED",
      message: "Unable to save platform settings",
    });
  }
});

module.exports = {
  publicRouter,
  adminRouter,
};
