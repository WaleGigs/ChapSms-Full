const Order = require("../models/Order");

const LAGOS_OFFSET_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function lagosDayStart(now = new Date()) {
  const local = new Date(now.getTime() + LAGOS_OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - LAGOS_OFFSET_MS);
}

function dateKey(date) {
  return new Date(date.getTime() + LAGOS_OFFSET_MS).toISOString().slice(0, 10);
}

exports.getDailyMetrics = async (req, res) => {
  try {
    const requestedDays = Number(req.query.days ?? req.query.range ?? 7);
    if (!Number.isInteger(requestedDays) || ![7, 14, 30].includes(requestedDays)) {
      return res.status(400).json({ success: false, message: "days must be 7, 14, or 30" });
    }

    const today = lagosDayStart();
    const start = new Date(today.getTime() - (requestedDays - 1) * DAY_MS);
    const end = new Date(today.getTime() + DAY_MS);
    const configuredStart = process.env.ADMIN_DASHBOARD_START_AT
      ? new Date(process.env.ADMIN_DASHBOARD_START_AT)
      : null;
    const effectiveStart = configuredStart && !Number.isNaN(configuredStart.getTime()) && configuredStart > start
      ? configuredStart
      : start;

    const rows = await Order.aggregate([
      { $match: { createdAt: { $gte: effectiveStart, $lt: end } } },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Africa/Lagos" },
          },
          orders: { $sum: 1 },
          receivedOtps: {
            $sum: {
              $cond: [
                { $or: [{ $eq: ["$status", "received"] }, { $ne: [{ $ifNull: ["$otpReceivedAt", null] }, null] }] },
                1, 0,
              ],
            },
          },
          refundedOrders: { $sum: { $cond: [{ $eq: ["$refunded", true] }, 1, 0] } },
          revenue: { $sum: { $cond: [{ $eq: ["$refunded", true] }, 0, { $ifNull: ["$sellingPrice", { $ifNull: ["$price", 0] }] }] } },
          cost: { $sum: { $cond: [{ $eq: ["$refunded", true] }, 0, { $ifNull: ["$providerCostNgn", 0] }] } },
          profit: { $sum: { $cond: [{ $eq: ["$refunded", true] }, 0, { $ifNull: ["$profit", 0] }] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const byDate = new Map(rows.map((row) => [row._id, row]));
    const days = Array.from({ length: requestedDays }, (_, index) => {
      const date = dateKey(new Date(start.getTime() + index * DAY_MS));
      const item = byDate.get(date) || {};
      return {
        date,
        orders: Number(item.orders || 0),
        receivedOtps: Number(item.receivedOtps || 0),
        refundedOrders: Number(item.refundedOrders || 0),
        revenue: Number(item.revenue || 0),
        cost: Number(item.cost || 0),
        profit: Number(item.profit || 0),
      };
    });

    const totals = days.reduce((result, day) => {
      for (const key of ["orders", "receivedOtps", "refundedOrders", "revenue", "cost", "profit"]) {
        result[key] += day[key];
      }
      return result;
    }, { orders: 0, receivedOtps: 0, refundedOrders: 0, revenue: 0, cost: 0, profit: 0 });

    return res.json({
      success: true,
      days: requestedDays,
      timezone: "Africa/Lagos",
      currency: "NGN",
      scope: "numbers",
      period: { start: dateKey(start), end: dateKey(today) },
      totals,
      daily: days,
      dailyMetrics: days,
      note: "Number orders only; account/VPN orders are not included. Revenue, cost, and profit exclude refunded number orders.",
    });
  } catch (error) {
    console.error("Admin daily metrics error:", error);
    return res.status(500).json({ success: false, message: "Unable to load daily metrics" });
  }
};
