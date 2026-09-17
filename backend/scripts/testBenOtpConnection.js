require("dotenv").config();

const axios = require("axios");
const crypto = require("node:crypto");

const baseURL = String(
  process.env.BENOTP_BASE_URL ||
    "https://benotp.com/stubs/handler.php"
)
  .trim()
  .replace(/\/+$/, "");

const apiKey = String(
  process.env.BENOTP_API_KEY || ""
).trim();

if (!apiKey) {
  console.error(
    "❌ BENOTP_API_KEY is missing"
  );
  process.exit(1);
}

const fingerprint = crypto
  .createHash("sha256")
  .update(apiKey)
  .digest("hex")
  .slice(0, 12);

async function run() {
  console.log(
    "Testing BenOTP configuration:",
    {
      baseURL,
      apiKeyFingerprint:
        fingerprint,
      apiKeyLength:
        apiKey.length,
    }
  );

  const response =
    await axios.get(
      baseURL,
      {
        params: {
          action:
            "getBalance",
          api_key:
            apiKey,
        },
        timeout: 20000,
        maxRedirects: 0,
        validateStatus:
          () => true,
        headers: {
          Accept: "*/*",
        },
      }
    );

  const text =
    typeof response.data ===
    "string"
      ? response.data.trim()
      : JSON.stringify(
          response.data
        );

  console.log(
    "HTTP status:",
    response.status
  );

  if (
    response.headers?.location
  ) {
    console.log(
      "Redirect location:",
      response.headers
        .location
    );
  }

  if (
    /^<!doctype\s+html/i.test(
      text
    ) ||
    /^<html[\s>]/i.test(
      text
    )
  ) {
    console.error(
      "❌ BenOTP returned HTML. The API key loaded by this backend does not match the working Postman configuration, or BenOTP is redirecting this backend request."
    );

    process.exit(2);
  }

  console.log(
    "✅ BenOTP API response:",
    text.slice(0, 500)
  );
}

run().catch((error) => {
  console.error(
    "❌ BenOTP test failed:",
    {
      code:
        error?.code,
      message:
        error?.message,
    }
  );

  process.exit(1);
});