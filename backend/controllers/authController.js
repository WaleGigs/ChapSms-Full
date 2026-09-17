const bcrypt = require("bcryptjs");
const { OAuth2Client } = require("google-auth-library");

const User = require("../models/User");
const Wallet = require("../models/Wallet");

const generateOTP = require("../utils/generateOTP");
const hashToken = require("../utils/hashToken");
const generateApiKey = require("../utils/generateApiKey");
const { generateToken } = require("../utils/jwt");

const {
  sendVerificationEmail,
  sendPasswordResetEmail,
} = require("../services/email.service");

const VERIFICATION_CODE_EXPIRY_MINUTES = 10;
const VERIFICATION_RESEND_COOLDOWN_SECONDS = 60;
const PASSWORD_RESET_EXPIRY_MINUTES = 10;

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function normalizeUsername(username) {
  return String(username || "")
    .trim();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    String(email || "").trim()
  );
}

function validatePassword(password) {
  const value = String(password || "");

  if (!value) {
    return "Password is required";
  }

  if (value.length < 6 || value.length > 64) {
    return "Password must contain 6–64 characters";
  }

  if (/\s/.test(value)) {
    return "Password must not contain spaces";
  }

  return "";
}

function getExpiryDate(minutes) {
  return new Date(
    Date.now() + minutes * 60 * 1000
  );
}

function getResendAvailableDate() {
  return new Date(
    Date.now() +
      VERIFICATION_RESEND_COOLDOWN_SECONDS *
        1000
  );
}

function getRetryAfterSeconds(date) {
  if (!date) {
    return 0;
  }

  return Math.max(
    0,
    Math.ceil(
      (new Date(date).getTime() -
        Date.now()) /
        1000
    )
  );
}

