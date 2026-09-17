const {
  Resend,
} = require("resend");

const RESEND_API_KEY =
  String(
    process.env.RESEND_API_KEY ||
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

let resendClient = null;

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

  if (!RESEND_API_KEY) {
    missing.push(
      "RESEND_API_KEY",
    );
  }

  if (!EMAIL_FROM) {
    missing.push(
      "EMAIL_FROM",
    );
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
    provider: "resend",
    from: EMAIL_FROM,
    replyTo:
      EMAIL_REPLY_TO ||
      null,
  };
}

function getResendClient() {
  validateEmailConfiguration();

  if (!resendClient) {
    resendClient =
      new Resend(
        RESEND_API_KEY,
      );
  }

  return resendClient;
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
    "resend";

  if (
    providerError?.statusCode
  ) {
    error.statusCode =
      providerError.statusCode;
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

  const client =
    getResendClient();

  const payload = {
    from: EMAIL_FROM,
    to: [recipient],
    subject,
    text,
    html,
  };

  if (EMAIL_REPLY_TO) {
    payload.replyTo =
      EMAIL_REPLY_TO;
  }

  const startedAt =
    Date.now();

  try {
    const {
      data,
      error:
        providerError,
    } =
      await client.emails.send(
        payload,
      );

    if (providerError) {
      throw createEmailError(
        providerError,
      );
    }

    if (!data?.id) {
      const error =
        new Error(
          "The email provider did not return a message ID",
        );

      error.code =
        "EMAIL_PROVIDER_RESPONSE_INVALID";

      throw error;
    }

    console.log(
      "✅ Resend accepted email:",
      {
        to: recipient,
        messageId:
          data.id,
        durationMs:
          Date.now() -
          startedAt,
      },
    );

    return {
      provider: "resend",
      id: data.id,
      messageId:
        data.id,
      accepted: [
        recipient,
      ],
    };
  } catch (error) {
    console.error(
      "❌ Resend email failed:",
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

  const safeCode =
    escapeHtml(
      verificationCode,
    );

  return sendEmail({
    to,

    subject:
      "Verify your ChapsSmS account",

    text: `
Hello ${greetingName},

Your ChapsSmS verification code is:

${verificationCode}

This code expires in 10 minutes.

If you did not create this account, you can ignore this email.
    `.trim(),

    html: `
      <div style="margin:0;background:#f8fafc;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
        <div style="max-width:560px;margin:0 auto;overflow:hidden;border:1px solid #e2e8f0;border-radius:20px;background:#ffffff;">
          <div style="background:#2563eb;padding:28px 28px 24px;color:#ffffff;">
            <div style="font-size:22px;font-weight:800;">ChapsSmS</div>
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
              Enter this code on ChapsSmS to finish creating your account.
            </p>

            <div style="margin:26px 0;padding:22px;border-radius:14px;background:#eff6ff;text-align:center;color:#1d4ed8;font-size:34px;font-weight:800;letter-spacing:9px;">
              ${safeCode}
            </div>

            <p style="margin:0;line-height:1.7;color:#475569;">
              This code expires in 10 minutes.
            </p>

            <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#94a3b8;">
              If you did not create this account, you can ignore this email.
            </p>
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

  const safeCode =
    escapeHtml(
      resetCode,
    );

  return sendEmail({
    to,

    subject:
      "Reset your ChapsSmS password",

    text: `
Hello ${greetingName},

Your ChapsSmS password-reset code is:

${resetCode}

This code expires in 10 minutes.

If you did not request a password reset, you can ignore this email.
    `.trim(),

    html: `
      <div style="margin:0;background:#f8fafc;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
        <div style="max-width:560px;margin:0 auto;overflow:hidden;border:1px solid #e2e8f0;border-radius:20px;background:#ffffff;">
          <div style="background:#2563eb;padding:28px 28px 24px;color:#ffffff;">
            <div style="font-size:22px;font-weight:800;">ChapsSmS</div>
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
              Enter this code on ChapsSmS to continue resetting your password.
            </p>

            <div style="margin:26px 0;padding:22px;border-radius:14px;background:#eff6ff;text-align:center;color:#1d4ed8;font-size:34px;font-weight:800;letter-spacing:9px;">
              ${safeCode}
            </div>

            <p style="margin:0;line-height:1.7;color:#475569;">
              This code expires in 10 minutes.
            </p>

            <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#94a3b8;">
              If you did not request this password reset, you can ignore this email.
            </p>
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