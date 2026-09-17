require("dotenv").config();

const benOtp = require(
  "../services/providers/benOtp"
);

async function run() {
  console.log(
    "Testing the actual ChapsSmS BenOTP provider module..."
  );

  const balance =
    await benOtp.getBalance();

  console.log(
    "✅ Balance:",
    balance.balance
  );

  const services =
    await benOtp.getServices();

  const serviceCount =
    Array.isArray(services)
      ? services.length
      : services &&
          typeof services ===
            "object"
        ? Object.keys(
            services
          ).length
        : 0;

  console.log(
    "✅ Services:",
    serviceCount
  );

  const countries =
    await benOtp.getCountries();

  console.log(
    "✅ Countries:",
    Array.isArray(countries)
      ? countries.length
      : 0,
    "(local ISO fallback; no BenOTP getCountries request)"
  );
}

run().catch((error) => {
  console.error(
    "❌ Provider test failed:",
    {
      message:
        error?.message,
      code:
        error?.code,
      rawResponse:
        error?.rawResponse,
    }
  );
  process.exit(1);
});