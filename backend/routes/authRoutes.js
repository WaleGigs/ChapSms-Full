const express = require("express");

const router = express.Router();

const {
  register,
  verifyEmail,
  resendVerificationCode,
  googleAuth,
  login,
  getMe,
  forgotPassword,
  resetPassword,
  changePassword,
} = require(
  "../controllers/authController"
);

const {
  protect,
} = require(
  "../middleware/authMiddleware"
);

router.post(
  "/register",
  register
);

router.post(
  "/verify-email",
  verifyEmail
);

router.post(
  "/resend-verification",
  resendVerificationCode
);

router.post(
  "/google",
  googleAuth
);

router.post(
  "/login",
  login
);

router.post(
  "/forgot-password",
  forgotPassword
);

router.post(
  "/reset-password",
  resetPassword
);

router.post(
  "/change-password",
  protect,
  changePassword
);

router.get(
  "/me",
  protect,
  getMe
);

module.exports = router;
