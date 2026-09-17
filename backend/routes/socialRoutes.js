const express = require("express");

const {
  getCatalog,
  refreshCatalog,
  buySocialProduct,
  getOrders,
} = require("../controllers/socialController");

const {
  getAdminCatalog,
  setVisibility,
  getHouseProducts,
  createHouseProduct,
  updateHouseProduct,
  addHouseStock,
  getSocialPricing,
  saveSocialGlobalPricing,
  saveSocialProductRule,
  deleteSocialProductRule,
  getSocialAdminSummary,
  getAdminSocialOrders,
} = require("../controllers/socialAdminController");

const { protect, admin } = require("../middleware/authMiddleware");

const router = express.Router();
router.use(protect);

/* Customer */
router.get("/catalog", getCatalog);
router.get("/orders", getOrders);
router.post("/orders", buySocialProduct);

/* Admin catalog + visibility */
router.get("/admin/catalog", admin, getAdminCatalog);
router.patch("/admin/visibility", admin, setVisibility);

/* Admin social pricing */
router.get("/admin/pricing", admin, getSocialPricing);
router.put("/admin/pricing/global", admin, saveSocialGlobalPricing);
router.put("/admin/pricing/product", admin, saveSocialProductRule);
router.delete(
  "/admin/pricing/product/:provider/:providerProductId",
  admin,
  deleteSocialProductRule
);

/* Admin social metrics/orders */
router.get("/admin/summary", admin, getSocialAdminSummary);
router.get("/admin/orders", admin, getAdminSocialOrders);

/* House stock */
router.get("/admin/house-products", admin, getHouseProducts);
router.post("/admin/house-products", admin, createHouseProduct);
router.patch("/admin/house-products/:id", admin, updateHouseProduct);
router.post("/admin/house-products/:id/stock", admin, addHouseStock);

/* Manual upstream refresh */
router.post("/refresh", admin, refreshCatalog);

module.exports = router;