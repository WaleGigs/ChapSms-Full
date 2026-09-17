const express = require("express");

const User = require("../models/User");
const Order = require("../models/Order");
const Wallet = require("../models/Wallet");
const Payment = require("../models/Payment");

const { protect } = require("../middleware/authMiddleware");
const adminOnly = require("../middleware/adminMiddleware");

const router = express.Router();

router.use(protect, adminOnly);

/*
|--------------------------------------------------------------------------
| Response sanitizers
|--------------------------------------------------------------------------
*/

const INTERNAL_ORDER_FIELDS = new Set([
  "provider",
  "providerResponse",
  "providerData",
  "internalProvider",
]);

function sanitizeValue(value) {
  if (value === null || value === undefined) {
    return value;
  }

  if (value instanceof Date) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }

  if (typeof value !== "object") {
    return value;
  }

  const plainValue =
    typeof value.toObject === "function"
      ? value.toObject({
          virtuals: true,
          getters: true,
        })
      : value;

  return Object.entries(plainValue).reduce(
    (sanitized, [key, nestedValue]) => {
      if (INTERNAL_ORDER_FIELDS.has(key)) {
        return sanitized;
      }

      sanitized[key] = sanitizeValue(nestedValue);

      return sanitized;
    },
    {}
  );
}

function sanitizeOrder(order) {
  return sanitizeValue(order);
}

function sanitizeOrders(orders) {
  return orders.map((order) => sanitizeOrder(order));
}

/*
|--------------------------------------------------------------------------
| Dashboard
|--------------------------------------------------------------------------
*/

router.get("/dashboard", async (req, res) => {
  try {
    const [
      totalUsers,
      totalOrders,
      totalPayments,
      activeOrders,
      recentUsers,
      recentOrders,
    ] = await Promise.all([
      User.countDocuments(),
      Order.countDocuments(),
      Payment.countDocuments({
        status: "successful",
      }),
      Order.countDocuments({
        status: "waiting",
      }),

      User.find()
        .select(
          "firstName lastName email role suspended createdAt"
        )
        .sort({
          createdAt: -1,
        })
        .limit(5),

      Order.find()
        .populate(
          "user",
          "firstName lastName email"
        )
        .sort({
          createdAt: -1,
        })
        .limit(5),
    ]);

    return res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        totalOrders,
        totalPayments,
        activeOrders,
      },
      recentUsers,
      recentOrders:
        sanitizeOrders(recentOrders),
    });
  } catch (error) {
    console.error(
      "Admin dashboard error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Unable to load admin dashboard",
    });
  }
});

/*
|--------------------------------------------------------------------------
| Users
|--------------------------------------------------------------------------
*/

router.get("/users", async (req, res) => {
  try {
    const search = String(
      req.query.search || ""
    ).trim();

    const query = search
      ? {
          $or: [
            {
              firstName: {
                $regex: search,
                $options: "i",
              },
            },
            {
              lastName: {
                $regex: search,
                $options: "i",
              },
            },
            {
              email: {
                $regex: search,
                $options: "i",
              },
            },
          ],
        }
      : {};

    const users = await User.find(query)
      .select(
        "-password -verificationCodeHash -verificationExpires -passwordResetCodeHash -passwordResetExpires"
      )
      .sort({
        createdAt: -1,
      });

    return res.status(200).json({
      success: true,
      users,
    });
  } catch (error) {
    console.error(
      "Admin users error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Unable to load users",
    });
  }
});

router.patch(
  "/users/:id/status",
  async (req, res) => {
    try {
      const { suspended } = req.body;

      if (typeof suspended !== "boolean") {
        return res.status(400).json({
          success: false,
          message:
            "Suspended must be true or false",
        });
      }

      if (
        String(req.params.id) ===
        String(req.user._id)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "You cannot suspend your own admin account",
        });
      }

      const user =
        await User.findByIdAndUpdate(
          req.params.id,
          {
            suspended,
          },
          {
            new: true,
            runValidators: true,
          }
        ).select(
          "-password -verificationCodeHash -verificationExpires -passwordResetCodeHash -passwordResetExpires"
        );

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      return res.status(200).json({
        success: true,
        user,
      });
    } catch (error) {
      console.error(
        "Admin update user status error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Unable to update user status",
      });
    }
  }
);

