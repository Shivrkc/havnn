import assert from "assert";
import http from "http";
import app from "../../app";
import { rateLimiterStore } from "../rateLimit.middleware";

async function makeRequest(options: http.RequestOptions, body?: any): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: any }> {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        let parsed: any = null;
        try {
          parsed = data ? JSON.parse(data) : null;
        } catch {
          parsed = data;
        }
        resolve({
          statusCode: res.statusCode || 0,
          headers: res.headers,
          body: parsed,
        });
      });
    });

    req.on("error", reject);

    if (body) {
      req.write(typeof body === "string" ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runTest() {
  console.log("Starting Password Endpoints Rate Limiting Regression Tests...\n");

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address() as any;
  const port = address.port;

  const originalTrustProxy = app.get("trust proxy");
  app.set("trust proxy", 1);

  try {
    // Clean slate for rate limiter
    rateLimiterStore.reset();

    // 1. Test POST /api/auth/forgot-password Account-Aware Rate Limiting
    console.log("1. Testing account-aware rate limiting for /api/auth/forgot-password (limit = 3)...");
    const testEmail = "victim@example.com";

    for (let i = 1; i <= 3; i++) {
      const res = await makeRequest(
        {
          hostname: "127.0.0.1",
          port,
          path: "/api/auth/forgot-password",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Forwarded-For": `192.168.1.${i}`, // Different IPs, same account
          },
        },
        { email: `  VICTIM@example.com  ` } // Mixed case/spaces to verify normalization in limiter
      );

      assert.strictEqual(
        res.statusCode,
        200,
        `Request ${i} for victim account should succeed with 200`
      );
      assert.strictEqual(
        res.body.success,
        true,
        "Response must preserve generic success message"
      );
    }

    // 4th request for the same account should trigger 429 Too Many Requests
    const resBlockedAccount = await makeRequest(
      {
        hostname: "127.0.0.1",
        port,
        path: "/api/auth/forgot-password",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Forwarded-For": "192.168.1.99",
        },
      },
      { email: testEmail }
    );

    assert.strictEqual(
      resBlockedAccount.statusCode,
      429,
      "4th forgot-password request for same account must return 429"
    );
    assert.match(
      resBlockedAccount.body.message,
      /Too many password reset requests for this account/,
      "Must return account-specific rate limit message"
    );
    assert.ok(resBlockedAccount.headers["retry-after"], "Retry-After header must be present");
    console.log("   ✓ Account-aware rate limiting blocked excess requests across different IPs");

    // 2. Test POST /api/auth/forgot-password IP-based Rate Limiting
    console.log("\n2. Testing IP-based rate limiting for /api/auth/forgot-password (limit = 5)...");
    rateLimiterStore.reset();
    const spammerIp = "203.0.113.50";

    for (let i = 1; i <= 5; i++) {
      const res = await makeRequest(
        {
          hostname: "127.0.0.1",
          port,
          path: "/api/auth/forgot-password",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Forwarded-For": spammerIp,
          },
        },
        { email: `target${i}@example.com` } // Different accounts, same IP
      );

      assert.strictEqual(
        res.statusCode,
        200,
        `Request ${i} from IP should succeed`
      );
    }

    // 6th request from the same IP should trigger 429
    const resBlockedIp = await makeRequest(
      {
        hostname: "127.0.0.1",
        port,
        path: "/api/auth/forgot-password",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Forwarded-For": spammerIp,
        },
      },
      { email: "target6@example.com" }
    );

    assert.strictEqual(
      resBlockedIp.statusCode,
      429,
      "6th forgot-password request from same IP must return 429"
    );
    assert.match(
      resBlockedIp.body.message,
      /Too many password reset requests from this IP/,
      "Must return IP rate limit message"
    );
    console.log("   ✓ IP-based rate limiting blocked excess requests from single IP");

    // 3. Test POST /api/auth/reset-password Rate Limiting
    console.log("\n3. Testing rate limiting for /api/auth/reset-password (limit = 10)...");
    rateLimiterStore.reset();
    const bruteForceIp = "203.0.113.60";

    for (let i = 1; i <= 10; i++) {
      const res = await makeRequest(
        {
          hostname: "127.0.0.1",
          port,
          path: "/api/auth/reset-password",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Forwarded-For": bruteForceIp,
          },
        },
        { token: `invalid-token-${i}`, newPassword: "ValidPassword123!" }
      );

      // Token is invalid, so status is 400, but rate limiter allowed it through (not 429)
      assert.strictEqual(
        res.statusCode,
        400,
        `Request ${i} should be evaluated by controller (returning 400 for bad token)`
      );
    }

    // 11th request from same IP should be blocked with 429
    const resBlockedReset = await makeRequest(
      {
        hostname: "127.0.0.1",
        port,
        path: "/api/auth/reset-password",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Forwarded-For": bruteForceIp,
        },
      },
      { token: "another-token", newPassword: "ValidPassword123!" }
    );

    assert.strictEqual(
      resBlockedReset.statusCode,
      429,
      "11th reset-password request must return 429"
    );
    assert.match(
      resBlockedReset.body.message,
      /Too many password reset attempts/,
      "Must return reset password rate limit message"
    );
    console.log("   ✓ Reset password rate limiting blocked brute-force attempts with 429");

    // 4. Test PUT /api/auth/change-password Rate Limiting
    console.log("\n4. Testing rate limiting for /api/auth/change-password (limit = 5)...");
    rateLimiterStore.reset();
    const changePasswordIp = "203.0.113.70";

    // For change-password without auth token, authenticate middleware returns 401
    // Let's verify rate limiter triggers when requests are authenticated
    // Generate a valid JWT token payload for testing
    const jwt = await import("../../utils/jwt");
    const mockToken = jwt.generateToken({ id: "test-user-rate-limit-1", email: "test@example.com" });

    for (let i = 1; i <= 5; i++) {
      const res = await makeRequest(
        {
          hostname: "127.0.0.1",
          port,
          path: "/api/auth/change-password",
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${mockToken}`,
            "X-Forwarded-For": changePasswordIp,
          },
        },
        { currentPassword: "wrong", newPassword: "NewPassword123!" }
      );

      // User not in DB -> controller returns 400 "User not found."
      assert.strictEqual(
        res.statusCode,
        400,
        `Attempt ${i} should reach controller (400 for user not in DB)`
      );
    }

    // 6th attempt should return 429
    const resBlockedChange = await makeRequest(
      {
        hostname: "127.0.0.1",
        port,
        path: "/api/auth/change-password",
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${mockToken}`,
          "X-Forwarded-For": changePasswordIp,
        },
      },
      { currentPassword: "wrong", newPassword: "NewPassword123!" }
    );

    assert.strictEqual(
      resBlockedChange.statusCode,
      429,
      "6th change-password request must return 429"
    );
    assert.match(
      resBlockedChange.body.message,
      /Too many password change attempts/,
      "Must return change password rate limit message"
    );
    console.log("   ✓ Change password rate limiting blocked excess attempts with 429");

    console.log("\n==================================================================");
    console.log("  ALL PASSWORD ENDPOINT RATE LIMITING TESTS PASSED!               ");
    console.log("==================================================================");
  } finally {
    app.set("trust proxy", originalTrustProxy);
    rateLimiterStore.reset();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

runTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