function getDisplayName(user) {
  const legacyName = [
    user?.firstName,
    user?.lastName,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return (
    user?.username ||
    legacyName ||
    "there"
  );
}

function serializeUser(
  user,
  walletBalance
) {
  return {
    id: user._id,
    username: user.username || null,
    firstName: user.firstName || null,
    lastName: user.lastName || null,
    displayName: getDisplayName(user),
    email: user.email,
    googlePicture:
      user.googlePicture || null,
    wallet:
      walletBalance ??
      user.wallet ??
      0,
    role: user.role,
    suspended: user.suspended,
    isVerified: user.isVerified,
    authProvider: user.authProvider,
    lastLogin: user.lastLogin,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function verificationTiming(user) {
  return {
    verificationExpiresAt:
      user.verificationExpires || null,
    resendAvailableAt:
      user.verificationResendAvailableAt ||
      null,
    resendCooldownSeconds:
      VERIFICATION_RESEND_COOLDOWN_SECONDS,
    retryAfterSeconds:
      getRetryAfterSeconds(
        user.verificationResendAvailableAt
      ),
  };
}

async function ensureWallet(userId) {
  /*
   * IMPORTANT PERFORMANCE FIX:
   *
   * Wallet contains an embedded transactions array. Authentication only needs
   * the current balance, so never load the entire transaction history here.
   *
   * findOneAndUpdate + $setOnInsert keeps wallet creation atomic while the
   * projection keeps the auth response lightweight as the customer's wallet
   * history grows.
   */
  try {
    const wallet =
      await Wallet.findOneAndUpdate(
        {
          user: userId,
        },
        {
          $setOnInsert: {
            user: userId,
            balance: 0,
          },
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true,
          projection: {
            balance: 1,
          },
        }
      ).lean();

    if (!wallet) {
      throw new Error(
        "Could not create the user wallet"
      );
    }

    return wallet;
  } catch (error) {
    /*
     * A unique user index protects one-wallet-per-user. If two requests race
     * to create the same wallet, recover by reading the existing balance only.
     */
    if (error?.code !== 11000) {
      throw error;
    }

    const wallet =
      await Wallet.findOne({
        user: userId,
      })
        .select("balance")
        .lean();

    if (!wallet) {
      throw error;
    }

    return wallet;
  }
}

function sanitizeGoogleUsernamePart(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 36);
}

async function createUniqueGoogleUsername({
  email,
  name,
}) {
  const emailBase =
    normalizeEmail(email).split("@")[0];

  const preferredBase =
    sanitizeGoogleUsernamePart(emailBase) ||
    sanitizeGoogleUsernamePart(name) ||
    "user";

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const suffix =
      attempt === 0
        ? ""
        : `-${Math.floor(
            1000 + Math.random() * 9000
          )}`;

    const candidate =
      `${preferredBase}${suffix}`.slice(
        0,
        50
      );

    const exists = await User.findOne({
      username: candidate,
    }).collation({
      locale: "en",
      strength: 2,
    });

    if (!exists) {
      return candidate;
    }
  }

  return `user-${Date.now()}`.slice(
    0,
    50
  );
}

function getGoogleClient() {
  const clientId = String(
    process.env.GOOGLE_CLIENT_ID || ""
  ).trim();

  if (!clientId) {
    const error = new Error(
      "Google authentication is not configured"
    );

    error.status = 503;
    error.code =
      "GOOGLE_AUTH_NOT_CONFIGURED";

    throw error;
  }

  return {
    clientId,
    client: new OAuth2Client(clientId),
  };
}

exports.register = async (req, res) => {
  try {
    const username =
      normalizeUsername(
        req.body.username
      );

    const email =
      normalizeEmail(
        req.body.email
      );

    const password =
      String(
        req.body.password || ""
      );

    if (
      !username ||
      !email ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Username, email and password are required",
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_EMAIL",
        message:
          "Enter a valid email address",
      });
    }

    const passwordError =
      validatePassword(password);

    if (passwordError) {
      return res.status(400).json({
        success: false,
        message: passwordError,
      });
    }

    const existingUser =
      await User.findOne({
        $or: [
          { email },
          { username },
        ],
      }).collation({
        locale: "en",
        strength: 2,
      });

    if (existingUser) {
      const duplicateEmail =
        existingUser.email === email;

      return res.status(409).json({
        success: false,
        code: duplicateEmail
          ? "EMAIL_ALREADY_EXISTS"
          : "USERNAME_ALREADY_EXISTS",
        message: duplicateEmail
          ? "An account with this email already exists"
          : "This username is already in use",
      });
    }

    const hashedPassword =
      await bcrypt.hash(
        password,
        12
      );

    const verificationCode =
      generateOTP(6);

    const now = new Date();

    const createdUser =
      await User.create({
        username,
        email,
        password: hashedPassword,
        authProvider: "local",
        isVerified: false,
        verificationCodeHash:
          hashToken(
            verificationCode
          ),
        verificationExpires:
          getExpiryDate(
            VERIFICATION_CODE_EXPIRY_MINUTES
          ),
        verificationLastSentAt: now,
        verificationResendAvailableAt:
          getResendAvailableDate(),
        apiKey: generateApiKey(),
      });

    let wallet;

    try {
      wallet = await ensureWallet(
        createdUser._id
      );
    } catch (walletError) {
      await User.deleteOne({
        _id: createdUser._id,
      }).catch(() => {});

      throw walletError;
    }

    try {
      await sendVerificationEmail({
        to: createdUser.email,
        username:
          getDisplayName(
            createdUser
          ),
        code: verificationCode,
      });
    } catch (emailError) {
      console.error(
        "Registration verification email failed:",
        {
          userId:
            createdUser._id.toString(),
          email: createdUser.email,
          code: emailError?.code,
          message:
            emailError?.message,
        }
      );

      return res.status(503).json({
        success: false,
        code:
          "EMAIL_DELIVERY_FAILED",
        accountCreated: true,
        email: createdUser.email,
        message:
          "Your account was created, but the verification email could not be delivered. Wait for the resend timer, then use Resend Code.",
        ...verificationTiming(
          createdUser
        ),
      });
    }

    return res.status(201).json({
      success: true,
      code: "ACCOUNT_CREATED",
      emailDelivered: true,
      message:
        "Account created successfully. A verification code was sent to your email.",
      user: serializeUser(
        createdUser,
        wallet.balance
      ),
      ...verificationTiming(
        createdUser
      ),
    });
  } catch (error) {
    console.error(
      "Registration error:",
      error
    );

    if (error.code === 11000) {
      const duplicateKey =
        Object.keys(
          error.keyPattern ||
            error.keyValue ||
            {}
        )[0];

      return res.status(409).json({
        success: false,
        code:
          duplicateKey === "username"
            ? "USERNAME_ALREADY_EXISTS"
            : "EMAIL_ALREADY_EXISTS",
        message:
          duplicateKey === "username"
            ? "This username is already in use"
            : "An account with this email already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Registration failed",
    });
  }
};

