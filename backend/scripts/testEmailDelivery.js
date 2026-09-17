require("dotenv").config();

const {
  validateEmailConfiguration,
  sendVerificationEmail,
} =
  require(
    "../services/email.service",
  );

function createTestCode() {
  return String(
    Math.floor(
      100000 +
        Math.random() *
          900000,
    ),
  );
}

async function run() {
  const recipient =
    String(
      process.argv[2] ||
        process.env
          .EMAIL_TEST_RECIPIENT ||
        "",
    )
      .trim()
      .toLowerCase();

  if (!recipient) {
    throw new Error(
      "Pass a recipient email: node scripts/testEmailDelivery.js you@gmail.com",
    );
  }

  const config =
    validateEmailConfiguration();

  console.log(
    "Testing email provider:",
    {
      provider:
        config.provider,
      from:
        config.from,
      recipient,
    },
  );

  const code =
    createTestCode();

  const result =
    await sendVerificationEmail({
      to: recipient,
      username:
        "ChapsSmS Test User",
      code,
    });

  console.log(
    "✅ Test verification email submitted successfully:",
    {
      provider:
        result.provider,
      messageId:
        result.messageId,
      recipient,
      code,
    },
  );
}

run()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(
      "❌ Email test failed:",
      {
        name:
          error?.name,
        code:
          error?.code,
        message:
          error?.message,
        statusCode:
          error?.statusCode,
      },
    );

    process.exit(1);
  });