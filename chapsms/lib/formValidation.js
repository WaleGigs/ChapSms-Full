const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const NAME_PATTERN = /^[\p{L}][\p{L}\p{M}' -]{1,49}$/u;

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 64;

export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function validateEmail(value) {
  const email = normalizeEmail(value);

  if (!email) {
    return "Email address is required";
  }

  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return "Enter a valid email address";
  }

  return "";
}

export function validateName(value, label = "Name") {
  const name = String(value || "").trim();

  if (!name) {
    return `${label} is required`;
  }

  if (name.length < 2) {
    return `${label} must contain at least 2 characters`;
  }

  if (!NAME_PATTERN.test(name)) {
    return `${label} can contain letters, spaces, apostrophes, and hyphens only`;
  }

  return "";
}

export function getPasswordChecks(passwordValue) {
  const password = String(passwordValue || "");

  return [
    {
      key: "length",
      label: `${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} characters`,
      passed:
        password.length >= PASSWORD_MIN_LENGTH &&
        password.length <= PASSWORD_MAX_LENGTH,
    },
    {
      key: "lowercase",
      label: "One lowercase letter",
      passed: /[a-z]/.test(password),
    },
    {
      key: "uppercase",
      label: "One uppercase letter",
      passed: /[A-Z]/.test(password),
    },
    {
      key: "number",
      label: "One number",
      passed: /\d/.test(password),
    },
    {
      key: "special",
      label: "One special character",
      passed: /[^A-Za-z0-9\s]/.test(password),
    },
    {
      key: "spaces",
      label: "No spaces",
      passed: !/\s/.test(password),
    },
  ];
}

export function validatePassword(value) {
  const password = String(value || "");

  if (!password) {
    return "Password is required";
  }

  const failedCheck = getPasswordChecks(password).find(
    (check) => !check.passed
  );

  if (failedCheck) {
    return `Password needs ${failedCheck.label.toLowerCase()}`;
  }

  return "";
}

export function getPasswordStrength(passwordValue) {
  const password = String(passwordValue || "");
  const checks = getPasswordChecks(password);
  const passed = checks.filter((check) => check.passed).length;

  if (!password) {
    return {
      score: 0,
      label: "Not entered",
    };
  }

  if (passed <= 2) {
    return {
      score: 1,
      label: "Weak",
    };
  }

  if (passed <= 4) {
    return {
      score: 2,
      label: "Fair",
    };
  }

  if (passed === 5) {
    return {
      score: 3,
      label: "Good",
    };
  }

  return {
    score: 4,
    label: "Strong",
  };
}

export function validateLoginField(name, value) {
  if (name === "email") {
    return validateEmail(value);
  }

  if (name === "password") {
    return String(value || "") ? "" : "Password is required";
  }

  return "";
}

export function validateLoginForm(form = {}) {
  const errors = {};

  for (const field of ["email", "password"]) {
    const message = validateLoginField(field, form[field]);

    if (message) {
      errors[field] = message;
    }
  }

  return errors;
}

export function validateSignupField(name, value, form = {}) {
  switch (name) {
    case "firstName":
      return validateName(value, "First name");
    case "lastName":
      return validateName(value, "Last name");
    case "email":
      return validateEmail(value);
    case "password":
      return validatePassword(value);
    case "confirmPassword":
      if (!String(value || "")) {
        return "Confirm your password";
      }

      return value === form.password ? "" : "Passwords do not match";
    case "terms":
      return value ? "" : "Accept the Terms and Privacy Policy to continue";
    default:
      return "";
  }
}

export function validateSignupForm(form = {}) {
  const errors = {};

  for (const field of [
    "firstName",
    "lastName",
    "email",
    "password",
    "confirmPassword",
    "terms",
  ]) {
    const message = validateSignupField(field, form[field], form);

    if (message) {
      errors[field] = message;
    }
  }

  return errors;
}

export function validateResetPasswordForm(form = {}) {
  const errors = {};

  const emailError = validateEmail(form.email);
  if (emailError) errors.email = emailError;

  const code = String(form.code || "").trim();
  if (!code) {
    errors.code = "Reset code is required";
  } else if (!/^\d{6}$/.test(code)) {
    errors.code = "Reset code must contain exactly 6 digits";
  }

  const passwordError = validatePassword(form.password);
  if (passwordError) errors.password = passwordError;

  if (!String(form.confirmPassword || "")) {
    errors.confirmPassword = "Confirm your new password";
  } else if (form.confirmPassword !== form.password) {
    errors.confirmPassword = "Passwords do not match";
  }

  return errors;
}