router.patch(
  "/users/:id/role",
  async (req, res) => {
    try {
      const role = String(
        req.body.role || ""
      )
        .trim()
        .toLowerCase();

      if (!["user", "admin"].includes(role)) {
        return res.status(400).json({
          success: false,
          message: "Invalid role",
        });
      }

      if (
        String(req.params.id) ===
          String(req.user._id) &&
        role !== "admin"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "You cannot remove your own admin role",
        });
      }

      const user =
        await User.findByIdAndUpdate(
          req.params.id,
          {
            role,
          },
          {
            new: true,
            runValidators: true,
          }
        ).select(
          "-password -verificationCodeHash -verificationExpires -passwordResetCodeHash -passwordResetExpires"
        );

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      return res.status(200).json({
        success: true,
        user,
      });
    } catch (error) {
      console.error(
        "Admin update user role error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Unable to update user role",
      });
    }
  }
);

router.patch(
  "/users/:id/wallet",
  async (req, res) => {
    try {
      const amount = Number(
        req.body.amount
      );

      if (
        !Number.isFinite(amount) ||
        amount === 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Enter a valid non-zero amount",
        });
      }

      const wallet =
        await Wallet.findOne({
          user: req.params.id,
        });

      if (!wallet) {
        return res.status(404).json({
          success: false,
          message: "Wallet not found",
        });
      }

      const nextBalance =
        wallet.balance + amount;

      if (nextBalance < 0) {
        return res.status(400).json({
          success: false,
          message:
            "Wallet balance cannot go below zero",
        });
      }

      wallet.balance = nextBalance;

      wallet.transactions.unshift({
        type:
          amount > 0
            ? "deposit"
            : "withdraw",
        amount: Math.abs(amount),
        description:
          amount > 0
            ? "Admin wallet credit"
            : "Admin wallet debit",
        status: "completed",
        currency:
          wallet.currency || "NGN",
      });

      await wallet.save();

      return res.status(200).json({
        success: true,
        balance: wallet.balance,
        wallet,
      });
    } catch (error) {
      console.error(
        "Admin wallet update error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Unable to update wallet",
      });
    }
  }
);

router.delete(
  "/users/:id",
  async (req, res) => {
    try {
      if (
        String(req.params.id) ===
        String(req.user._id)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "You cannot delete your own admin account",
        });
      }

      const user = await User.findById(
        req.params.id
      );

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      await Promise.all([
        User.findByIdAndDelete(
          req.params.id
        ),
        Wallet.deleteMany({
          user: req.params.id,
        }),
        Order.deleteMany({
          user: req.params.id,
        }),
        Payment.deleteMany({
          user: req.params.id,
        }),
      ]);

      return res.status(200).json({
        success: true,
        message:
          "User deleted successfully",
      });
    } catch (error) {
      console.error(
        "Admin delete user error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Unable to delete user",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| Orders
|--------------------------------------------------------------------------
*/

router.get("/orders", async (req, res) => {
  try {
    const orders = await Order.find()
      .populate(
        "user",
        "firstName lastName email"
      )
      .sort({
        createdAt: -1,
      });

    return res.status(200).json({
      success: true,
      orders: sanitizeOrders(orders),
    });
  } catch (error) {
    console.error(
      "Admin orders error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Unable to load orders",
    });
  }
});

/*
|--------------------------------------------------------------------------
| Wallets
|--------------------------------------------------------------------------
*/

router.get(
  "/wallets",
  async (req, res) => {
    try {
      const wallets = await Wallet.find()
        .populate(
          "user",
          "firstName lastName email role"
        )
        .sort({
          updatedAt: -1,
        });

      return res.status(200).json({
        success: true,
        wallets,
      });
    } catch (error) {
      console.error(
        "Admin wallets error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Unable to load wallets",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| Payments
|--------------------------------------------------------------------------
*/

router.get(
  "/payments",
  async (req, res) => {
    try {
      const payments =
        await Payment.find()
          .populate(
            "user",
            "firstName lastName email"
          )
          .sort({
            createdAt: -1,
          });

      return res.status(200).json({
        success: true,
        payments,
      });
    } catch (error) {
      console.error(
        "Admin payments error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Unable to load payments",
      });
    }
  }
);

module.exports = router;