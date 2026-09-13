import assert from "assert";
import axios from "axios";
import prisma from "../../lib/prisma";
import { loginWithGoogle } from "../auth.service";

async function runTest() {
  console.log("Starting Google OAuth Verified Email Regression Test...\n");

  const originalPost = axios.post;
  const originalGet = axios.get;
  const originalClientId = process.env.GOOGLE_CLIENT_ID;
  const originalClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  process.env.GOOGLE_CLIENT_ID = "mock-client-id";
  process.env.GOOGLE_CLIENT_SECRET = "mock-client-secret";

  const targetEmail = `unverified-user-${Date.now()}@example.com`;

  try {
    // 1. Mock token exchange to succeed
    (axios as any).post = async (url: string) => {
      if (url === "https://oauth2.googleapis.com/token") {
        return { data: { access_token: "mock-google-access-token" } };
      }
      return (originalPost as any).apply(axios, arguments);
    };

    // 2. Mock userinfo with email_verified: false
    (axios as any).get = async (url: string) => {
      if (url === "https://www.googleapis.com/oauth2/v3/userinfo") {
        return {
          data: {
            sub: "google-uid-12345",
            email: targetEmail,
            name: "Unverified User",
            picture: "https://example.com/avatar.png",
            email_verified: false,
          },
        };
      }
      return (originalGet as any).apply(axios, arguments);
    };

    // 3. Verify that loginWithGoogle rejects unverified email
    console.log("1. Verifying unverified Google account rejection...");
    await assert.rejects(
      async () => loginWithGoogle("mock-auth-code"),
      /Google account email is not verified/
    );
    console.log("   ✓ Rejected safely with 'Google account email is not verified.'");

    // 4. Verify no user was created or linked in database
    const userInDb = await prisma.user.findUnique({
      where: { email: targetEmail },
    });
    assert.strictEqual(userInDb, null, "User must not be created for unverified Google account");
    console.log("   ✓ Verified no user was created in database");

    // 5. Test verified Google account succeeds
    console.log("2. Verifying verified Google account succeeds...");
    (axios as any).get = async (url: string) => {
      if (url === "https://www.googleapis.com/oauth2/v3/userinfo") {
        return {
          data: {
            sub: "google-uid-12345",
            email: targetEmail,
            name: "Verified User",
            picture: "https://example.com/avatar.png",
            email_verified: true,
          },
        };
      }
      return (originalGet as any).apply(axios, arguments);
    };

    const result = await loginWithGoogle("mock-auth-code-2");
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.user.email, targetEmail);

    const createdUser = await prisma.user.findUnique({
      where: { email: targetEmail },
    });
    assert.strictEqual(createdUser?.emailVerified, true);
    console.log("   ✓ Verified Google account successfully authenticated and created with emailVerified=true");

    // Clean up created user
    if (createdUser) {
      await prisma.user.delete({ where: { id: createdUser.id } });
    }

    console.log("\nAll Google OAuth verification tests passed successfully!");
  } finally {
    axios.post = originalPost;
    axios.get = originalGet;
    process.env.GOOGLE_CLIENT_ID = originalClientId;
    process.env.GOOGLE_CLIENT_SECRET = originalClientSecret;
  }
}

runTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
