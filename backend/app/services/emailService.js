import nodemailer from "nodemailer";
import logger from "./logger.js";

let cachedTransporter = null;

export function useRealEmailOTP() {
  return (
    process.env.USE_REAL_EMAIL_OTP === "true" ||
    process.env.USE_REAL_EMAIL_OTP === "1"
  );
}

function parseSmtpPort() {
  return parseInt(process.env.SMTP_PORT || "587", 10);
}

function parseSmtpSecure(port) {
  if (process.env.SMTP_SECURE === "true" || process.env.SMTP_SECURE === "1") {
    return true;
  }

  if (process.env.SMTP_SECURE === "false" || process.env.SMTP_SECURE === "0") {
    return false;
  }

  return port === 465;
}

function getMailFrom() {
  const fromAddress = String(process.env.MAIL_FROM || "").trim();
  const fromName = String(process.env.MAIL_FROM_NAME || "").trim();

  if (!fromAddress) {
    const error = new Error("MAIL_FROM is required for email OTP delivery");
    error.statusCode = 500;
    throw error;
  }

  return fromName ? `${fromName} <${fromAddress}>` : fromAddress;
}

function getTransportConfig() {
  const host = String(process.env.SMTP_HOST || "").trim();
  const port = parseSmtpPort();
  const secure = parseSmtpSecure(port);
  const user = String(process.env.SMTP_USER || "").trim();
  const pass = String(process.env.SMTP_PASS || "").trim();

  if (!host) {
    const error = new Error("SMTP_HOST is required for email OTP delivery");
    error.statusCode = 500;
    throw error;
  }

  if (!Number.isFinite(port) || port <= 0) {
    const error = new Error("SMTP_PORT must be a valid number");
    error.statusCode = 500;
    throw error;
  }

  if ((user && !pass) || (!user && pass)) {
    const error = new Error("SMTP_USER and SMTP_PASS must be provided together");
    error.statusCode = 500;
    throw error;
  }

  return {
    host,
    port,
    secure,
    ...(user && pass
      ? {
          auth: {
            user,
            pass,
          },
        }
      : {}),
  };
}

function getTransporter() {
  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport(getTransportConfig());
  }

  return cachedTransporter;
}

const SELLER_OTP_EMAIL_COPY = {
  signup: {
    subject: "Verify your seller signup email",
    intro: "Your seller signup verification code is",
  },
  login: {
    subject: "Your seller login code",
    intro: "Your seller login code is",
  },
};

/**
 * Emails a seller OTP. `purpose` picks the wording: "signup" (verify the
 * email while registering) or "login" (sign in with an emailed code).
 */
export async function sendSellerVerificationOtpEmail({
  email,
  otp,
  expiresInMinutes,
  purpose = "signup",
}) {
  const allowMock =
    process.env.USE_MOCK_OTP === "true" ||
    process.env.USE_MOCK_OTP === "1" ||
    process.env.ALLOW_MOCK_OTP_IN_PRODUCTION === "true";

  if (!useRealEmailOTP() || allowMock) {
    logger.info("Seller email OTP generated in mock mode", {
      email,
      otp,
      purpose,
      mode: "mock",
    });
    return {
      delivered: false,
      mode: "mock",
    };
  }

  const copy = SELLER_OTP_EMAIL_COPY[purpose] || SELLER_OTP_EMAIL_COPY.signup;
  const transporter = getTransporter();
  await transporter.sendMail({
    from: getMailFrom(),
    to: email,
    subject: copy.subject,
    text: `${copy.intro} ${otp}. This code expires in ${expiresInMinutes} minutes. If you did not request it, you can ignore this email.`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #0f172a;">
        <p>${copy.intro}:</p>
        <p style="font-size: 28px; font-weight: 700; letter-spacing: 6px;">${otp}</p>
        <p>This code expires in ${expiresInMinutes} minutes.</p>
        <p style="color: #64748b; font-size: 12px;">If you did not request it, you can ignore this email.</p>
      </div>
    `,
  });

  return {
    delivered: true,
    mode: "real",
  };
}

export function __resetEmailTransportForTests() {
  cachedTransporter = null;
}
