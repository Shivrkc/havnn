import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = "CloudForge <onboarding@resend.dev>";

export const sendTestEmail = async (to: string) => {
  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: "CloudForge Email Test",
    html: `
      <h2>CloudForge Email Verification</h2>
      <p>Your email service is working correctly.</p>
      <p>This is a test email from CloudForge.</p>
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
    `${process.env.FRONTEND_URL}/verify-email?token=${encodeURIComponent(
      verificationToken
    )}`;

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: "Verify your CloudForge email",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Verify your CloudForge email</h2>

        <p>
          Thanks for creating your CloudForge account.
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
          If you did not create a CloudForge account, you can ignore this email.
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
    `${process.env.FRONTEND_URL}/reset-password?token=${encodeURIComponent(
      resetToken
    )}`;

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
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