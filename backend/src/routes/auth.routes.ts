/*auth.routs.ts*/
import { Router, Request, Response } from "express";
import {
  registerUser,
  loginUser,
  getCurrentUser,
  verifyEmail,
  testEmail,
  googleCallback,
  githubLoginCallback,
  exchangeOAuthCode,
  forgotPassword,
  resetPassword,
  changePassword,
} from "../controllers/auth.controller";

import { authenticate } from "../middleware/auth.middleware";
import {
  validateRegister,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
  validateChangePassword,
} from "../middleware/validation.middleware";
import {
  forgotPasswordIpLimiter,
  forgotPasswordAccountLimiter,
  resetPasswordLimiter,
  changePasswordLimiter,
  testEmailLimiter,
  loginIpLimiter,
  loginAccountLimiter,
  registerIpLimiter,
  oauthExchangeLimiter,
} from "../middleware/rateLimit.middleware";

import {
  getGoogleRedirectUri,
  getGithubRedirectUri,
  generateOAuthState,
} from "../services/auth.service";

const router = Router();

/*
|--------------------------------------------------------------------------
| OAuth Initiation Routes
|--------------------------------------------------------------------------
*/

// GitHub OAuth
router.get("/github", async (req: Request, res: Response) => {
  const clientId = process.env.GITHUB_CLIENT_ID;

  if (!clientId) {
    return res.status(500).json({
      success: false,
      message: "GitHub OAuth is not configured.",
    });
  }

  const state = await generateOAuthState("github");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getGithubRedirectUri(),
    scope: "user:email",
    state,
  });

  const githubAuthUrl =
    `https://github.com/login/oauth/authorize?${params.toString()}`;

  return res.redirect(githubAuthUrl);
});
router.get("/github/callback", githubLoginCallback);

// Google OAuth
router.get("/google", async (req: Request, res: Response) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    return res.status(500).json({
      success: false,
      message: "Google OAuth is not configured.",
    });
  }

  const state = await generateOAuthState("google");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getGoogleRedirectUri(),
    response_type: "code",
    scope: "openid profile email",
    state,
  });

  const googleAuthUrl =
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  return res.redirect(googleAuthUrl);
});
router.get("/google/callback", googleCallback);

// OAuth One-time Code Exchange
router.post("/oauth/exchange", oauthExchangeLimiter, exchangeOAuthCode);
/*
Existing Authentication Routes
*/

router.get("/verify-email", verifyEmail);

router.post("/test-email", testEmailLimiter, testEmail);

router.post(
  "/register",
  registerIpLimiter,
  validateRegister,
  registerUser
);

router.post(
  "/login",
  loginIpLimiter,
  loginAccountLimiter,
  validateLogin,
  loginUser
);

router.post(
  "/forgot-password",
  forgotPasswordIpLimiter,
  forgotPasswordAccountLimiter,
  validateForgotPassword,
  forgotPassword
);

router.post(
  "/reset-password",
  resetPasswordLimiter,
  validateResetPassword,
  resetPassword
);

router.put(
  "/change-password",
  authenticate,
  changePasswordLimiter,
  validateChangePassword,
  changePassword
);

router.get(
  "/me",
  authenticate,
  getCurrentUser
);

export default router;