import assert from "assert";
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import axios from "axios";
import prisma from "../../lib/prisma";
import { register } from "../auth.service";
import {
  getFromEmail,
  getFrontendUrl,
  sendVerificationEmail,
  sendPasswordResetEmail,
} from "../email.service";
import {
  getGithubConnectRedirectUri,
  generateConnectUrl,
  handleCallback,
} from "../github.service";

async function runPhaseATests() {
  console.log("==================================================================");
  console.log("  PHASE A: DEPLOYMENT PREP REGRESSION TEST SUITE                  ");
  console.log("==================================================================\n");

  const repoRoot = path.resolve(__dirname, "../../../..");
  const backendRoot = path.resolve(__dirname, "../../..");

  // --------------------------------------------------------------------------
  // 1. Backend Dependency Isolation & Vercel Config Verification
  // --------------------------------------------------------------------------
  console.log("[TEST 1/5] Backend dependency isolation & Vercel SPA rewrite config...");
  {
    const backendPkg = JSON.parse(
      fs.readFileSync(path.join(backendRoot, "package.json"), "utf8")
    );
    assert.ok(
      backendPkg.dependencies?.["@google/genai"],
      "backend/package.json must declare @google/genai in dependencies"
    );
    assert.strictEqual(
      backendPkg.scripts?.postinstall,
      "prisma generate",
      "backend/package.json must run prisma generate on postinstall"
    );
    assert.ok(
      backendPkg.engines?.node,
      "backend/package.json must specify Node engine constraint"
    );
    assert.strictEqual(
      fs.existsSync(path.join(backendRoot, "node_modules/@google/genai")),
      true,
      "@google/genai must be installed directly inside backend/node_modules"
    );

    const vercelConfigPath = path.join(repoRoot, "vercel.json");
    assert.strictEqual(fs.existsSync(vercelConfigPath), true, "vercel.json must exist");
    const vercelConfig = JSON.parse(fs.readFileSync(vercelConfigPath, "utf8"));
    const hasSpaRewrite =
      Array.isArray(vercelConfig.rewrites) &&
      vercelConfig.rewrites.some(
        (r: any) => r.source === "/(.*)" && r.destination === "/index.html"
      );
    assert.strictEqual(hasSpaRewrite, true, "vercel.json must contain /(.*) -> /index.html rewrite");
    console.log("   ✓ Backend dependencies isolated and vercel.json SPA rewrite valid\n");
  }

  // --------------------------------------------------------------------------
  // 2. Resend Safe Lazy Initialization (Does Not Crash Import Without API Key)
  // --------------------------------------------------------------------------
  console.log("[TEST 2/5] Lazy Resend initialization without RESEND_API_KEY at import...");
  {
    const cleanEnv = { ...process.env };
    delete cleanEnv.RESEND_API_KEY;

    const child = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "-e",
        `import("./src/services/email.service.ts").then(() => console.log("IMPORT_OK"))`,
      ],
      {
        cwd: backendRoot,
        env: cleanEnv,
        encoding: "utf8",
      }
    );

    assert.strictEqual(
      child.status,
      0,
      `Importing email.service without RESEND_API_KEY must not crash (stderr: ${child.stderr})`
    );
    assert.ok(
      child.stdout.includes("IMPORT_OK"),
      "Subprocess must import email.service cleanly without RESEND_API_KEY"
    );
    console.log("   ✓ Importing email.service without RESEND_API_KEY does not throw\n");
  }

  // --------------------------------------------------------------------------
  // 3. Resend Production Sender & Normalized FRONTEND_URL Verification
  // --------------------------------------------------------------------------
  console.log("[TEST 3/5] Production sender configuration & normalized FRONTEND_URL...");
  {
    const savedEnv = {
      NODE_ENV: process.env.NODE_ENV,
      EMAIL_FROM: process.env.EMAIL_FROM,
      RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
      FRONTEND_URL: process.env.FRONTEND_URL,
      RESEND_API_KEY: process.env.RESEND_API_KEY,
    };
    const originalFetch = globalThis.fetch;

    try {
      // Missing RESEND_API_KEY fails gracefully at send time
      delete process.env.RESEND_API_KEY;
      await assert.rejects(
        () => sendVerificationEmail("user@example.com", "tok123"),
        /RESEND_API_KEY environment variable is not configured/
      );

      // Development defaults
      process.env.NODE_ENV = "development";
      delete process.env.EMAIL_FROM;
      delete process.env.RESEND_FROM_EMAIL;
      delete process.env.FRONTEND_URL;
      assert.strictEqual(getFromEmail(), "HAVN <onboarding@resend.dev>");
      assert.strictEqual(getFrontendUrl(), "http://localhost:3000");

      // Production defaults (havn.co.in) + trailing slash stripping
      process.env.NODE_ENV = "production";
      process.env.FRONTEND_URL = "https://havn.co.in///";
      assert.strictEqual(getFromEmail(), "HAVN <noreply@havn.co.in>");
      assert.strictEqual(getFrontendUrl(), "https://havn.co.in");

      // Explicit EMAIL_FROM override
      process.env.EMAIL_FROM = "HAVN <noreply@mail.havn.co.in>";
      assert.strictEqual(getFromEmail(), "HAVN <noreply@mail.havn.co.in>");

      // Verify payload sent to Resend fetch API
      const capturedBodies: any[] = [];
      process.env.RESEND_API_KEY = "re_test_mock_key";
      delete process.env.EMAIL_FROM;
      (globalThis as any).fetch = async (_url: any, init: any) => {
        capturedBodies.push(JSON.parse(init?.body || "{}"));
        return new Response(JSON.stringify({ id: "mock-id" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      };

      await sendVerificationEmail("user@example.com", "verify-tok");
      await sendPasswordResetEmail("user@example.com", "reset-tok");

      assert.strictEqual(capturedBodies.length, 2);
      assert.strictEqual(capturedBodies[0].from, "HAVN <noreply@havn.co.in>");
      assert.ok(
        capturedBodies[0].html.includes("https://havn.co.in/verify-email?token=verify-tok"),
        "Verification email link must use normalized FRONTEND_URL without double slash"
      );
      assert.strictEqual(capturedBodies[1].from, "HAVN <noreply@havn.co.in>");
      assert.ok(
        capturedBodies[1].html.includes("https://havn.co.in/reset-password?token=reset-tok"),
        "Reset email link must use normalized FRONTEND_URL without double slash"
      );
      console.log("   ✓ Production sender, FRONTEND_URL normalization, and Resend payloads verified\n");
    } finally {
      globalThis.fetch = originalFetch;
      for (const [k, v] of Object.entries(savedEnv)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  }

  // --------------------------------------------------------------------------
  // 4. Registration Compensating Rollback When Email Delivery Fails
  // --------------------------------------------------------------------------
  console.log("[TEST 4/5] Registration rolls back unverified user if email send fails...");
  {
    const savedEnv = {
      RESEND_API_KEY: process.env.RESEND_API_KEY,
      FRONTEND_URL: process.env.FRONTEND_URL,
      NODE_ENV: process.env.NODE_ENV,
    };
    const originalFetch = globalThis.fetch;
    const rollbackEmail = `rollback-phaseA-${Date.now()}@example.com`;

    try {
      process.env.RESEND_API_KEY = "re_test_mock_key";
      process.env.FRONTEND_URL = "https://havn.co.in";
      process.env.NODE_ENV = "production";

      (globalThis as any).fetch = async () => {
        return new Response(
          JSON.stringify({ message: "Domain not verified", name: "validation_error" }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      };

      await assert.rejects(
        () =>
          register({
            name: "Rollback Test",
            email: rollbackEmail,
            password: "StrongPassword123!",
          }),
        /Domain not verified/
      );

      const userInDb = await prisma.user.findUnique({ where: { email: rollbackEmail } });
      assert.strictEqual(
        userInDb,
        null,
        "Unverified user must be rolled back when email delivery fails"
      );
      console.log("   ✓ Orphaned user cleaned up when Resend returns error\n");
    } finally {
      await prisma.user.deleteMany({ where: { email: rollbackEmail } }).catch(() => {});
      globalThis.fetch = originalFetch;
      for (const [k, v] of Object.entries(savedEnv)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  }

  // --------------------------------------------------------------------------
  // 5. GitHub OAuth Connect Callback Separation
  // --------------------------------------------------------------------------
  console.log("[TEST 5/5] GitHub OAuth connect callback separation & token exchange...");
  {
    const savedEnv = {
      GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
      GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
      GITHUB_CALLBACK_URL: process.env.GITHUB_CALLBACK_URL,
      GITHUB_CONNECT_CLIENT_ID: process.env.GITHUB_CONNECT_CLIENT_ID,
      GITHUB_CONNECT_CLIENT_SECRET: process.env.GITHUB_CONNECT_CLIENT_SECRET,
      GITHUB_CONNECT_CALLBACK_URL: process.env.GITHUB_CONNECT_CALLBACK_URL,
      ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
    };
    const originalPost = axios.post;
    const originalGet = axios.get;

    let testUser: any;

    try {
      process.env.GITHUB_CLIENT_ID = "login-client-id";
      process.env.GITHUB_CLIENT_SECRET = "login-client-secret";
      process.env.GITHUB_CALLBACK_URL = "https://api.havn.co.in/api/auth/github/callback";
      delete process.env.GITHUB_CONNECT_CLIENT_ID;
      delete process.env.GITHUB_CONNECT_CLIENT_SECRET;
      delete process.env.GITHUB_CONNECT_CALLBACK_URL;

      if (!process.env.ENCRYPTION_KEY) {
        process.env.ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
      }

      // Default connect callback remains separate from login callback
      assert.strictEqual(
        getGithubConnectRedirectUri(),
        "http://localhost:5000/api/github/callback"
      );

      // Configured production connect callback & optional separate app credentials
      process.env.GITHUB_CONNECT_CALLBACK_URL = "https://api.havn.co.in/api/github/callback";
      process.env.GITHUB_CONNECT_CLIENT_ID = "connect-client-id";
      process.env.GITHUB_CONNECT_CLIENT_SECRET = "connect-client-secret";

      testUser = await prisma.user.create({
        data: {
          name: "Phase A GitHub User",
          email: `gh-phaseA-${Date.now()}@example.com`,
        },
      });

      const authUrl = await generateConnectUrl(testUser.id);
      const parsedUrl = new URL(authUrl);
      assert.strictEqual(parsedUrl.searchParams.get("client_id"), "connect-client-id");
      assert.strictEqual(
        parsedUrl.searchParams.get("redirect_uri"),
        "https://api.havn.co.in/api/github/callback"
      );
      assert.strictEqual(parsedUrl.searchParams.get("scope"), "repo");

      const state = parsedUrl.searchParams.get("state");
      assert.ok(state, "OAuth state must be present in connect URL");

      let capturedTokenBody: any = null;
      (axios as any).post = async (url: string, body: any) => {
        if (url === "https://github.com/login/oauth/access_token") {
          capturedTokenBody = body;
          return { data: { access_token: "gho_mockAccessToken123456", scope: "repo" } };
        }
        return originalPost(url, body);
      };
      (axios as any).get = async (url: string) => {
        if (url === "https://api.github.com/user") {
          return { data: { id: 888880000 + (Date.now() % 10000), login: "phaseA-gh-user" } };
        }
        return originalGet(url);
      };

      await handleCallback("mock-gh-code", state);

      assert.strictEqual(capturedTokenBody?.client_id, "connect-client-id");
      assert.strictEqual(capturedTokenBody?.client_secret, "connect-client-secret");
      assert.strictEqual(
        capturedTokenBody?.redirect_uri,
        "https://api.havn.co.in/api/github/callback",
        "Token exchange must send exact connect redirect_uri"
      );

      console.log("   ✓ GitHub connect authorize & token exchange redirect_uri separated cleanly\n");
    } finally {
      axios.post = originalPost;
      axios.get = originalGet;
      if (testUser?.id) {
        await prisma.githubAccount.deleteMany({ where: { userId: testUser.id } }).catch(() => {});
        await prisma.githubOauthState.deleteMany({ where: { userId: testUser.id } }).catch(() => {});
        await prisma.user.deleteMany({ where: { id: testUser.id } }).catch(() => {});
      }
      for (const [k, v] of Object.entries(savedEnv)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  }

  console.log("==================================================================");
  console.log("  ALL PHASE A DEPLOYMENT PREP REGRESSION TESTS PASSED!            ");
  console.log("==================================================================");
}

runPhaseATests().catch((err) => {
  console.error("Phase A test failed:", err);
  process.exit(1);
});
