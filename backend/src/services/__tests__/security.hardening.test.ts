import assert from "assert";
import http from "http";
import app from "../../app";
import prisma from "../../lib/prisma";
import { rateLimiterStore, getClientIp } from "../../middleware/rateLimit.middleware";
import { generateToken, verifyToken } from "../../utils/jwt";
import { encryptToken, decryptToken } from "../../utils/crypto";
import { sanitizeLogOutput, sanitizeErrorMessage } from "../../utils/sanitizer";

async function runSecurityHardeningTests() {
  console.log("==================================================================");
  console.log("  HAVN SECURITY HARDENING REGRESSION TEST SUITE                  ");
  console.log("==================================================================");

  // Clear in-memory rate limiters for clean test starting state
  rateLimiterStore.reset();

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  async function apiRequest(
    path: string,
    options: {
      method?: string;
      headers?: Record<string, string>;
      body?: any;
    } = {}
  ) {
    const url = `${baseUrl}${path}`;
    const headers: Record<string, string> = { ...(options.headers || {}) };
    let bodyStr: string | undefined;
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
      bodyStr = JSON.stringify(options.body);
    }
    const res = await fetch(url, {
      method: options.method || "GET",
      headers,
      body: bodyStr,
    });
    let bodyData: any = null;
    const text = await res.text();
    try {
      bodyData = JSON.parse(text);
    } catch {
      bodyData = text;
    }
    return {
      status: res.status,
      headers: Object.fromEntries(res.headers.entries()),
      body: bodyData,
    };
  }

  const timestamp = Date.now();
  let userA: any;
  let userB: any;
  let tokenA: string = "";
  let tokenB: string = "";
  let projectA: any;
  let deploymentA: any;

  try {
    // --------------------------------------------------------------------------
    // Test 1: HTTP Security Headers & Information Disclosure
    // --------------------------------------------------------------------------
    console.log("\nTest 1: HTTP Security headers and information disclosure protection...");
    const healthRes = await apiRequest("/api/health");
    assert.strictEqual(healthRes.headers["x-content-type-options"], "nosniff", "Must include X-Content-Type-Options: nosniff");
    assert.strictEqual(healthRes.headers["x-frame-options"], "DENY", "Must include X-Frame-Options: DENY");
    assert.strictEqual(healthRes.headers["referrer-policy"], "strict-origin-when-cross-origin", "Must include strict Referrer-Policy");
    assert.strictEqual(healthRes.headers["x-powered-by"], undefined, "Must disable X-Powered-By header");
    console.log("  ✓ Test 1 passed: Standard security headers verified, X-Powered-By stripped");

    // --------------------------------------------------------------------------
    // Test 2: CORS Restriction
    // --------------------------------------------------------------------------
    console.log("\nTest 2: CORS restriction on unauthorized origins...");
    const corsRes = await apiRequest("/api/health", {
      headers: { Origin: "http://malicious-site.com" },
    });
    assert.notStrictEqual(
      corsRes.headers["access-control-allow-origin"],
      "http://malicious-site.com",
      "Must not reflect unauthorized third-party origin in Access-Control-Allow-Origin"
    );
    console.log("  ✓ Test 2 passed: Unauthorized third-party origin rejected by CORS policy");

    // --------------------------------------------------------------------------
    // Test 3: JWT Secret Fail-Safe Protection
    // --------------------------------------------------------------------------
    console.log("\nTest 3: JWT_SECRET fail-safe verification...");
    const originalJwtSecret = process.env.JWT_SECRET;
    try {
      delete process.env.JWT_SECRET;
      assert.throws(() => {
        generateToken({ id: "test", email: "test@example.com" });
      }, /JWT_SECRET environment variable is not defined/, "Must throw fatal error if JWT_SECRET is missing");
    } finally {
      process.env.JWT_SECRET = originalJwtSecret;
    }
    console.log("  ✓ Test 3 passed: Fail-safe guard blocks token signing when JWT_SECRET is undefined");

    // --------------------------------------------------------------------------
    // Test 4: Secret Sanitization
    // --------------------------------------------------------------------------
    console.log("\nTest 4: Secret sanitization pass on sensitive tokens and paths...");
    const rawLeak = "Build failed with ghp_123456789012345678901234567890123456 and token github_pat_11AAAAAAA01234567890_1234567890123456789012345678901234567890123456789012345678901234567890 at C:\\Users\\Admin\\AppData\\Local\\Temp\\build.log";
    const sanitized = sanitizeLogOutput(rawLeak);
    assert(!sanitized.includes("ghp_123456789012345678901234567890123456"), "GitHub PAT must be redacted");
    assert(!sanitized.includes("github_pat_11AAAAAAA"), "GitHub fine-grained PAT must be redacted");
    assert(!sanitized.includes("C:\\Users\\Admin"), "Local absolute filesystem paths must be redacted");
    console.log("  ✓ Test 4 passed: All tokens and local paths redacted cleanly");

    // --------------------------------------------------------------------------
    // Test 5: AES-256-GCM Token Encryption Tamper-Resistance
    // --------------------------------------------------------------------------
    console.log("\nTest 5: AES-256-GCM authenticated token encryption...");
    const plainToken = "gho_superSecretOauthToken123456789";
    const encrypted = encryptToken(plainToken);
    assert.notStrictEqual(encrypted, plainToken);
    const decrypted = decryptToken(encrypted);
    assert.strictEqual(decrypted, plainToken);

    // Tamper with ciphertext
    const tampered = encrypted.slice(0, -4) + "ffff";
    assert.throws(() => {
      decryptToken(tampered);
    }, /Decryption failed/, "Tampered ciphertext must fail authentication tag check");
    console.log("  ✓ Test 5 passed: AES-256-GCM encryption verified and tamper-resistant");

    // --------------------------------------------------------------------------
    // Test 6: Input Validation on Login & Bcrypt DoS Protection
    // --------------------------------------------------------------------------
    console.log("\nTest 6: Input validation on Login and password length caps...");
    const badLoginRes = await apiRequest("/api/auth/login", {
      method: "POST",
      body: { email: "not-an-email", password: "" },
    });
    assert.strictEqual(badLoginRes.status, 400);
    assert.strictEqual(badLoginRes.body.success, false);

    // Huge password input (Bcrypt DoS test: password > 128 chars rejected)
    const hugePassword = "a".repeat(200);
    const oversizedLoginRes = await apiRequest("/api/auth/login", {
      method: "POST",
      body: { email: "user@example.com", password: hugePassword },
    });
    assert.strictEqual(oversizedLoginRes.status, 400);
    assert.strictEqual(oversizedLoginRes.body.success, false);
    assert(oversizedLoginRes.body.errors?.password);
    console.log("  ✓ Test 6 passed: Login schema validation blocks malformed emails and oversized passwords");

    // --------------------------------------------------------------------------
    // Setup Test Users for IDOR & Rate Limit Testing
    // --------------------------------------------------------------------------
    userA = await prisma.user.create({
      data: {
        email: `sec-user-a-${timestamp}@example.com`,
        name: "Security User A",
        password: "$2b$10$fakeHashedPasswordForSecurityTestsOnlyA",
        emailVerified: true,
      },
    });
    tokenA = generateToken({ id: userA.id, email: userA.email });

    userB = await prisma.user.create({
      data: {
        email: `sec-user-b-${timestamp}@example.com`,
        name: "Security User B",
        password: "$2b$10$fakeHashedPasswordForSecurityTestsOnlyB",
        emailVerified: true,
      },
    });
    tokenB = generateToken({ id: userB.id, email: userB.email });

    projectA = await prisma.project.create({
      data: {
        name: "User A Security Project",
        repositoryName: "test/repo-a",
        repositoryUrl: "https://github.com/test/repo-a",
        branch: "main",
        userId: userA.id,
      },
    });

    deploymentA = await prisma.deployment.create({
      data: {
        projectId: projectA.id,
        status: "BUILT",
        repositoryName: projectA.repositoryName,
        repositoryUrl: projectA.repositoryUrl,
        branch: "main",
        logs: {
          createMany: {
            data: [
              { sequence: 1, stream: "SYSTEM", line: "[SYSTEM] Test build started." },
              { sequence: 2, stream: "STDOUT", line: "Compiling..." },
            ],
          },
        },
      },
    });

    // --------------------------------------------------------------------------
    // Test 7: Project Metadata Validation
    // --------------------------------------------------------------------------
    console.log("\nTest 7: Project creation metadata validation...");
    const invalidProjectRes = await apiRequest("/api/projects", {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
      body: {
        name: "A", // too short (min 2)
        repositoryUrl: "ftp://not-github.com/bad/repo", // invalid repo URL protocol
        branch: "bad branch with spaces; rm -rf", // invalid branch characters
      },
    });
    assert.strictEqual(invalidProjectRes.status, 400);
    assert.strictEqual(invalidProjectRes.body.success, false);
    console.log("  ✓ Test 7 passed: Schema rejects short names, invalid repo protocols, and command injection strings in branches");

    // --------------------------------------------------------------------------
    // Test 8: Data Isolation & IDOR Enforcement
    // --------------------------------------------------------------------------
    console.log("\nTest 8: IDOR protection across projects, deployments, logs, and raw logs...");

    // User B tries to view User A's project
    const idorProjectRes = await apiRequest(`/api/projects/${projectA.id}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.strictEqual(idorProjectRes.status, 404, "Cross-user project fetch must return 404");

    // User B tries to update User A's project
    const idorUpdateRes = await apiRequest(`/api/projects/${projectA.id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${tokenB}` },
      body: { name: "Hacked Project" },
    });
    assert.strictEqual(idorUpdateRes.status, 404, "Cross-user project update must return 404");

    // User B tries to view User A's deployment
    const idorDepRes = await apiRequest(`/api/deployments/${deploymentA.id}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.strictEqual(idorDepRes.status, 404, "Cross-user deployment fetch must return 404");

    // User B tries to read User A's logs
    const idorLogsRes = await apiRequest(`/api/deployments/${deploymentA.id}/logs`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.strictEqual(idorLogsRes.status, 404, "Cross-user deployment logs must return 404");

    // User B tries to download User A's raw logs
    const idorRawRes = await apiRequest(`/api/deployments/${deploymentA.id}/logs/raw`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.strictEqual(idorRawRes.status, 404, "Cross-user raw logs download must return 404");

    // User B tries to query AI for User A's deployment
    const idorAiRes = await apiRequest(`/api/deployments/${deploymentA.id}/ai/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenB}` },
      body: { mode: "beginner", action: "summary" },
    });
    assert.strictEqual(idorAiRes.status, 404, "Cross-user AI query must return 404");

    console.log("  ✓ Test 8 passed: Complete IDOR protection confirmed; unauthorized access rejected with 404 across all surfaces");

    // --------------------------------------------------------------------------
    // Test 9: Login Rate Limiting (Brute-Force Protection)
    // --------------------------------------------------------------------------
    console.log("\nTest 9: Login account rate limiting (5 attempts per 15 min)...");
    const targetEmail = `victim-${timestamp}@example.com`;
    let wasBlocked = false;

    for (let i = 1; i <= 6; i++) {
      const res = await apiRequest("/api/auth/login", {
        method: "POST",
        body: { email: targetEmail, password: "WrongPassword123" },
      });
      if (res.status === 429) {
        wasBlocked = true;
        assert(res.body.message.includes("Too many login attempts"));
        assert(res.headers["retry-after"]);
        break;
      }
    }
    assert(wasBlocked, "Login attempts exceeding 5 must be throttled with HTTP 429");
    console.log("  ✓ Test 9 passed: Credential stuffing / brute force throttled with HTTP 429 and Retry-After header");

    // --------------------------------------------------------------------------
    // Test 10: Deployment Creation Rate Limiting
    // --------------------------------------------------------------------------
    console.log("\nTest 10: Deployment creation rate limiting per user (10 requests per 5 min)...");
    let depBlocked = false;
    for (let i = 1; i <= 12; i++) {
      const res = await apiRequest(`/api/projects/${projectA.id}/deployments`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tokenA}` },
        body: { branch: "main" },
      });
      if (res.status === 429) {
        depBlocked = true;
        assert(res.body.message.includes("Deployment creation limit reached"));
        break;
      }
    }
    assert(depBlocked, "Deployment creation exceeding 10 per 5 min must be throttled with HTTP 429");
    console.log("  ✓ Test 10 passed: Deployment pipeline creation spam strictly throttled per user");

    // --------------------------------------------------------------------------
    // Test 11: Proxy Trust & Client IP Resolution
    // --------------------------------------------------------------------------
    console.log("\nTest 11: Proxy trust and getClientIp resolution...");
    const originalTrust = app.get("trust proxy");
    try {
      // 11a: When trust proxy is disabled, spoofed X-Forwarded-For is ignored
      app.set("trust proxy", false);
      const fakeReqDirect = {
        headers: { "x-forwarded-for": "203.0.113.195" },
        ip: undefined,
        socket: { remoteAddress: "127.0.0.1" },
      } as any;
      assert.strictEqual(getClientIp(fakeReqDirect), "127.0.0.1", "Direct deployment must not trust spoofed X-Forwarded-For");

      // 11b: When trust proxy is enabled, Express resolves req.ip
      app.set("trust proxy", 1);
      const fakeReqProxied = {
        headers: { "x-forwarded-for": "203.0.113.195" },
        ip: "203.0.113.195",
        socket: { remoteAddress: "10.0.0.1" },
      } as any;
      assert.strictEqual(getClientIp(fakeReqProxied), "203.0.113.195", "Behind trusted proxy, resolved req.ip must be used");
    } finally {
      app.set("trust proxy", originalTrust);
    }
    console.log("  ✓ Test 11 passed: Proxy trust safely enforced; spoofed X-Forwarded-For rejected when trust proxy is off");

    // --------------------------------------------------------------------------
    // Test 12: Production CORS Lockdown on Arbitrary Loopback Origins
    // --------------------------------------------------------------------------
    console.log("\nTest 12: Production CORS lockdown on arbitrary loopback origins...");
    const originalEnv = process.env.NODE_ENV;
    try {
      // In production mode, arbitrary localhost origins are blocked
      process.env.NODE_ENV = "production";
      const prodCorsRes = await apiRequest("/api/health", {
        headers: { Origin: "http://localhost:9999" },
      });
      assert.notStrictEqual(
        prodCorsRes.headers["access-control-allow-origin"],
        "http://localhost:9999",
        "In production, arbitrary loopback origin must not be allowed"
      );

      // But configured frontend is still allowed in production
      const configuredRes = await apiRequest("/api/health", {
        headers: { Origin: "http://localhost:3000" },
      });
      assert.strictEqual(
        configuredRes.headers["access-control-allow-origin"],
        "http://localhost:3000",
        "Configured FRONTEND_URL must still be permitted in production"
      );
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
    console.log("  ✓ Test 12 passed: In production, arbitrary loopback origins are blocked while configured frontend is allowed");

    console.log("\n==================================================================");
    console.log("  ALL 12 SECURITY HARDENING REGRESSION TESTS PASSED!             ");
    console.log("==================================================================");
  } finally {
    // Teardown
    rateLimiterStore.reset();
    server.close();
    try {
      if (projectA?.id) {
        await prisma.deployment.deleteMany({ where: { projectId: projectA.id } });
        await prisma.project.delete({ where: { id: projectA.id } });
      }
      if (userA?.id) {
        await prisma.user.delete({ where: { id: userA.id } });
      }
      if (userB?.id) {
        await prisma.user.delete({ where: { id: userB.id } });
      }
    } catch (e) {
      console.warn("Cleanup warning:", e);
    }
  }
}

runSecurityHardeningTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ SECURITY HARDENING TEST SUITE FAILED:", err);
    process.exit(1);
  });