exports.verifyEmail = async (
  req,
  res
) => {
  try {
    const email =
      normalizeEmail(
        req.body.email
      );

    const verificationCode =
      String(
        req.body.code ||
          req.body
            .verificationCode ||
          ""
      ).trim();

    if (
      !email ||
      !verificationCode
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Email and verification code are required",
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_EMAIL",
        message:
          "Enter a valid email address",
      });
    }

    const user =
      await User.findOne({
        email,
      }).select(
        "+verificationCodeHash +verificationExpires +verificationLastSentAt +verificationResendAvailableAt"
      );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Account not found",
      });
    }

    if (user.isVerified) {
      return res.json({
        success: true,
        message:
          "Email is already verified",
      });
    }

    if (
      !user.verificationCodeHash ||
      !user.verificationExpires
    ) {
      return res.status(400).json({
        success: false,
        code:
          "VERIFICATION_CODE_MISSING",
        message:
          "No active verification code was found. Request a new code.",
      });
    }

    if (
      user.verificationExpires.getTime() <
      Date.now()
    ) {
      return res.status(400).json({
        success: false,
        code:
          "VERIFICATION_CODE_EXPIRED",
        message:
          "Verification code has expired. Request a new code.",
      });
    }

    if (
      hashToken(
        verificationCode
      ) !==
      user.verificationCodeHash
    ) {
      return res.status(400).json({
        success: false,
        code:
          "INVALID_VERIFICATION_CODE",
        message:
          "Invalid verification code",
      });
    }

    user.isVerified = true;
    user.verificationCodeHash = null;
    user.verificationExpires = null;
    user.verificationLastSentAt = null;
    user.verificationResendAvailableAt =
      null;

    await user.save();

    return res.json({
      success: true,
      message:
        "Email verified successfully. You can now log in.",
    });
  } catch (error) {
    console.error(
      "Email verification error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Email verification failed",
    });
  }
};

