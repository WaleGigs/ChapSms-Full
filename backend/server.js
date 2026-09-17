require("dotenv").config();

const dns =
  require("node:dns");

const mongoose =
  require("mongoose");

const app =
  require("./app");
const socialRoutes = require("./routes/socialRoutes");
const {
  validateEmailConfiguration,
} =
  require(
    "./services/email.service",
  );

/*
 * Prefer IPv4 for external provider connections.
 * This no longer affects email delivery because Resend uses HTTPS.
 */
dns.setDefaultResultOrder(
  "ipv4first",
);

const PORT =
  Number(
    process.env.PORT ||
      5050,
  );

const HOST =
  "0.0.0.0";

const isProduction =
  process.env.NODE_ENV ===
  "production";
app.use("/api/social", socialRoutes);
async function startServer() {
  const startedAt =
    Date.now();

  try {
    if (
      !process.env.MONGO_URI
    ) {
      throw new Error(
        "MONGO_URI is missing from the backend environment",
      );
    }

    /*
     * Validate Resend locally. This performs NO network request,
     * so an unavailable email provider cannot delay server startup.
     */
    try {
      const emailConfig =
        validateEmailConfiguration();

      console.log(
        "✅ Email provider configured:",
        {
          provider:
            emailConfig.provider,
          from:
            emailConfig.from,
        },
      );
    } catch (emailError) {
      if (isProduction) {
        throw emailError;
      }

      console.warn(
        "⚠️ Email configuration is incomplete. Verification emails will fail until it is configured:",
        emailError.message,
      );
    }

    const mongoStartedAt =
      Date.now();

    await mongoose.connect(
      process.env.MONGO_URI,
    );

    console.log(
      "✅ MongoDB connected",
      {
        durationMs:
          Date.now() -
          mongoStartedAt,
      },
    );

    app.listen(
      PORT,
      HOST,
      () => {
        console.log(
          `🚀 Server running on ${HOST}:${PORT}`,
        );

        console.log(
          "✅ API startup complete",
          {
            durationMs:
              Date.now() -
              startedAt,
          },
        );
      },
    );
  } catch (error) {
    console.error(
      "❌ Startup Error:",
      {
        name:
          error?.name,
        code:
          error?.code,
        message:
          error?.message,
      },
    );

    process.exit(1);
  }
}

startServer();