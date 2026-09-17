import assert from "assert";
import axios from "axios";
import prisma from "../../lib/prisma";
import { loginWithGoogle, loginWithGithub } from "../auth.service";

async function runTest() {
  console.log("Starting OAuth Redirect URI Configuration Regression Test...\n");

  const originalPost = axios.post;
  const originalGet = axios.get;

  const originalGoogleId = process.env.GOOGLE_CLIENT_ID;
  const originalGoogleSecret = process.env.GOOGLE_CLIENT_SECRET;
  const originalGoogleCallback = process.env.GOOGLE_CALLBACK_URL;

  const originalGithubId = process.env.GITHUB_CLIENT_ID;
  const originalGithubSecret = process.env.GITHUB_CLIENT_SECRET;
  const originalGithubCallback = process.env.GITHUB_CALLBACK_URL;

  process.env.GOOGLE_CLIENT_ID = "mock-google-id";
  process.env.GOOGLE_CLIENT_SECRET = "mock-google-secret";

  process.env.GITHUB_CLIENT_ID = "mock-github-id";
  process.env.GITHUB_CLIENT_SECRET = "mock-github-secret";

  try {
    // 1. Test default/fallback Google redirect URI
    console.log("1. Testing Google default redirect URI...");
    delete process.env.GOOGLE_CALLBACK_URL;

    let capturedGooglePayload: any = null;
    (axios as any).post = async (url: string, data: any) => {
      if (url === "https://oauth2.googleapis.com/token") {
        capturedGooglePayload = data;
        return { data: { access_token: "mock-token" } };
      }
      return { data: {} };
    };

    (axios as any).get = async (url: string) => {
      return {
        data: {
          sub: "12345",
          email: "test-google@example.com",
          email_verified: true,
        },
      };
    };

    await loginWithGoogle("code-1");
    assert.strictEqual(
      capturedGooglePayload?.redirect_uri,
      "http://localhost:5000/api/auth/google/callback",
      "Default Google redirect URI must match development callback URL"
    );
    console.log("   ✓ Google default redirect URI verified");

    // 2. Test configured GOOGLE_CALLBACK_URL environment variable
    console.log("2. Testing custom configured GOOGLE_CALLBACK_URL...");
    process.env.GOOGLE_CALLBACK_URL = "https://cloudforge.dev/api/auth/google/callback";
    await loginWithGoogle("code-2");
    assert.strictEqual(
      capturedGooglePayload?.redirect_uri,
      "https://cloudforge.dev/api/auth/google/callback",
      "Custom GOOGLE_CALLBACK_URL must be used when configured"
    );
    console.log("   ✓ Custom GOOGLE_CALLBACK_URL verified");

    // 3. Test default/fallback GitHub redirect URI
    console.log("3. Testing GitHub default redirect URI...");
    delete process.env.GITHUB_CALLBACK_URL;

    let capturedGithubPayload: any = null;
    (axios as any).post = async (url: string, data: any) => {
      if (url === "https://github.com/login/oauth/access_token") {
        capturedGithubPayload = data;
        return { data: { access_token: "mock-token", scope: "user:email" } };
      }
      return { data: {} };
    };

    (axios as any).get = async (url: string) => {
      if (url === "https://api.github.com/user") {
        return {
          data: {
            id: 999999999,
            login: "test-github-user",
            email: "test-github@example.com",
          },
        };
      }
      return { data: {} };
    };

    await loginWithGithub("gh-code-1");
    assert.strictEqual(
      capturedGithubPayload?.redirect_uri,
      "http://localhost:5000/api/auth/github/callback",
      "Default GitHub redirect URI must match development callback URL"
    );
    console.log("   ✓ GitHub default redirect URI verified");

    // 4. Test configured GITHUB_CALLBACK_URL environment variable
    console.log("4. Testing custom configured GITHUB_CALLBACK_URL...");
    process.env.GITHUB_CALLBACK_URL = "https://cloudforge.dev/api/auth/github/callback";
    await loginWithGithub("gh-code-2");
    assert.strictEqual(
      capturedGithubPayload?.redirect_uri,
      "https://cloudforge.dev/api/auth/github/callback",
      "Custom GITHUB_CALLBACK_URL must be used when configured"
    );
    console.log("   ✓ Custom GITHUB_CALLBACK_URL verified");

    console.log("\nAll OAuth redirect URI configuration tests passed successfully!");
  } finally {
    axios.post = originalPost;
    axios.get = originalGet;

    process.env.GOOGLE_CLIENT_ID = originalGoogleId;
    process.env.GOOGLE_CLIENT_SECRET = originalGoogleSecret;
    process.env.GOOGLE_CALLBACK_URL = originalGoogleCallback;

    process.env.GITHUB_CLIENT_ID = originalGithubId;
    process.env.GITHUB_CLIENT_SECRET = originalGithubSecret;
    process.env.GITHUB_CALLBACK_URL = originalGithubCallback;

    try {
      await prisma.user.deleteMany({
        where: { email: { in: ["test-google@example.com", "test-github@example.com"] } },
      });
    } catch (cleanupErr) {
      console.warn("Notice: Cleanup of test users skipped or failed:", cleanupErr);
    }
  }
}

runTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