exports.resendVerificationCode =
  async (req, res) => {
    try {
      const email =
        normalizeEmail(
          req.body.email
        );

      if (!email) {
        return res.status(400).json({
          success: false,
          message: "Email is required",
        });
      }

      if (!isValidEmail(email)) {
        return res.status(400).json({
          success: false,
          code: "INVALID_EMAIL",
          message:
            "Enter a valid email address",
        });
      }

      const user =
        await User.findOne({
          email,
        }).select(
          "+verificationCodeHash +verificationExpires +verificationLastSentAt +verificationResendAvailableAt"
        );

      if (!user) {
        return res.status(404).json({
          success: false,
          message:
            "Account not found",
        });
      }

      if (
        user.authProvider !==
        "local"
      ) {
        return res.status(400).json({
          success: false,
          code:
            "GOOGLE_AUTH_REQUIRED",
          message:
            "This account uses Google authentication",
        });
      }

      if (user.isVerified) {
        return res.status(400).json({
          success: false,
          code:
            "EMAIL_ALREADY_VERIFIED",
          message:
            "Email is already verified",
        });
      }

      const retryAfterSeconds =
        getRetryAfterSeconds(
          user.verificationResendAvailableAt
        );

      if (retryAfterSeconds > 0) {
        res.set(
          "Retry-After",
          String(
            retryAfterSeconds
          )
        );

        return res.status(429).json({
          success: false,
          code:
            "VERIFICATION_RESEND_COOLDOWN",
          retryAfterSeconds,
          resendAvailableAt:
            user.verificationResendAvailableAt,
          message:
            `Please wait ${retryAfterSeconds} seconds before requesting another code.`,
        });
      }

      /*
       * Preserve the currently active code. If SMTP rejects the new email,
       * restore this state so the database does not contain a code that the
       * user never received.
       */
      const previousVerification = {
        verificationCodeHash:
          user.verificationCodeHash,
        verificationExpires:
          user.verificationExpires,
        verificationLastSentAt:
          user.verificationLastSentAt,
        verificationResendAvailableAt:
          user.verificationResendAvailableAt,
      };

      const verificationCode =
        generateOTP(6);

      user.verificationCodeHash =
        hashToken(
          verificationCode
        );

      user.verificationExpires =
        getExpiryDate(
          VERIFICATION_CODE_EXPIRY_MINUTES
        );

      user.verificationLastSentAt =
        new Date();

      user.verificationResendAvailableAt =
        getResendAvailableDate();

      await user.save();

      try {
        await sendVerificationEmail({
          to: user.email,
          username:
            getDisplayName(user),
          code: verificationCode,
        });
      } catch (emailError) {
        console.error(
          "Resend verification email failed:",
          {
            email: user.email,
            code:
              emailError?.code,
            message:
              emailError?.message,
            response:
              emailError?.response,
          }
        );

        user.verificationCodeHash =
          previousVerification
            .verificationCodeHash;

        user.verificationExpires =
          previousVerification
            .verificationExpires;

        user.verificationLastSentAt =
          previousVerification
            .verificationLastSentAt;

        user.verificationResendAvailableAt =
          previousVerification
            .verificationResendAvailableAt;

        await user.save().catch(
          (restoreError) => {
            console.error(
              "Could not restore previous verification state:",
              restoreError
            );
          }
        );

        return res.status(503).json({
          success: false,
          code:
            "EMAIL_DELIVERY_FAILED",
          accountCreated: true,
          email: user.email,
          message:
            "The verification email was not accepted by the email server. Check the backend SMTP logs and try Resend Code again.",
          ...verificationTiming(
            user
          ),
        });
      }

      return res.json({
        success: true,
        emailDelivered: true,
        email,
        message:
          "A new verification code has been sent to your email.",
        ...verificationTiming(
          user
        ),
      });
    } catch (error) {
      console.error(
        "Resend verification error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Could not resend the verification code",
      });
    }
  };

