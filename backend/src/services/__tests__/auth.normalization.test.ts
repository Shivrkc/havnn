import assert from "assert";
import prisma from "../../lib/prisma";
import { register, login, forgotPassword, normalizeEmail } from "../auth.service";
import { AUTH_MESSAGES } from "../../constants/messages";

async function runTest() {
  console.log("Starting Auth Email Normalization Regression Tests...\n");

  const originalFetch = globalThis.fetch;
  (globalThis as any).fetch = async (input: any, init: any) => {
    const url = typeof input === "string" ? input : input?.url || "";
    if (url.includes("api.resend.com")) {
      return new Response(JSON.stringify({ id: "mock-email-id" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return originalFetch(input, init);
  };

  const baseId = Date.now();
  const rawEmailWithMixedCaseAndSpaces = `  User.${baseId}@Example.COM  `;
  const expectedNormalizedEmail = `user.${baseId}@example.com`;
  const rawLoginDifferentCasing = `USER.${baseId}@EXAMPLE.COM`;
  const rawLoginWithSpaces = `   user.${baseId}@example.com   `;
  const password = "Password123!";

  let createdUserId: string | null = null;

  try {
    // 1. Test normalizeEmail utility function directly
    console.log("1. Testing normalizeEmail utility...");
    assert.strictEqual(
      normalizeEmail("  Test.User@Domain.COM  "),
      "test.user@domain.com",
      "normalizeEmail must trim and lowercase"
    );
    console.log("   ✓ normalizeEmail trims and lowercases correctly");

    // 2. Test registration with mixed-case and surrounding whitespace
    console.log("2. Testing registration with mixed-case and whitespace...");
    const regResult = await register({
      name: "Normalized User",
      email: rawEmailWithMixedCaseAndSpaces,
      password,
    });

    assert.strictEqual(regResult.success, true);
    assert.strictEqual(
      regResult.user.email,
      expectedNormalizedEmail,
      "User email returned from registration must be normalized"
    );

    createdUserId = regResult.user.id;

    // Verify stored email in database
    const userInDb = await prisma.user.findUnique({
      where: { email: expectedNormalizedEmail },
    });
    assert.ok(userInDb, "User must be found by normalized email in database");
    assert.strictEqual(
      userInDb.email,
      expectedNormalizedEmail,
      "User email stored in database must be strictly normalized"
    );
    console.log("   ✓ Registration normalized email and saved properly in DB");

    // 3. Test duplicate registration with different casing and whitespace
    console.log("3. Testing duplicate registration rejection with different casing...");
    await assert.rejects(
      async () => {
        await register({
          name: "Duplicate User",
          email: `   USER.${baseId}@EXAMPLE.COM   `,
          password: "AnotherPassword123!",
        });
      },
      (err: any) => {
        assert.strictEqual(err.message, AUTH_MESSAGES.USER_EXISTS);
        return true;
      },
      "Duplicate registration with different casing/whitespace must be rejected"
    );
    console.log("   ✓ Duplicate registration correctly rejected with USER_EXISTS");

    // 4. Test login before verification throws verification error
    console.log("4. Testing login before email verification...");
    await assert.rejects(
      async () => {
        await login({
          email: rawLoginDifferentCasing,
          password,
        });
      },
      /Please verify your email before logging in/,
      "Unverified user login must be rejected even with different casing"
    );
    console.log("   ✓ Unverified user recognized across casing differences");

    // Verify email manually in database for login tests
    await prisma.user.update({
      where: { id: createdUserId },
      data: { emailVerified: true },
    });

    // 5. Test login with different casing
    console.log("5. Testing login with different casing...");
    const loginResultCase = await login({
      email: rawLoginDifferentCasing,
      password,
    });
    assert.strictEqual(loginResultCase.success, true);
    assert.strictEqual(
      loginResultCase.user.email,
      expectedNormalizedEmail,
      "Logged in user email must be normalized"
    );
    assert.strictEqual(loginResultCase.user.id, createdUserId);
    console.log("   ✓ Login succeeded with different casing");

    // 6. Test login with leading and trailing whitespace
    console.log("6. Testing login with surrounding whitespace...");
    const loginResultSpace = await login({
      email: rawLoginWithSpaces,
      password,
    });
    assert.strictEqual(loginResultSpace.success, true);
    assert.strictEqual(loginResultSpace.user.id, createdUserId);
    console.log("   ✓ Login succeeded with surrounding whitespace");

    // 7. Test login with invalid password preserves invalid credentials error
    console.log("7. Testing login with wrong password...");
    await assert.rejects(
      async () => {
        await login({
          email: rawLoginDifferentCasing,
          password: "WrongPassword!",
        });
      },
      (err: any) => {
        assert.strictEqual(err.message, AUTH_MESSAGES.INVALID_CREDENTIALS);
        return true;
      }
    );
    console.log("   ✓ Invalid credentials error preserved");

    // 8. Test forgot-password with different casing and whitespace
    console.log("8. Testing forgotPassword with casing and whitespace...");
    const forgotResult = await forgotPassword(`   USER.${baseId}@EXAMPLE.COM   `);
    assert.strictEqual(forgotResult.success, true);

    // Verify reset token was generated for the user
    const resetToken = await prisma.passwordResetToken.findFirst({
      where: { userId: createdUserId },
    });
    assert.ok(
      resetToken,
      "Password reset token must be created for user looked up with mixed-case/whitespace email"
    );
    console.log("   ✓ forgotPassword generated reset token for user via normalized lookup");

    console.log("\n==================================================================");
    console.log("  ALL AUTH EMAIL NORMALIZATION TESTS PASSED SUCCESSFULLY!         ");
    console.log("==================================================================");
  } finally {
    if (createdUserId) {
      // Clean up test data
      try {
        await prisma.emailVerificationToken.deleteMany({
          where: { userId: createdUserId },
        });
        await prisma.passwordResetToken.deleteMany({
          where: { userId: createdUserId },
        });
        await prisma.user.deleteMany({
          where: { id: createdUserId },
        });
      } catch (cleanupErr) {
        console.error("Cleanup error:", cleanupErr);
      }
    }
    globalThis.fetch = originalFetch;
  }
}

runTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
