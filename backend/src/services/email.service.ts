import { Resend } from "resend";

export function getFrontendUrl(): string {
  const raw = process.env.FRONTEND_URL?.trim();
  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("FRONTEND_URL environment variable is required in production.");
    }
    return "http://localhost:3000";
  }
  return raw.replace(/\/+$/, "");
}

export function getFromEmail(): string {
  const configured =
    process.env.EMAIL_FROM?.trim() || process.env.RESEND_FROM_EMAIL?.trim();
  if (configured) {
    return configured;
  }
  if (process.env.NODE_ENV === "production") {
    return "HAVN <noreply@havn.co.in>";
  }
  return "HAVN <onboarding@resend.dev>";
}

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("RESEND_API_KEY environment variable is not configured.");
  }
  return new Resend(apiKey);
}

export const sendTestEmail = async (to: string) => {
  const { data, error } = await getResendClient().emails.send({
    from: getFromEmail(),
    to,
    subject: "HAVN Email Test",
    html: `
      <h2>HAVN Email Verification</h2>
      <p>Your email service is working correctly.</p>
      <p>This is a test email from HAVN.</p>
    `,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
};

export const sendVerificationEmail = async (
  to: string,
  verificationToken: string
) => {
  const verificationUrl =
    `${getFrontendUrl()}/verify-email?token=${encodeURIComponent(
      verificationToken
    )}`;

  const { data, error } = await getResendClient().emails.send({
    from: getFromEmail(),
    to,
    subject: "Verify your HAVN email",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Verify your HAVN email</h2>

        <p>
          Thanks for creating your HAVN account.
          Please verify your email address to activate your account.
        </p>

        <p>
          <a
            href="${verificationUrl}"
            style="
              display: inline-block;
              padding: 12px 20px;
              background: #2563eb;
              color: white;
              text-decoration: none;
              border-radius: 8px;
            "
          >
            Verify Email
          </a>
        </p>

        <p>
          This verification link expires in 30 minutes.
        </p>

        <p>
          If you did not create a HAVN account, you can ignore this email.
        </p>
      </div>
    `,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
};

export const sendPasswordResetEmail = async (
  to: string,
  resetToken: string
) => {
  const resetUrl =
    `${getFrontendUrl()}/reset-password?token=${encodeURIComponent(
      resetToken
    )}`;

  const { data, error } = await getResendClient().emails.send({
    from: getFromEmail(),
    to,
    subject: "Reset your HAVN password",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Reset your HAVN password</h2>

        <p>
          We received a request to reset the password for your HAVN account.
        </p>

        <p>
          <a
            href="${resetUrl}"
            style="
              display: inline-block;
              padding: 12px 20px;
              background: #2563eb;
              color: white;
              text-decoration: none;
              border-radius: 8px;
            "
          >
            Reset Password
          </a>
        </p>

        <p>
          This password reset link expires in 15 minutes.
        </p>

        <p>
          If you did not request a password reset, you can safely ignore this email.
        </p>
      </div>
    `,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
};