exports.googleAuth = async (
  req,
  res
) => {
  try {
    const credential =
      String(
        req.body.credential ||
          req.body.idToken ||
          ""
      ).trim();

    if (!credential) {
      return res.status(400).json({
        success: false,
        code:
          "GOOGLE_CREDENTIAL_REQUIRED",
        message:
          "Google credential is required",
      });
    }

    const {
      client,
      clientId,
    } = getGoogleClient();

    const ticket =
      await client.verifyIdToken({
        idToken: credential,
        audience: clientId,
      });

    const payload =
      ticket.getPayload();

    const googleId =
      String(
        payload?.sub || ""
      ).trim();

    const email =
      normalizeEmail(
        payload?.email
      );

    if (
      !googleId ||
      !email ||
      payload?.email_verified !== true
    ) {
      return res.status(401).json({
        success: false,
        code:
          "GOOGLE_ACCOUNT_NOT_VERIFIED",
        message:
          "Google could not verify this email account",
      });
    }

    let user =
      await User.findOne({
        $or: [
          { googleId },
          { email },
        ],
      }).select(
        "+password +verificationCodeHash +verificationExpires +verificationLastSentAt +verificationResendAvailableAt"
      );

    if (
      user?.googleId &&
      user.googleId !== googleId
    ) {
      return res.status(409).json({
        success: false,
        code:
          "GOOGLE_ACCOUNT_CONFLICT",
        message:
          "This email is already connected to another Google account",
      });
    }

    if (user?.suspended) {
      return res.status(403).json({
        success: false,
        message:
          "Your account has been suspended. Contact support.",
      });
    }

    const fullName =
      String(
        payload?.name || ""
      ).trim();

    const firstName =
      String(
        payload?.given_name ||
          fullName.split(" ")[0] ||
          ""
      ).trim() || null;

    const lastName =
      String(
        payload?.family_name ||
          fullName
            .split(" ")
            .slice(1)
            .join(" ") ||
          ""
      ).trim() || null;

    if (!user) {
      const username =
        await createUniqueGoogleUsername({
          email,
          name: fullName,
        });

      user = await User.create({
        googleId,
        authProvider: "google",
        username,
        firstName,
        lastName,
        email,
        googlePicture:
          payload?.picture || null,
        isVerified: true,
        verificationCodeHash:
          null,
        verificationExpires:
          null,
        verificationLastSentAt:
          null,
        verificationResendAvailableAt:
          null,
        apiKey: generateApiKey(),
        lastLogin: new Date(),
      });
    } else {
      user.googleId = googleId;
      user.googlePicture =
        payload?.picture ||
        user.googlePicture ||
        null;
      user.firstName =
        user.firstName ||
        firstName;
      user.lastName =
        user.lastName ||
        lastName;
      user.isVerified = true;
      user.verificationCodeHash =
        null;
      user.verificationExpires =
        null;
      user.verificationLastSentAt =
        null;
      user.verificationResendAvailableAt =
        null;
      user.lastLogin =
        new Date();

      /*
       * Preserve "local" for an existing password account.
       * This lets the owner use either password login or Google.
       */
      if (
        user.authProvider !==
        "local"
      ) {
        user.authProvider =
          "google";
      }

      await user.save();
    }

    const wallet =
      await ensureWallet(
        user._id
      );

    const token =
      generateToken(user);

    return res.json({
      success: true,
      message:
        "Google authentication successful",
      token,
      user: serializeUser(
        user,
        wallet.balance
      ),
    });
  } catch (error) {
    console.error(
      "Google authentication error:",
      {
        name: error?.name,
        code: error?.code,
        message: error?.message,
      }
    );

    if (
      error?.code ===
      "GOOGLE_AUTH_NOT_CONFIGURED"
    ) {
      return res.status(
        error.status || 503
      ).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }

    return res.status(401).json({
      success: false,
      code:
        "GOOGLE_AUTH_FAILED",
      message:
        "Google authentication failed. Please try again.",
    });
  }
};

exports.login = async (
  req,
  res
) => {
  const startedAt =
    Date.now();

  try {
    const email =
      normalizeEmail(
        req.body.email
      );

    const password =
      String(
        req.body.password || ""
      );

    if (
      !email ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Email and password are required",
      });
    }

    const userLookupStartedAt =
      Date.now();

    const user =
      await User.findOne({
        email,
      }).select("+password");

    const userLookupMs =
      Date.now() -
      userLookupStartedAt;

    if (!user) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid email or password",
      });
    }

    if (
      user.authProvider ===
        "google" &&
      !user.password
    ) {
      return res.status(400).json({
        success: false,
        code:
          "GOOGLE_AUTH_REQUIRED",
        message:
          "This account uses Google authentication. Continue with Google.",
      });
    }

    if (!user.password) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid email or password",
      });
    }

    if (user.suspended) {
      return res.status(403).json({
        success: false,
        message:
          "Your account has been suspended. Contact support.",
      });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        success: false,
        code:
          "EMAIL_NOT_VERIFIED",
        message:
          "Please verify your email before logging in.",
      });
    }

    const bcryptStartedAt =
      Date.now();

    const passwordMatch =
      await bcrypt.compare(
        password,
        user.password
      );

    const bcryptMs =
      Date.now() -
      bcryptStartedAt;

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid email or password",
      });
    }

    const walletStartedAt =
      Date.now();

    const wallet =
      await ensureWallet(
        user._id
      );

    const walletMs =
      Date.now() -
      walletStartedAt;

    /*
     * Updating lastLogin is useful metadata, but the customer should not wait
     * for an extra MongoDB write before receiving their JWT.
     */
    const loginTime =
      new Date();

    user.lastLogin =
      loginTime;

    const token =
      generateToken(user);

    const totalMs =
      Date.now() -
      startedAt;

    /*
     * DevTools can show exactly which part of a warm login is slow.
     * This is safe performance metadata; it contains no credentials.
     */
    res.set(
      "Server-Timing",
      [
        `user_lookup;dur=${userLookupMs}`,
        `password_check;dur=${bcryptMs}`,
        `wallet;dur=${walletMs}`,
        `login_total;dur=${totalMs}`,
      ].join(", ")
    );

    res.json({
      success: true,
      message:
        "Login successful",
      token,
      user: serializeUser(
        user,
        wallet.balance
      ),
    });

    /*
     * Persist lastLogin after the response is already on its way.
     * Failure here must never turn a successful authentication into a slow
     * or failed customer login.
     */
    void User.updateOne(
      {
        _id: user._id,
      },
      {
        $set: {
          lastLogin:
            loginTime,
        },
      }
    ).catch(
      (lastLoginError) => {
        console.error(
          "Could not update lastLogin:",
          {
            userId:
              String(
                user._id
              ),
            message:
              lastLoginError
                ?.message,
          }
        );
      }
    );

    if (
      totalMs > 1500
    ) {
      console.warn(
        "[Auth performance] Slow warm login:",
        {
          totalMs,
          userLookupMs,
          bcryptMs,
          walletMs,
        }
      );
    }

    return;
  } catch (error) {
    console.error(
      "Login error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Login failed",
    });
  }
};

