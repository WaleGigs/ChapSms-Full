const axios = require("axios");
const platformSettings = require("./platformSettingsService");

const BREVO_API_KEY =
  String(
    process.env.BREVO_API_KEY ||
      "",
  ).trim();

const EMAIL_FROM =
  String(
    process.env.EMAIL_FROM ||
      "",
  ).trim();

const EMAIL_REPLY_TO =
  String(
    process.env.EMAIL_REPLY_TO ||
      "",
  ).trim();

function parseSender(value) {
  const match = String(value || "").trim().match(/^(.+?)\s*<([^<>]+)>$/);
  return match
    ? { name: match[1].trim().replace(/^['"]|['"]$/g, ""), email: match[2].trim() }
    : { email: String(value || "").trim() };
}

function isValidEmailAddress(
  value,
) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    String(
      value || "",
    ).trim(),
  );
}

function validateEmailConfiguration() {
  const missing = [];

  if (!BREVO_API_KEY) {
    missing.push(
      "BREVO_API_KEY",
    );
  }

  if (!EMAIL_FROM) {
    missing.push(
      "EMAIL_FROM",
    );
  }

  if (EMAIL_FROM && !isValidEmailAddress(parseSender(EMAIL_FROM).email)) {
    const error = new Error("EMAIL_FROM must contain a valid email address");
    error.code = "EMAIL_CONFIG_INVALID";
    throw error;
  }

  if (EMAIL_REPLY_TO && !isValidEmailAddress(parseSender(EMAIL_REPLY_TO).email)) {
    const error = new Error("EMAIL_REPLY_TO must contain a valid email address");
    error.code = "EMAIL_CONFIG_INVALID";
    throw error;
  }

  if (missing.length > 0) {
    const error =
      new Error(
        `Missing email environment variables: ${missing.join(
          ", ",
        )}`,
      );

    error.code =
      "EMAIL_CONFIG_MISSING";

    throw error;
  }

  return {
    provider: "brevo",
    from: EMAIL_FROM,
    replyTo:
      EMAIL_REPLY_TO ||
      null,
  };
}

function escapeHtml(value) {
  return String(
    value || "",
  )
    .replace(
      /&/g,
      "&amp;",
    )
    .replace(
      /</g,
      "&lt;",
    )
    .replace(
      />/g,
      "&gt;",
    )
    .replace(
      /"/g,
      "&quot;",
    )
    .replace(
      /'/g,
      "&#039;",
    );
}

function getGreetingName({
  username,
  firstName,
}) {
  return (
    String(
      username ||
        firstName ||
        "there",
    ).trim() ||
    "there"
  );
}

function createEmailError(
  providerError,
) {
  const error =
    new Error(
      providerError?.message ||
        "The email provider rejected the message",
    );

  error.code =
    providerError?.name ||
    providerError?.code ||
    "EMAIL_PROVIDER_ERROR";

  error.provider =
    "brevo";

  if (
    providerError?.response?.status || providerError?.statusCode
  ) {
    error.statusCode =
      providerError?.response?.status || providerError.statusCode;
  }

  return error;
}

async function sendEmail({
  to,
  subject,
  text,
  html,
}) {
  const recipient =
    String(
      to || "",
    )
      .trim()
      .toLowerCase();

  if (
    !isValidEmailAddress(
      recipient,
    )
  ) {
    const error =
      new Error(
        "A valid email recipient is required",
      );

    error.code =
      "INVALID_EMAIL_RECIPIENT";

    throw error;
  }

  validateEmailConfiguration();

  const payload = {
    sender: parseSender(EMAIL_FROM),
    to: [{ email: recipient }],
    subject,
    textContent: text,
    htmlContent: html,
  };

  if (EMAIL_REPLY_TO) {
    payload.replyTo = parseSender(EMAIL_REPLY_TO);
  }

  const startedAt =
    Date.now();

  try {
    const { data } = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      payload,
      {
        headers: {
          "api-key": BREVO_API_KEY,
          "Content-Type": "application/json",
          accept: "application/json",
        },
        timeout: 15000,
      },
    );

    if (!data?.messageId) {
      const error =
        new Error(
          "The email provider did not return a message ID",
        );

      error.code =
        "EMAIL_PROVIDER_RESPONSE_INVALID";

      throw error;
    }

    console.log(
      "✅ Brevo accepted email:",
      {
        to: recipient,
        messageId:
          data.messageId,
        durationMs:
          Date.now() -
          startedAt,
      },
    );

    return {
      provider: "brevo",
      id: data.messageId,
      messageId:
        data.messageId,
      accepted: [
        recipient,
      ],
    };
  } catch (providerError) {
    const error = providerError?.response
      ? createEmailError({
          message: providerError.response.data?.message || "Brevo rejected the email",
          code: providerError.response.data?.code || "EMAIL_PROVIDER_ERROR",
          statusCode: providerError.response.status,
        })
      : providerError;
    console.error(
      "❌ Brevo email failed:",
      {
        to: recipient,
        code:
          error?.code ||
          error?.name,
        message:
          error?.message,
        statusCode:
          error?.statusCode,
        durationMs:
          Date.now() -
          startedAt,
      },
    );

    throw error;
  }
}

