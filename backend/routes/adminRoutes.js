const express = require("express");



const User = require("../models/User");

const Order = require("../models/Order");

const Wallet = require("../models/Wallet");

const Payment = require("../models/Payment");

const pricingService = require(

  "../services/pricingService"

);



const { protect } = require("../middleware/authMiddleware");

const adminOnly = require("../middleware/adminMiddleware");



const router = express.Router();



router.use(protect, adminOnly);



/*

\|--------------------------------------------------------------------------

\| Response sanitizers

\|--------------------------------------------------------------------------

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



function depositedTotalExpression(transactionsPath) {

  return {

          $sum: {

            $map: {

              input: {

                $filter: {

                  input: {

                    $ifNull: [transactionsPath, []],

                  },

                  as: "transaction",

                  cond: {

                    $and: [

                      {

                        $eq: [

                          {

                            $toLower: {

                              $ifNull: [

                                "$$transaction.type",

                                "",

                              ],

                            },

                          },

                          "deposit",

                        ],

                      },

                      {

                        $eq: [

                          {

                            $toLower: {

                              $ifNull: [

                                "$$transaction.status",

                                "",

                              ],

                            },

                          },

                          "completed",

                        ],

                      },

                      {

                        $or: [

                          {

                            $in: [

                              {

                                $toLower: {

                                  $ifNull: [

                                    "$$transaction.paymentGateway",

                                    "",

                                  ],

                                },

                              },

                              [

                                "neurapay",

                                "flutterwave",

                              ],

                            ],

                          },

                          {

                            $regexMatch: {

                              input: {

                                $ifNull: [

                                  "$$transaction.description",

                                  "",

                                ],

                              },

                              regex:

                                "^(NeuraPay|Flutterwave).*wallet funding",

                              options: "i",

                            },

                          },

                        ],

                      },

                      {

                        $or: [

                          {

                            $eq: [

                              {

                                $ifNull: [

                                  "$$transaction.environment",

                                  "",

                                ],

                              },

                              "",

                            ],

                          },

                          {

                            $eq: [

                              {

                                $toLower: {

                                  $ifNull: [

                                    "$$transaction.environment",

                                    "",

                                  ],

                                },

                              },

                              "live",

                            ],

                          },

                        ],

                      },

                    ],

                  },

                },

              },

              as: "transaction",

              in: {

                $convert: {

                  input: "$$transaction.amount",

                  to: "double",

                  onError: 0,

                  onNull: 0,

                },

              },

            },

          },

        };

}



async function getUserFinancialSummaries(userIds = []) {

  if (!userIds.length) {

    return new Map();

  }



  const rows = await Wallet.aggregate([

    {

      $match: {

        user: {

          $in: userIds,

        },

      },

    },

    {

      $project: {

        user: 1,

        balance: {

          $ifNull: ["$balance", 0],

        },

        totalDeposited: depositedTotalExpression("$transactions"),

      },

    },

  ]);



  return new Map(

    rows.map((row) => [

      String(row.user),

      {

        currentBalance:

          Number(row.balance || 0),

        totalDeposited:

          Number(row.totalDeposited || 0),

      },

    ])

  );

}



/*

\|--------------------------------------------------------------------------

\| Dashboard

\|--------------------------------------------------------------------------

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

\|--------------------------------------------------------------------------

\| Users

\|--------------------------------------------------------------------------

*/



const USER_SORTS = {
  newest: { createdAt: -1, _id: -1 },
  oldest: { createdAt: 1, _id: 1 },
  balance: null,
  deposit: null,
  email: { email: 1, _id: 1 },
  name: { firstName: 1, lastName: 1, username: 1, _id: 1 },
};