exports.getMe = async (
  req,
  res
) => {
  try {
    const userId =
      req.user?._id ||
      req.user?.id;

    if (!userId) {
      return res
        .status(401)
        .json({
          success: false,
          message:
            "Authentication required",
        });
    }

    const user =
      await User.findById(
        userId
      );

    if (!user) {
      return res
        .status(404)
        .json({
          success: false,
          message:
            "User account not found",
        });
    }

    if (user.suspended) {
      return res
        .status(403)
        .json({
          success: false,
          message:
            "Your account has been suspended. Contact support.",
        });
    }

    let wallet =
      await Wallet.findOne({
        user: user._id,
      });

    if (!wallet) {
      wallet =
        await Wallet.create({
          user: user._id,
          balance: 0,
        });
    }

    return res.json({
      success: true,
      user: serializeUser(
        user,
        wallet.balance
      ),
    });
  } catch (error) {
    console.error(
      "Get current user error:",
      error
    );

    return res
      .status(500)
      .json({
        success: false,
        message:
          "Could not retrieve the current user",
      });
  }
};

exports.forgotPassword =
  async (req, res) => {
    try {
      const email =
        normalizeEmail(
          req.body.email
        );

      if (!email) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Email is required",
          });
      }

      if (!isValidEmail(email)) {
        return res
          .status(400)
          .json({
            success: false,
            code:
              "INVALID_EMAIL",
            message:
              "Enter a valid email address",
          });
      }

      const genericResponse = {
        success: true,
        message:
          "If an account exists with that email, a password reset code has been sent.",
      };

      const user =
        await User.findOne({
          email,
        }).select(
          "+passwordResetCodeHash +passwordResetExpires"
        );

      if (
        !user ||
        user.authProvider !==
          "local" ||
        user.suspended
      ) {
        return res.json(
          genericResponse
        );
      }

      const resetCode =
        generateOTP(6);

      user.passwordResetCodeHash =
        hashToken(resetCode);

      user.passwordResetExpires =
        getExpiryDate(
          PASSWORD_RESET_EXPIRY_MINUTES
        );

      await user.save();

      try {
        await sendPasswordResetEmail({
          to: user.email,
          username:
            getDisplayName(user),
          code:
            resetCode,
        });
      } catch (emailError) {
        console.error(
          "Password reset email failed:",
          emailError
        );

        return res
          .status(503)
          .json({
            success: false,
            code:
              "EMAIL_DELIVERY_FAILED",
            message:
              "We could not send the password reset email. Check the SMTP settings and try again.",
          });
      }

      return res.json(
        genericResponse
      );
    } catch (error) {
      console.error(
        "Forgot password error:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          message:
            "Password reset request failed",
        });
    }
  };

