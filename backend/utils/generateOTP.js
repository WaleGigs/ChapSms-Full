const {
  randomInt,
} = require("node:crypto");

function generateOTP(
  length = 6
) {
  const normalizedLength =
    Number(length);

  if (
    !Number.isInteger(
      normalizedLength
    ) ||
    normalizedLength < 1 ||
    normalizedLength > 12
  ) {
    throw new Error(
      "OTP length must be an integer between 1 and 12"
    );
  }

  let otp = "";

  for (
    let index = 0;
    index < normalizedLength;
    index += 1
  ) {
    otp += randomInt(
      0,
      10
    ).toString();
  }

  return otp;
}

module.exports =
  generateOTP;