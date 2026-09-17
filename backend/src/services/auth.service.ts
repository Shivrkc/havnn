/*auth.service.ts*/
import crypto from "crypto";
import bcrypt from "bcrypt";
import prisma from "../lib/prisma";
import { AUTH_MESSAGES } from "../constants/messages";
import { generateToken } from "../utils/jwt";
import {
  generateVerificationToken,
  hashVerificationToken,
} from "../utils/emailVerification";
import * as emailService from "./email.service";
import { encryptToken } from "../utils/crypto";
import axios from "axios";

interface RegisterData {
  name: string;
  email: string;
  password: string;
}

interface LoginData {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export const normalizeEmail = (email: string): string => {
  return email.trim().toLowerCase();
};

export const register = async (data: RegisterData) => {
  const { name, email, password } = data;
  const normalizedEmail = normalizeEmail(email);

  const existingUser = await prisma.user.findUnique({
    where: {
      email: normalizedEmail,
    },
  });

  if (existingUser) {
    throw new Error(AUTH_MESSAGES.USER_EXISTS);
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      name,
      email: normalizedEmail,
      password: hashedPassword,
      emailVerified: false,
    },
  });

  const verificationToken = generateVerificationToken();
  const tokenHash = hashVerificationToken(verificationToken);

  await prisma.emailVerificationToken.create({
    data: {
      tokenHash,
      userId: user.id,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    },
  });

  await emailService.sendVerificationEmail(user.email, verificationToken);

  return {
    success: true,
    message:
      "Account created. Please check your email to verify your account.",
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    },
  };
};

export const login = async (data: LoginData) => {
  const { email, password } = data;
  const normalizedEmail = normalizeEmail(email);

  const user = await prisma.user.findUnique({
    where: {
      email: normalizedEmail,
    },
    include: {
      githubAccount: {
        select: {
          githubUsername: true,
          githubUserId: true,
          scope: true,
        },
      },
    },
  });

  if (!user) {
    throw new Error(AUTH_MESSAGES.INVALID_CREDENTIALS);
  }

  const isPasswordValid = await bcrypt.compare(
    password,
    user.password ?? ""
  );

  if (!isPasswordValid) {
    throw new Error(AUTH_MESSAGES.INVALID_CREDENTIALS);
  }

  if (!user.emailVerified) {
    throw new Error("Please verify your email before logging in.");
  }

  const token = generateToken(
    {
      id: user.id,
      email: user.email,
    },
    data.rememberMe === true ? "7d" : "1d"
  );

  return {
    success: true,
    message: AUTH_MESSAGES.LOGIN_SUCCESS,
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      githubConnected: !!user.githubAccount,
      githubAccount: user.githubAccount
        ? {
            username: user.githubAccount.githubUsername,
            githubUserId: user.githubAccount.githubUserId,
            scope: user.githubAccount.scope,
          }
        : null,
    },
  };
};

export const getGoogleRedirectUri = (): string => {
  return (
    process.env.GOOGLE_CALLBACK_URL ||
    "http://localhost:5000/api/auth/google/callback"
  );
};

export const getGithubRedirectUri = (): string => {
  return (
    process.env.GITHUB_CALLBACK_URL ||
    "http://localhost:5000/api/auth/github/callback"
  );
};