router.get("/users", async (req, res) => {
  try {
    const page = Math.max(1, Math.floor(Number(req.query.page) || 1));
    const limit = Math.min(100, Math.max(1, Math.floor(Number(req.query.limit) || 25)));
    const search = String(req.query.search || "").trim().slice(0, 100);
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const query = search ? {
      $or: ["username", "firstName", "lastName", "email"].map((field) => ({
        [field]: { $regex: escaped, $options: "i" },
      })),
    } : {};

    const sortKey = Object.hasOwn(USER_SORTS, req.query.sort) ? req.query.sort : "newest";
    const userFields = "username firstName lastName email role suspended isVerified authProvider registrationSource registrationMedium registrationCampaign lastLogin createdAt updatedAt";
    let total;
    let users;

    if (sortKey === "balance" || sortKey === "deposit") {
      // Wallet figures live on another collection, so rank in the database
      // first and then load the page of users in that order.
      const sortField = sortKey === "balance" ? "balance" : "totalDeposited";
      const [count, ranked] = await Promise.all([
        User.countDocuments(query),
        User.aggregate([
          { $match: query },
          {
            $lookup: {
              from: Wallet.collection.name,
              let: { userId: "$_id" },
              pipeline: [
                { $match: { $expr: { $eq: ["$user", "$$userId"] } } },
                {
                  $project: {
                    balance: { $ifNull: ["$balance", 0] },
                    totalDeposited: depositedTotalExpression("$transactions"),
                  },
                },
              ],
              as: "walletStats",
            },
          },
          { $addFields: { sortValue: { $ifNull: [{ $arrayElemAt: [`$walletStats.${sortField}`, 0] }, 0] } } },
          { $sort: { sortValue: -1, createdAt: -1, _id: -1 } },
          { $skip: (page - 1) * limit },
          { $limit: limit },
          { $project: { _id: 1 } },
        ]),
      ]);
      const pageUsers = await User.find({ _id: { $in: ranked.map((row) => row._id) } })
        .select(userFields)
        .lean();
      const byId = new Map(pageUsers.map((user) => [String(user._id), user]));
      total = count;
      users = ranked.map((row) => byId.get(String(row._id))).filter(Boolean);
    } else {
      [total, users] = await Promise.all([
        User.countDocuments(query),
        User.find(query)
          .select(userFields)
          .sort(USER_SORTS[sortKey])
          .collation({ locale: "en", strength: 2 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
      ]);
    }
    const financialSummaries = await getUserFinancialSummaries(users.map((user) => user._id));
    const usersWithWalletStats = users.map((user) => {
      const summary = financialSummaries.get(String(user._id)) || {
        currentBalance: 0,
        totalDeposited: 0,
      };
      return {
        ...user,
        wallet: summary.currentBalance,
        walletBalance: summary.currentBalance,
        currentBalance: summary.currentBalance,
        totalDeposited: summary.totalDeposited,
      };
    });
    res.status(200).json({
      success: true,
      users: usersWithWalletStats,
      pagination: {
        page, limit, total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
      },
    });
  } catch (error) {
    console.error("Admin users error:", error);
    res.status(500).json({ success: false, message: "Unable to load users" });
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

            returnDocument: "after",

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

            returnDocument: "after",

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

\|--------------------------------------------------------------------------

\| Global number pricing settings

\|--------------------------------------------------------------------------

*/



router.get(

  "/pricing-settings",

  async (req, res) => {

    try {

      const [

        exchangeRate,

        defaultMinimumPrice,

      ] = await Promise.all([

        pricingService.getExchangeRate({

          forceRefresh: true,

        }),

        pricingService.getDefaultMinimumPrice({

          forceRefresh: true,

        }),

      ]);



      return res.status(200).json({

        success: true,

        settings: {

          exchangeRate:

            Number(exchangeRate.rate || 0),

          exchangeRateUpdatedAt:

            exchangeRate.updatedAt || null,

          defaultMinimumPrice:

            Number(

              defaultMinimumPrice.amount || 0

            ),

          defaultMinimumPriceUpdatedAt:

            defaultMinimumPrice.updatedAt ||

            null,

        },

      });

    } catch (error) {

      console.error(

        "Admin pricing settings load error:",

        error

      );



      return res

        .status(error.status || 500)

        .json({

          success: false,

          message:

            error.message ||

            "Unable to load pricing settings",

          code:

            error.code ||

            "PRICING_SETTINGS_LOAD_FAILED",

        });

    }

  }

);



router.patch(

  "/pricing-settings",

  async (req, res) => {

    try {

      const hasExchangeRate =

        req.body?.exchangeRate !==

        undefined;



      const hasMinimumPrice =

        req.body?.defaultMinimumPrice !==

        undefined;



      if (

        !hasExchangeRate &&

        !hasMinimumPrice

      ) {

        return res.status(400).json({

          success: false,

          message:

            "Send exchangeRate or defaultMinimumPrice",

        });

      }



      if (hasExchangeRate) {

        await pricingService.setExchangeRate(

          req.body.exchangeRate,

          req.user?._id || null

        );

      }



      if (hasMinimumPrice) {

        await pricingService.setDefaultMinimumPrice(

          req.body.defaultMinimumPrice,

          req.user?._id || null

        );

      }



      const [

        exchangeRate,

        defaultMinimumPrice,

      ] = await Promise.all([

        pricingService.getExchangeRate({

          forceRefresh: true,

        }),

        pricingService.getDefaultMinimumPrice({

          forceRefresh: true,

        }),

      ]);



      return res.status(200).json({

        success: true,

        settings: {

          exchangeRate:

            Number(exchangeRate.rate || 0),

          exchangeRateUpdatedAt:

            exchangeRate.updatedAt || null,

          defaultMinimumPrice:

            Number(

              defaultMinimumPrice.amount || 0

            ),

          defaultMinimumPriceUpdatedAt:

            defaultMinimumPrice.updatedAt ||

            null,

        },

        message:

          "Pricing settings updated successfully",

      });

    } catch (error) {

      console.error(

        "Admin pricing settings update error:",

        error

      );



      return res

        .status(error.status || 500)

        .json({

          success: false,

          message:

            error.message ||

            "Unable to update pricing settings",

          code:

            error.code ||

            "PRICING_SETTINGS_UPDATE_FAILED",

        });

    }

  }

);



/*

\|--------------------------------------------------------------------------

\| Orders

\|--------------------------------------------------------------------------

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

\|--------------------------------------------------------------------------

\| Wallets

\|--------------------------------------------------------------------------

*/



router.get("/wallets", async (req, res) => {
  try {
    const page = Math.max(1, Math.floor(Number(req.query.page) || 1));
    const limit = Math.min(100, Math.max(1, Math.floor(Number(req.query.limit) || 25)));
    const search = String(req.query.search || "").trim().slice(0, 100);
    let filter = {};
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const matches = await User.find({
        $or: ["username", "firstName", "lastName", "email", "role"].map((field) => ({
          [field]: { $regex: escaped, $options: "i" },
        })),
      }).select("_id").lean();
      filter = { user: { $in: matches.map((item) => item._id) } };
    }
    const [total, wallets] = await Promise.all([
      Wallet.countDocuments(filter),
      Wallet.find(filter)
        .select("user balance testBalance currency createdAt updatedAt")
        .populate("user", "username firstName lastName email role")
        .sort({ updatedAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);
    res.status(200).json({
      success: true,
      wallets,
      pagination: {
        page, limit, total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
      },
    });
  } catch (error) {
    console.error("Admin wallets error:", error);
    res.status(500).json({ success: false, message: "Unable to load wallets" });
  }
});

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