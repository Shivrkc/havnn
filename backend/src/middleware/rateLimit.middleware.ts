import { Request, Response, NextFunction } from "express";
import { AuthRequest } from "./auth.middleware";
import { normalizeEmail } from "../services/auth.service";

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

interface RateLimitOptions {
  windowMs: number;
  max: number;
  message: string;
  keyGenerator: (req: Request | AuthRequest) => string;
}

export class InMemoryRateLimiter {
  private hits = new Map<string, RateLimitRecord>();
  private sweepInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Periodic sweep every 5 minutes to prevent memory leaks from inactive entries
    this.sweepInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);

    // Unref so the interval does not prevent process exit in tests or worker threads
    if (this.sweepInterval.unref) {
      this.sweepInterval.unref();
    }
  }

  public cleanup(now: number = Date.now()): void {
    for (const [key, record] of this.hits.entries()) {
      if (now >= record.resetTime) {
        this.hits.delete(key);
      }
    }
  }

  public reset(): void {
    this.hits.clear();
  }

  public destroy(): void {
    if (this.sweepInterval) {
      clearInterval(this.sweepInterval);
      this.sweepInterval = null;
    }
    this.hits.clear();
  }

  public createMiddleware(options: RateLimitOptions) {
    return (req: Request, res: Response, next: NextFunction) => {
      const now = Date.now();
      const key = options.keyGenerator(req);

      let record = this.hits.get(key);

      if (!record || now >= record.resetTime) {
        record = {
          count: 1,
          resetTime: now + options.windowMs,
        };
        this.hits.set(key, record);
      } else {
        record.count += 1;
      }

      const retryAfterSeconds = Math.max(1, Math.ceil((record.resetTime - now) / 1000));
      res.setHeader("Retry-After", retryAfterSeconds.toString());
      res.setHeader("X-RateLimit-Limit", options.max.toString());
      res.setHeader("X-RateLimit-Remaining", Math.max(0, options.max - record.count).toString());
      res.setHeader("X-RateLimit-Reset", Math.ceil(record.resetTime / 1000).toString());

      if (record.count > options.max) {
        return res.status(429).json({
          success: false,
          message: options.message,
          retryAfter: retryAfterSeconds,
        });
      }

      next();
    };
  }
}

export const rateLimiterStore = new InMemoryRateLimiter();

export const getClientIp = (req: Request): string => {
  const ip = req.ip || req.socket.remoteAddress || "127.0.0.1";
  return ip.startsWith("::ffff:") ? ip.slice(7) : ip;
};

// 1. Forgot password rate limiters
// Per-IP: 5 requests per 15 minutes
export const forgotPasswordIpLimiter = rateLimiterStore.createMiddleware({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many password reset requests from this IP. Please try again later.",
  keyGenerator: (req) => `forgot:ip:${getClientIp(req)}`,
});

// Per-Account: 3 requests per 15 minutes for the requested email
// Note: Email is normalized without leaking whether the account exists, preserving generic response
export const forgotPasswordAccountLimiter = rateLimiterStore.createMiddleware({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: "Too many password reset requests for this account. Please try again later.",
  keyGenerator: (req) => {
    const rawEmail = typeof req.body?.email === "string" ? req.body.email : "";
    const emailKey = rawEmail.trim() ? normalizeEmail(rawEmail) : "unknown";
    return `forgot:account:${emailKey}`;
  },
});

// 2. Reset password rate limiter
// Per-IP: 10 attempts per 15 minutes to thwart brute-forcing reset tokens
export const resetPasswordLimiter = rateLimiterStore.createMiddleware({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many password reset attempts. Please try again later.",
  keyGenerator: (req) => `reset:ip:${getClientIp(req)}`,
});

// 3. Change password rate limiter
// Per-User / IP: 5 attempts per 15 minutes
export const changePasswordLimiter = rateLimiterStore.createMiddleware({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many password change attempts. Please try again later.",
  keyGenerator: (req: AuthRequest) => {
    const userId = req.user?.id || getClientIp(req);
    return `change:user:${userId}`;
  },
});

// 4. Test email rate limiter (for non-production development diagnostics)
// Per-IP: 3 requests per 15 minutes
export const testEmailLimiter = rateLimiterStore.createMiddleware({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: "Too many test email requests. Please try again later.",
  keyGenerator: (req) => `test-email:ip:${getClientIp(req)}`,
});

// 5. Login rate limiters
// Per-IP: 10 attempts per 15 minutes to thwart brute-forcing
export const loginIpLimiter = rateLimiterStore.createMiddleware({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many login attempts from this IP. Please try again later.",
  keyGenerator: (req) => `login:ip:${getClientIp(req)}`,
});

// Per-Account: 5 attempts per 15 minutes for the requested email
export const loginAccountLimiter = rateLimiterStore.createMiddleware({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many login attempts for this account. Please try again later.",
  keyGenerator: (req) => {
    const rawEmail = typeof req.body?.email === "string" ? req.body.email : "";
    const emailKey = rawEmail.trim() ? normalizeEmail(rawEmail) : "unknown";
    return `login:account:${emailKey}`;
  },
});

// 6. Registration rate limiter
// Per-IP: 10 account creations per hour to prevent bot signup spam
export const registerIpLimiter = rateLimiterStore.createMiddleware({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: "Too many accounts created from this IP. Please try again later.",
  keyGenerator: (req) => `register:ip:${getClientIp(req)}`,
});

// 7. OAuth code exchange rate limiter
// Per-IP: 20 attempts per 15 minutes
export const oauthExchangeLimiter = rateLimiterStore.createMiddleware({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "Too many OAuth exchange requests. Please try again later.",
  keyGenerator: (req) => `oauth-exchange:ip:${getClientIp(req)}`,
});

// 8. Deployment creation rate limiter
// Per-User: 10 deployments created per 5 minutes to prevent deployment pipeline spam
export const deploymentCreationLimiter = rateLimiterStore.createMiddleware({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: "Deployment creation limit reached. Please wait before triggering additional builds.",
  keyGenerator: (req: AuthRequest) => {
    const userId = req.user?.id || getClientIp(req);
    return `deploy-create:user:${userId}`;
  },
});
