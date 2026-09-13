/* auth.controller.ts */

import { Request, Response } from "express";
import * as authService from "../services/auth.service";
import { AuthRequest } from "../middleware/auth.middleware";
import { sendTestEmail } from "../services/email.service";

export const registerUser = async (req: Request, res: Response) => {
  try {
    const result = await authService.register(req.body);

    return res.status(201).json(result);
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const loginUser = async (req: Request, res: Response) => {
  try {
    const result = await authService.login(req.body);

    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const getCurrentUser = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const result = await authService.getCurrentUser(req.user!.id);

    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(404).json({
      success: false,
      message: error.message,
    });
  }
};

export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const token = req.query.token;

    if (typeof token !== "string" || !token) {
      return res.status(400).json({
        success: false,
        message: "Verification token is required.",
      });
    }

    const result = await authService.verifyEmail(token);

    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const testEmail = async (req: Request, res: Response) => {
  // Prevent arbitrary outbound email relay in production
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({
      success: false,
      message: "Test email endpoint is disabled in production.",
    });
  }

  try {
    const { email } = req.body;

    if (typeof email !== "string" || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const result = await sendTestEmail(email.trim());

    return res.status(200).json({
      success: true,
      message: "Test email sent successfully",
      data: result,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const googleCallback = async (
  req: Request,
  res: Response
) => {
  const frontendUrl =
    process.env.FRONTEND_URL || "http://localhost:3000";

  try {
    const { code, state } = req.query;

    if (typeof code !== "string" || !code) {
      return res.redirect(`${frontendUrl}/login?error=google_auth_failed`);
    }

    if (
      typeof state !== "string" ||
      !(await authService.validateOAuthState(state, "google"))
    ) {
      return res.redirect(`${frontendUrl}/login?error=invalid_oauth_state`);
    }

    const result = await authService.loginWithGoogle(code);
    const exchangeCode = await authService.createOAuthExchangeCode(
      result.token,
      result.user
    );

    return res.redirect(
      `${frontendUrl}/oauth/callback?code=${encodeURIComponent(
        exchangeCode
      )}`
    );
  } catch (error) {
    console.error("Google OAuth callback failed:", error);

    return res.redirect(
      `${frontendUrl}/login?error=google_auth_failed`
    );
  }
};

export const githubLoginCallback = async (
  req: Request,
  res: Response
) => {
  const frontendUrl =
    process.env.FRONTEND_URL || "http://localhost:3000";

  try {
    const { code, state } = req.query;

    if (typeof code !== "string" || !code) {
      return res.redirect(`${frontendUrl}/login?error=github_auth_failed`);
    }

    if (
      typeof state !== "string" ||
      !(await authService.validateOAuthState(state, "github"))
    ) {
      return res.redirect(`${frontendUrl}/login?error=invalid_oauth_state`);
    }

    const result = await authService.loginWithGithub(code);
    const exchangeCode = await authService.createOAuthExchangeCode(
      result.token,
      result.user
    );

    return res.redirect(
      `${frontendUrl}/oauth/callback?code=${encodeURIComponent(
        exchangeCode
      )}`
    );
  } catch (error) {
    console.error("GitHub OAuth callback failed:", error);

    return res.redirect(
      `${frontendUrl}/login?error=github_auth_failed`
    );
  }
};

export const exchangeOAuthCode = async (
  req: Request,
  res: Response
) => {
  try {
    const { code } = req.body;

    if (typeof code !== "string" || !code.trim()) {
      return res.status(400).json({
        success: false,
        message: "Exchange code is required.",
      });
    }

    const session = await authService.consumeOAuthExchangeCode(code.trim());

    if (!session) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired exchange code.",
      });
    }

    res.cookie("token", session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      success: true,
      token: session.token,
      user: session.user,
    });
  } catch (error: any) {
    console.error("OAuth exchange failed:", error);

    return res.status(500).json({
      success: false,
      message: "OAuth exchange failed.",
    });
  }
};

export const forgotPassword = async (
  req: Request,
  res: Response
) => {
  try {
    const { email } = req.body;

    if (typeof email !== "string" || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: "Email is required.",
      });
    }

    const result = await authService.forgotPassword(email);

    return res.status(200).json(result);
  } catch (error: any) {
    console.error("Forgot password failed:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to process password reset request.",
    });
  }
};

export const resetPassword = async (
  req: Request,
  res: Response
) => {
  try {
    const { token, newPassword } = req.body;

    if (
      typeof token !== "string" ||
      !token ||
      typeof newPassword !== "string" ||
      !newPassword
    ) {
      return res.status(400).json({
        success: false,
        message: "Reset token and new password are required.",
      });
    }

    const result = await authService.resetPassword(
      token,
      newPassword
    );

    return res.status(200).json(result);
  } catch (error: any) {
    console.error("Reset password failed:", error);

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const changePassword = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized user.",
      });
    }

    const { currentPassword, newPassword } = req.body;

    if (
      typeof currentPassword !== "string" ||
      !currentPassword ||
      typeof newPassword !== "string" ||
      !newPassword
    ) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required.",
      });
    }

    const result = await authService.changePassword(
      userId,
      currentPassword,
      newPassword
    );

    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to update password.",
    });
  }
};