const crypto = require("crypto");

function generateApiKey() {
  return (
    "chp_live_" +
    crypto.randomBytes(24).toString("hex")
  );
}

module.exports = generateApiKey;