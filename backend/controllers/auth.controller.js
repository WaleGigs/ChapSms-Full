const bcrypt = require("bcrypt");
const User = require("../models/User");

const generateOTP = require("../utils/generateOTP");
const hashToken = require("../utils/hashToken");
const generateApiKey = require("../utils/generateApiKey");

const { generateToken } = require("../utils/jwt");

const transporter = require("../services/email.service");

const signup = async (req, res) => {
  try {
    // We'll build this next
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const verifyEmail = async (req, res) => {
  try {
    // Next step
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const login = async (req, res) => {
  try {
    // Next step
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const me = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    return res.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  signup,
  verifyEmail,
  login,
  me,
};