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
  console.log("Starting Test Email Endpoint Protection Regression Test...\n");

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address() as any;
  const port = address.port;

  const originalNodeEnv = process.env.NODE_ENV;

  const originalTrustProxy = app.get("trust proxy");
  app.set("trust proxy", 1);

  try {
    rateLimiterStore.reset();

    // 1. Test in development/test environment (NODE_ENV !== "production")
    process.env.NODE_ENV = "development";
    console.log("1. Testing /api/auth/test-email invalid email rejection...");
    const resBadEmail = await makeRequest(
      {
        hostname: "127.0.0.1",
        port,
        path: "/api/auth/test-email",
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
      { email: "   " }
    );
    assert.strictEqual(resBadEmail.statusCode, 400);
    assert.strictEqual(resBadEmail.body.message, "Email is required");
    console.log("   ✓ Missing/empty email safely rejected with 400");

    // 2. Test rate limiting on test-email (limit = 3 per IP)
    console.log("2. Testing test-email rate limiting (limit = 3)...");
    const testIp = "198.51.100.22";
    // Mock globalThis.fetch to avoid actually hitting Resend API
    const originalFetch = globalThis.fetch;
    (globalThis as any).fetch = async (input: any) => {
      return new Response(JSON.stringify({ id: "mock-test-email" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    try {
      for (let i = 1; i <= 3; i++) {
        const res = await makeRequest(
          {
            hostname: "127.0.0.1",
            port,
            path: "/api/auth/test-email",
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Forwarded-For": testIp,
            },
          },
          { email: "dev@example.com" }
        );
        assert.strictEqual(res.statusCode, 200, `Request ${i} should be permitted`);
      }

      // 4th request from same IP should be blocked with 429
      const resRateLimited = await makeRequest(
        {
          hostname: "127.0.0.1",
          port,
          path: "/api/auth/test-email",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Forwarded-For": testIp,
          },
        },
        { email: "dev@example.com" }
      );
      assert.strictEqual(resRateLimited.statusCode, 429);
      assert.match(resRateLimited.body.message, /Too many test email requests/);
      console.log("   ✓ Rate limiting blocked 4th request from single IP with 429");
    } finally {
      globalThis.fetch = originalFetch;
    }

    // 3. Test production lockdown (NODE_ENV === "production")
    console.log("3. Testing production lockdown of /api/auth/test-email...");
    process.env.NODE_ENV = "production";
    rateLimiterStore.reset();

    const resProd = await makeRequest(
      {
        hostname: "127.0.0.1",
        port,
        path: "/api/auth/test-email",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Forwarded-For": "198.51.100.99",
        },
      },
      { email: "target@external.com" }
    );

    assert.strictEqual(resProd.statusCode, 403, "Production requests must be blocked with 403 Forbidden");
    assert.strictEqual(
      resProd.body.message,
      "Test email endpoint is disabled in production."
    );
    console.log("   ✓ Production request strictly blocked with 403 Forbidden");

    console.log("\n==================================================================");
    console.log("  ALL TEST-EMAIL PROTECTION TESTS PASSED SUCCESSFULLY!            ");
    console.log("==================================================================");
  } finally {
    app.set("trust proxy", originalTrustProxy);
    process.env.NODE_ENV = originalNodeEnv;
    rateLimiterStore.reset();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

runTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