exports.resetPassword =
  async (req, res) => {
    try {
      const email =
        normalizeEmail(
          req.body.email
        );

      const resetCode =
        String(
          req.body.code ||
            req.body.resetCode ||
            ""
        ).trim();

      const password =
        String(
          req.body.password ||
            ""
        );

      const confirmPassword =
        String(
          req.body
            .confirmPassword ||
            ""
        );

      if (
        !email ||
        !resetCode ||
        !password
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Email, reset code and new password are required",
          });
      }

      if (!isValidEmail(email)) {
        return res
          .status(400)
          .json({
            success: false,
            code:
              "INVALID_EMAIL",
            message:
              "Enter a valid email address",
          });
      }

      if (
        confirmPassword &&
        password !==
          confirmPassword
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Passwords do not match",
          });
      }

      const passwordError =
        validatePassword(
          password
        );

      if (passwordError) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              passwordError,
          });
      }

      const user =
        await User.findOne({
          email,
        }).select(
          "+password +passwordResetCodeHash +passwordResetExpires"
        );

      if (
        !user ||
        user.authProvider !==
          "local" ||
        !user.passwordResetCodeHash ||
        !user.passwordResetExpires
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Invalid or expired password reset code",
          });
      }

      if (
        user.passwordResetExpires.getTime() <
        Date.now()
      ) {
        user.passwordResetCodeHash =
          null;

        user.passwordResetExpires =
          null;

        await user.save();

        return res
          .status(400)
          .json({
            success: false,
            message:
              "Password reset code has expired",
          });
      }

      if (
        hashToken(resetCode) !==
        user.passwordResetCodeHash
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Invalid or expired password reset code",
          });
      }

      user.password =
        await bcrypt.hash(
          password,
          12
        );

      user.passwordResetCodeHash =
        null;

      user.passwordResetExpires =
        null;

      await user.save();

      return res.json({
        success: true,
        message:
          "Password reset successfully. You can now log in.",
      });
    } catch (error) {
      console.error(
        "Reset password error:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          message:
            "Password reset failed",
        });
    }
  };

exports.changePassword =
  async (req, res) => {
    try {
      const userId =
        req.user?._id ||
        req.user?.id;

      const currentPassword =
        String(
          req.body
            .currentPassword ||
            ""
        );

      const newPassword =
        String(
          req.body.newPassword ||
            ""
        );

      const confirmPassword =
        String(
          req.body
            .confirmPassword ||
            ""
        );

      if (
        !currentPassword ||
        !newPassword ||
        !confirmPassword
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Current password, new password and confirmation are required",
          });
      }

      if (
        newPassword !==
        confirmPassword
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "New passwords do not match",
          });
      }

      const passwordError =
        validatePassword(
          newPassword
        );

      if (passwordError) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              passwordError,
          });
      }

      if (
        currentPassword ===
        newPassword
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "New password must be different from the current password",
          });
      }

      const user =
        await User.findById(
          userId
        ).select("+password");

      if (!user) {
        return res
          .status(404)
          .json({
            success: false,
            message:
              "User account not found",
          });
      }

      if (
        user.authProvider !==
        "local"
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Google-authenticated accounts do not have a local password",
          });
      }

      const passwordMatches =
        await bcrypt.compare(
          currentPassword,
          user.password
        );

      if (!passwordMatches) {
        return res
          .status(401)
          .json({
            success: false,
            message:
              "Current password is incorrect",
          });
      }

      user.password =
        await bcrypt.hash(
          newPassword,
          12
        );

      user.passwordResetCodeHash =
        null;

      user.passwordResetExpires =
        null;

      await user.save();

      return res.json({
        success: true,
        message:
          "Password changed successfully",
      });
    } catch (error) {
      console.error(
        "Change password error:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          message:
            "Password change failed",
        });
    }
  };