export const loginWithGoogle = async (code: string) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = getGoogleRedirectUri();

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth is not configured.");
  }

  // 1. Exchange authorization code for Google tokens
  const tokenResponse = await axios.post(
    "https://oauth2.googleapis.com/token",
    {
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    },
    {
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 10000,
    }
  );

  const { access_token } = tokenResponse.data;

  if (!access_token) {
    throw new Error("Failed to obtain Google access token.");
  }

  // 2. Fetch Google user profile
  const profileResponse = await axios.get(
    "https://www.googleapis.com/oauth2/v3/userinfo",
    {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      timeout: 10000,
    }
  );

  const {
    sub: googleId,
    email,
    name,
    picture,
    email_verified,
  } = profileResponse.data;

  if (!googleId || !email) {
    throw new Error("Failed to retrieve Google profile.");
  }

  if (email_verified !== true) {
    throw new Error("Google account email is not verified.");
  }

  const normalizedEmail = normalizeEmail(email);

  // 3. Find existing HAVN user
  let user = await prisma.user.findUnique({
    where: {
      email: normalizedEmail,
    },
  });

  // 4. Create user if this Google account is new
  if (!user) {
    user = await prisma.user.create({
      data: {
        name: name || normalizedEmail.split("@")[0],
        email: normalizedEmail,
        password: null,
        avatar: picture || null,
        provider: "google",
        emailVerified: true,
      },
    });
  } else {
    // Update Google profile information for existing user
    user = await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        avatar: picture || user.avatar,
        emailVerified: true,
      },
    });
  }

  // 5. Generate the SAME HAVN JWT used by normal login
  const token = generateToken({
    id: user.id,
    email: user.email,
  });

  return {
    success: true,
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      createdAt: user.createdAt,
    },
  };
};
// Login With Github
export const loginWithGithub = async (code: string) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const redirectUri = getGithubRedirectUri();

  if (!clientId || !clientSecret) {
    throw new Error("GitHub OAuth is not configured.");
  }

  // 1. Exchange GitHub authorization code for access token
  const tokenResponse = await axios.post(
    "https://github.com/login/oauth/access_token",
    {
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    },
    {
      headers: {
        Accept: "application/json",
      },
      timeout: 10000,
    }
  );

  const { access_token, error, scope } = tokenResponse.data;

  if (error || !access_token) {
    throw new Error("Failed to obtain GitHub access token.");
  }

  // 2. Fetch GitHub profile
  const profileResponse = await axios.get(
    "https://api.github.com/user",
    {
      headers: {
        Authorization: `Bearer ${access_token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "HAVN-App",
      },
      timeout: 10000,
    }
  );

  const {
    id: githubIdNum,
    login: githubUsername,
    name,
    avatar_url: avatar,
    email: publicEmail,
  } = profileResponse.data;

  if (!githubIdNum || !githubUsername) {
    throw new Error("Failed to retrieve GitHub profile.");
  }

  const githubUserId = String(githubIdNum);

  // 3. STEP A: Check if a GithubAccount already exists with this stable githubUserId
  const existingGithubAccount = await prisma.githubAccount.findUnique({
    where: { githubUserId },
    include: { user: true },
  });

  let user;

  if (existingGithubAccount) {
    // Authenticate the linked HAVN user directly. Do not create duplicate user.
    user = existingGithubAccount.user;

    // Optional sync of avatar if changed
    if (avatar && avatar !== user.avatar) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { avatar },
      });
    }

    // Do NOT overwrite existing repo-scoped token with login token
  } else {
    // 4. STEP B: No GithubAccount found for this githubUserId
    // Resolve email (public or via /user/emails)
    let email = publicEmail;

    if (!email) {
      const emailsResponse = await axios.get(
        "https://api.github.com/user/emails",
        {
          headers: {
            Authorization: `Bearer ${access_token}`,
            Accept: "application/vnd.github+json",
            "User-Agent": "HAVN-App",
          },
          timeout: 10000,
        }
      );

      const emails = emailsResponse.data;

      const primaryEmail = emails.find(
        (item: {
          email: string;
          primary: boolean;
          verified: boolean;
        }) => item.primary && item.verified
      );

      email = primaryEmail?.email;
    }

    if (!email) {
      throw new Error(
        "No verified email address is available from GitHub."
      );
    }

    const normalizedEmail = normalizeEmail(email);

    // Check if an existing HAVN user has this normalized email
    const existingUserByEmail = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { githubAccount: true },
    });

    const encryptedAccessToken = encryptToken(access_token);

    if (existingUserByEmail) {
      if (existingUserByEmail.githubAccount) {
        throw new Error(
          "A different GitHub account is already connected to this email."
        );
      }

      // Safely link GithubAccount to this existing user
      await prisma.githubAccount.create({
        data: {
          userId: existingUserByEmail.id,
          githubUserId,
          githubUsername,
          accessToken: encryptedAccessToken,
          scope: scope || "user:email",
        },
      });

      user = await prisma.user.update({
        where: { id: existingUserByEmail.id },
        data: {
          avatar: avatar || existingUserByEmail.avatar,
          emailVerified: true,
        },
      });
    } else {
      // Brand-new user: create User and GithubAccount atomically
      user = await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            name: name || githubUsername || normalizedEmail.split("@")[0],
            email: normalizedEmail,
            password: null,
            avatar: avatar || null,
            provider: "github",
            emailVerified: true,
          },
        });

        await tx.githubAccount.create({
          data: {
            userId: newUser.id,
            githubUserId,
            githubUsername,
            accessToken: encryptedAccessToken,
            scope: scope || "user:email",
          },
        });

        return newUser;
      });
    }
  }

  // 5. Generate the normal HAVN JWT
  const token = generateToken({
    id: user.id,
    email: user.email,
  });

  return {
    success: true,
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      createdAt: user.createdAt,
    },
  };
};

export const getCurrentUser = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    include: {
      githubAccount: {
        select: {
          githubUsername: true,
          githubUserId: true,
          scope: true,
        },
      },
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  return {
    success: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      provider: user.provider,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      githubConnected: !!user.githubAccount,
      githubAccount: user.githubAccount
        ? {
            username: user.githubAccount.githubUsername,
            githubUserId: user.githubAccount.githubUserId,
            scope: user.githubAccount.scope,
          }
        : null,
    },
  };
};

export const verifyEmail = async (token: string) => {
  if (!token) {
    throw new Error("Verification token is required.");
  }

  const tokenHash = hashVerificationToken(token);

  const verificationToken =
    await prisma.emailVerificationToken.findUnique({
      where: {
        tokenHash,
      },
    });

  if (!verificationToken) {
    throw new Error("Invalid or expired verification token.");
  }

  if (verificationToken.expiresAt < new Date()) {
    await prisma.emailVerificationToken.delete({
      where: {
        id: verificationToken.id,
      },
    });

    throw new Error("Verification token has expired.");
  }

  await prisma.user.update({
    where: {
      id: verificationToken.userId,
    },
    data: {
      emailVerified: true,
    },
  });

  await prisma.emailVerificationToken.delete({
    where: {
      id: verificationToken.id,
    },
  });

  return {
    success: true,
    message: "Email verified successfully.",
  };
};

export const forgotPassword = async (email: string) => {
  const normalizedEmail = normalizeEmail(email);

  const user = await prisma.user.findUnique({
    where: {
      email: normalizedEmail,
    },
  });

  // Do not reveal whether an email exists in the system.
  if (!user) {
    return {
      success: true,
      message:
        "If an account with that email exists, a password reset link has been sent.",
    };
  }

  // Remove any existing reset tokens for this user.
  await prisma.passwordResetToken.deleteMany({
    where: {
      userId: user.id,
    },
  });

  // Generate a cryptographically secure reset token.
  const rawToken = crypto.randomBytes(32).toString("hex");

  // Store only the SHA-256 hash.
  const tokenHash = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");

  // Token expires after 15 minutes.
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await prisma.passwordResetToken.create({
    data: {
      tokenHash,
      userId: user.id,
      expiresAt,
    },
  });

  await emailService.sendPasswordResetEmail(
    normalizedEmail,
    rawToken
  );

  return {
    success: true,
    message:
      "If an account with that email exists, a password reset link has been sent.",
  };
};

export const resetPassword = async (
  token: string,
  newPassword: string
) => {
  if (!token || !newPassword) {
    throw new Error("Reset token and new password are required.");
  }

  if (newPassword.length < 8) {
    throw new Error(
      "Password must be at least 8 characters long."
    );
  }

  if (newPassword.length > 128) {
    throw new Error("Password must not exceed 128 characters.");
  }

  // Hash the token received from the reset URL.
  const tokenHash = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  // Find the matching reset token.
  const resetToken =
    await prisma.passwordResetToken.findUnique({
      where: {
        tokenHash,
      },
    });

  if (!resetToken) {
    throw new Error("Invalid or expired password reset token.");
  }

  // Check expiration.
  if (resetToken.expiresAt < new Date()) {
    await prisma.passwordResetToken.delete({
      where: {
        id: resetToken.id,
      },
    });

    throw new Error("Invalid or expired password reset token.");
  }

  // Hash the new password.
  const hashedPassword = await bcrypt.hash(
    newPassword,
    12
  );

  // Update password and consume the reset token.
  await prisma.$transaction([
    prisma.user.update({
      where: {
        id: resetToken.userId,
      },
      data: {
        password: hashedPassword,
        provider: "credentials",
      },
    }),

    prisma.passwordResetToken.delete({
      where: {
        id: resetToken.id,
      },
    }),
  ]);

  return {
    success: true,
    message: "Password reset successfully.",
  };
};

export const changePassword = async (
  userId: string,
  currentPassword: string,
  newPassword: string
) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error("User not found.");
  }

  if (user.provider !== "credentials" || !user.password) {
    throw new Error(
      "Password change is only available for email/password accounts."
    );
  }

  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) {
    throw new Error("Incorrect current password.");
  }

  if (newPassword.length < 8) {
    throw new Error("New password must be at least 8 characters long.");
  }

  if (newPassword.length > 128) {
    throw new Error("New password must not exceed 128 characters.");
  }

  const isSamePassword = await bcrypt.compare(newPassword, user.password);
  if (isSamePassword) {
    throw new Error("New password cannot be the same as your current password.");
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: userId },
    data: {
      password: hashedPassword,
    },
  });

  return {
    success: true,
    message: "Password changed successfully.",
  };
};

/*
|--------------------------------------------------------------------------
| OAuth State CSRF Protection & Short-Lived Exchange Code Helpers
|--------------------------------------------------------------------------
*/

interface OAuthStateRecord {
  provider: "google" | "github";
  expiresAt: number;
}

interface OAuthExchangeRecord {
  token: string;
  user: any;
  expiresAt: number;
}

const oauthStateStore = new Map<string, OAuthStateRecord>();
const oauthExchangeStore = new Map<string, OAuthExchangeRecord>();

export const generateOAuthState = async (
  provider: "google" | "github"
): Promise<string> => {
  const now = Date.now();
  const rawState = crypto.randomBytes(32).toString("hex");
  const stateHash = crypto
    .createHash("sha256")
    .update(rawState)
    .digest("hex");
  const expiresAt = new Date(now + 10 * 60 * 1000);

  // In-memory fallback tracking
  for (const [hash, entry] of oauthStateStore.entries()) {
    if (entry.expiresAt <= now) {
      oauthStateStore.delete(hash);
    }
  }
  oauthStateStore.set(stateHash, {
    provider,
    expiresAt: expiresAt.getTime(),
  });

  try {
    // Prune expired states in DB
    await prisma.oAuthState.deleteMany({
      where: {
        expiresAt: { lte: new Date() },
      },
    });

    await prisma.oAuthState.create({
      data: {
        stateHash,
        provider,
        expiresAt,
      },
    });
  } catch (error) {
    // Graceful fallback to in-memory store if DB is disconnected/mocked in unit tests
  }

  return rawState;
};

export const validateOAuthState = async (
  rawState: unknown,
  expectedProvider: "google" | "github"
): Promise<boolean> => {
  if (typeof rawState !== "string" || !rawState) {
    return false;
  }

  const stateHash = crypto
    .createHash("sha256")
    .update(rawState)
    .digest("hex");

  try {
    // Atomic single-use consumption in DB
    const deleteResult = await prisma.oAuthState.deleteMany({
      where: {
        stateHash,
        provider: expectedProvider,
        expiresAt: { gt: new Date() },
      },
    });

    if (deleteResult.count === 1) {
      oauthStateStore.delete(stateHash);
      return true;
    }
  } catch (error) {
    // Fallback to in-memory store
  }

  const entry = oauthStateStore.get(stateHash);
  if (!entry) {
    return false;
  }

  // Single-use: delete immediately
  oauthStateStore.delete(stateHash);

  if (entry.expiresAt <= Date.now()) {
    return false;
  }

  if (entry.provider !== expectedProvider) {
    return false;
  }

  return true;
};

export const clearOAuthStateStore = async (): Promise<void> => {
  oauthStateStore.clear();
  try {
    await prisma.oAuthState.deleteMany({});
  } catch (e) {
    // ignore
  }
};

export const createOAuthExchangeCode = async (
  token: string,
  user: any
): Promise<string> => {
  const now = Date.now();
  const exchangeCode = crypto.randomBytes(32).toString("hex");
  const codeHash = crypto
    .createHash("sha256")
    .update(exchangeCode)
    .digest("hex");
  const expiresAt = new Date(now + 60 * 1000);

  // In-memory fallback tracking
  for (const [hash, entry] of oauthExchangeStore.entries()) {
    if (entry.expiresAt <= now) {
      oauthExchangeStore.delete(hash);
    }
  }
  oauthExchangeStore.set(codeHash, {
    token,
    user,
    expiresAt: expiresAt.getTime(),
  });

  try {
    // Prune expired codes in DB
    await prisma.oAuthExchange.deleteMany({
      where: {
        expiresAt: { lte: new Date() },
      },
    });

    await prisma.oAuthExchange.create({
      data: {
        codeHash,
        token,
        user: user || {},
        expiresAt,
      },
    });
  } catch (error) {
    // Graceful fallback to in-memory store if DB is disconnected/mocked in unit tests
  }

  return exchangeCode;
};

export const consumeOAuthExchangeCode = async (
  rawCode: unknown
): Promise<{ token: string; user: any } | null> => {
  if (typeof rawCode !== "string" || !rawCode) {
    return null;
  }

  const codeHash = crypto
    .createHash("sha256")
    .update(rawCode)
    .digest("hex");

  try {
    // Atomic single-use consumption: delete returns the record if found, or throws P2025 if already deleted/consumed
    const record = await prisma.oAuthExchange.delete({
      where: { codeHash },
    });

    // Synchronize in-memory fallback store so memory can NEVER resurrect this code
    oauthExchangeStore.delete(codeHash);

    if (record.expiresAt.getTime() <= Date.now()) {
      return null;
    }

    return {
      token: record.token,
      user: record.user,
    };
  } catch (error: any) {
    // Prisma error code P2025: Record to delete does not exist (already consumed or never existed)
    if (error?.code === "P2025") {
      oauthExchangeStore.delete(codeHash);
      return null;
    }

    // If DB is unavailable / connectivity error or unit-test without DB, fall back to in-memory store
    const entry = oauthExchangeStore.get(codeHash);
    if (!entry) {
      return null;
    }

    // Single-use: delete immediately upon lookup
    oauthExchangeStore.delete(codeHash);

    if (entry.expiresAt <= Date.now()) {
      return null;
    }

    return {
      token: entry.token,
      user: entry.user,
    };
  }
};

export const clearOAuthExchangeStore = async (): Promise<void> => {
  oauthExchangeStore.clear();
  try {
    await prisma.oAuthExchange.deleteMany({});
  } catch (e) {
    // ignore
  }
};