/* Platform name and support contact come from the admin settings. */
async function getBrand() {
  const settings =
    await platformSettings.getSettings();

  const brandName =
    settings.platformName;

  const supportEmail =
    settings.supportEmail;

  return {
    brandName,
    safeBrand:
      escapeHtml(brandName),
    supportText: supportEmail
      ? `\n\nNeed help? Contact ${supportEmail}.`
      : "",
    supportHtml: supportEmail
      ? `

            <p style="margin:12px 0 0;font-size:13px;line-height:1.6;color:#94a3b8;">
              Need help? Contact
              <a href="mailto:${escapeHtml(supportEmail)}" style="color:#2563eb;">${escapeHtml(supportEmail)}</a>.
            </p>`
      : "",
  };
}

async function sendVerificationEmail({
  to,
  username,
  firstName,
  code,
}) {
  const verificationCode =
    String(
      code || "",
    ).trim();

  if (
    !/^\d{6}$/.test(
      verificationCode,
    )
  ) {
    const error =
      new Error(
        "A six-digit verification code is required",
      );

    error.code =
      "INVALID_VERIFICATION_CODE";

    throw error;
  }

  const greetingName =
    getGreetingName({
      username,
      firstName,
    });

  const safeName =
    escapeHtml(
      greetingName,
    );

  const { brandName, safeBrand, supportText, supportHtml } =
    await getBrand();

  const safeCode =
    escapeHtml(
      verificationCode,
    );

  return sendEmail({
    to,

    subject:
      `Verify your ${brandName} account`,

    text: `
Hello ${greetingName},

Your ${brandName} verification code is:

${verificationCode}

This code expires in 10 minutes.

If you did not create this account, you can ignore this email.${supportText}
    `.trim(),

    html: `
      <div style="margin:0;background:#f8fafc;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
        <div style="max-width:560px;margin:0 auto;overflow:hidden;border:1px solid #e2e8f0;border-radius:20px;background:#ffffff;">
          <div style="background:#2563eb;padding:28px 28px 24px;color:#ffffff;">
            <div style="font-size:22px;font-weight:800;">${safeBrand}</div>
            <div style="margin-top:6px;font-size:14px;color:#dbeafe;">
              Email verification
            </div>
          </div>

          <div style="padding:30px 28px;">
            <h1 style="margin:0;font-size:24px;line-height:1.25;">
              Verify your email address
            </h1>

            <p style="margin:18px 0 0;line-height:1.7;color:#475569;">
              Hello ${safeName},
            </p>

            <p style="margin:12px 0 0;line-height:1.7;color:#475569;">
              Enter this code on ${safeBrand} to finish creating your account.
            </p>

            <div style="margin:26px 0;padding:22px;border-radius:14px;background:#eff6ff;text-align:center;color:#1d4ed8;font-size:34px;font-weight:800;letter-spacing:9px;">
              ${safeCode}
            </div>

            <p style="margin:0;line-height:1.7;color:#475569;">
              This code expires in 10 minutes.
            </p>

            <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#94a3b8;">
              If you did not create this account, you can ignore this email.
            </p>${supportHtml}
          </div>
        </div>
      </div>
    `,
  });
}

async function sendPasswordResetEmail({
  to,
  username,
  firstName,
  code,
}) {
  const resetCode =
    String(
      code || "",
    ).trim();

  if (
    !/^\d{6}$/.test(
      resetCode,
    )
  ) {
    const error =
      new Error(
        "A six-digit password-reset code is required",
      );

    error.code =
      "INVALID_PASSWORD_RESET_CODE";

    throw error;
  }

  const greetingName =
    getGreetingName({
      username,
      firstName,
    });

  const safeName =
    escapeHtml(
      greetingName,
    );

  const { brandName, safeBrand, supportText, supportHtml } =
    await getBrand();

  const safeCode =
    escapeHtml(
      resetCode,
    );

  return sendEmail({
    to,

    subject:
      `Reset your ${brandName} password`,

    text: `
Hello ${greetingName},

Your ${brandName} password-reset code is:

${resetCode}

This code expires in 10 minutes.

If you did not request a password reset, you can ignore this email.${supportText}
    `.trim(),

    html: `
      <div style="margin:0;background:#f8fafc;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
        <div style="max-width:560px;margin:0 auto;overflow:hidden;border:1px solid #e2e8f0;border-radius:20px;background:#ffffff;">
          <div style="background:#2563eb;padding:28px 28px 24px;color:#ffffff;">
            <div style="font-size:22px;font-weight:800;">${safeBrand}</div>
            <div style="margin-top:6px;font-size:14px;color:#dbeafe;">
              Password reset
            </div>
          </div>

          <div style="padding:30px 28px;">
            <h1 style="margin:0;font-size:24px;line-height:1.25;">
              Reset your password
            </h1>

            <p style="margin:18px 0 0;line-height:1.7;color:#475569;">
              Hello ${safeName},
            </p>

            <p style="margin:12px 0 0;line-height:1.7;color:#475569;">
              Enter this code on ${safeBrand} to continue resetting your password.
            </p>

            <div style="margin:26px 0;padding:22px;border-radius:14px;background:#eff6ff;text-align:center;color:#1d4ed8;font-size:34px;font-weight:800;letter-spacing:9px;">
              ${safeCode}
            </div>

            <p style="margin:0;line-height:1.7;color:#475569;">
              This code expires in 10 minutes.
            </p>

            <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#94a3b8;">
              If you did not request this password reset, you can ignore this email.
            </p>${supportHtml}
          </div>
        </div>
      </div>
    `,
  });
}

module.exports = {
  validateEmailConfiguration,
  sendVerificationEmail,
  sendPasswordResetEmail,
};
