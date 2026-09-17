const PRIVATE_TERMS = [
  "smsbower",
  "sms bower",
  "benotp",
  "ben otp",
  "provider",
  "activation api",
];

function containsPrivateTerm(value) {
  const text = String(
    value || ""
  ).toLowerCase();

  return PRIVATE_TERMS.some(
    (term) => text.includes(term)
  );
}

function getPublicProviderError(
  error,
  fallbackMessage =
    "The selected server could not complete the request."
) {
  const status =
    Number(error?.status) >= 400 &&
    Number(error?.status) <= 599
      ? Number(error.status)
      : 502;

  let message =
    error?.publicMessage ||
    fallbackMessage;

  if (
    containsPrivateTerm(message)
  ) {
    message = fallbackMessage;
  }

  let code =
    error?.publicCode ||
    "SERVER_REQUEST_FAILED";

  if (
    containsPrivateTerm(code)
  ) {
    code =
      "SERVER_REQUEST_FAILED";
  }

  return {
    status,
    body: {
      success: false,
      message,
      code,
    },
  };
}

module.exports = {
  getPublicProviderError,
};