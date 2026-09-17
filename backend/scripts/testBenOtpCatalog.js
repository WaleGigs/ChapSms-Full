require("dotenv").config();

const axios = require("axios");

const baseURL = String(
  process.env.BENOTP_BASE_URL ||
    "https://benotp.com/stubs/handler_api.php"
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

async function call(action, extra = {}) {
  const response =
    await axios.get(
      baseURL,
      {
        params: {
          action,
          api_key:
            apiKey,
          ...extra,
        },
        timeout: 20000,
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

  return {
    status:
      response.status,
    text,
    data:
      response.data,
  };
}

async function run() {
  console.log(
    "BenOTP base URL:",
    baseURL
  );

  const balance =
    await call(
      "getBalance"
    );

  console.log(
    "\ngetBalance:",
    balance.status,
    balance.text.slice(
      0,
      200
    )
  );

  const services =
    await call(
      "getServices"
    );

  const serviceCount =
    services.data &&
    typeof services.data ===
      "object" &&
    !Array.isArray(
      services.data
    )
      ? Object.keys(
          services.data
        ).length
      : Array.isArray(
            services.data
          )
        ? services.data
            .length
        : 0;

  console.log(
    "\ngetServices:",
    services.status,
    `catalog entries=${serviceCount}`
  );

  const countries =
    await call(
      "getCountries"
    );

  console.log(
    "\ngetCountries:",
    countries.status,
    countries.text.slice(
      0,
      200
    )
  );

  console.log(
    "\nExpected current BenOTP behavior:"
  );
  console.log(
    "- getBalance: ACCESS_BALANCE:..."
  );
  console.log(
    "- getServices: JSON service catalog"
  );
  console.log(
    "- getCountries: UNKNOWN_ACTION (ChapsSmS now falls back to ISO-3166 countries)"
  );
}

run().catch((error) => {
  console.error(
    "❌ BenOTP diagnostic failed:",
    {
      code:
        error?.code,
      message:
        error?.message,
    }
  );
  process.exit(1);
});