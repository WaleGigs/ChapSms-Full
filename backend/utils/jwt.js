const jwt = require("jsonwebtoken");

function getJwtSecret() {
  const secret = String(
    process.env.JWT_SECRET ||
      ""
  ).trim();

  if (!secret) {
    throw new Error(
      "JWT_SECRET is missing from the backend .env file"
    );
  }

  return secret;
}

function generateToken(user) {
  const userId =
    user?._id?.toString?.() ||
    user?.id?.toString?.();

  if (!userId) {
    throw new Error(
      "Cannot generate token without a user ID"
    );
  }

  return jwt.sign(
    {
      id: userId,
      role:
        user.role ||
        "user",
    },
    getJwtSecret(),
    {
      expiresIn:
        process.env
          .JWT_EXPIRES ||
        "7d",

      issuer:
        "chapsms-api",

      audience:
        "chapsms-web",
    }
  );
}

function verifyToken(token) {
  if (
    !token ||
    typeof token !==
      "string"
  ) {
    throw new Error(
      "JWT token must be a non-empty string"
    );
  }

  return jwt.verify(
    token.trim(),
    getJwtSecret(),
    {
      issuer:
        "chapsms-api",

      audience:
        "chapsms-web",
    }
  );
}

module.exports = {
  generateToken,
  verifyToken,
};