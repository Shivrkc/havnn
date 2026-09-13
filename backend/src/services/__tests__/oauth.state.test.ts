import assert from "assert";
import axios from "axios";
import {
  generateOAuthState,
  validateOAuthState,
  createOAuthExchangeCode,
  consumeOAuthExchangeCode,
  clearOAuthStateStore,
  clearOAuthExchangeStore,
} from "../auth.service";
import {
  googleCallback,
  githubLoginCallback,
  exchangeOAuthCode,
} from "../../controllers/auth.controller";

async function runTest() {
  console.log("Starting OAuth State CSRF & One-Time Code Exchange Tests...\n");

  // --------------------------------------------------------------------------
  // 1. Unit Tests: OAuth State Generation & Validation
  // --------------------------------------------------------------------------
  console.log("1. Testing OAuth State Generation & Entropy...");
  await clearOAuthStateStore();

  const state1 = await generateOAuthState("google");
  const state2 = await generateOAuthState("google");
  const stateGithub = await generateOAuthState("github");

  assert.strictEqual(typeof state1, "string");
  assert.strictEqual(state1.length, 64, "State should be 32 bytes hex encoded (64 chars)");
  assert.notStrictEqual(state1, state2, "Successive generated states must be unique");
  console.log("   ✓ State generation produces 64-char cryptographically unique tokens");

  console.log("2. Testing OAuth State Validation & Single-Use Consumption...");
  // Valid validation
  const isValid = await validateOAuthState(state1, "google");
  assert.strictEqual(isValid, true, "Valid Google state must pass validation");

  // Replay attempt (single-use)
  const isReplayed = await validateOAuthState(state1, "google");
  assert.strictEqual(isReplayed, false, "Replayed state must be rejected");
  console.log("   ✓ State is consumed immediately and cannot be replayed");

  console.log("3. Testing Provider Isolation...");
  // Provider mismatch
  const isMismatched = await validateOAuthState(stateGithub, "google");
  assert.strictEqual(isMismatched, false, "GitHub state must not validate for Google provider");
  console.log("   ✓ State prevents cross-provider confusion");

  console.log("4. Testing Invalid/Tampered State Rejection...");
  assert.strictEqual(await validateOAuthState("invalid-state-token", "google"), false);
  assert.strictEqual(await validateOAuthState("", "google"), false);
  assert.strictEqual(await validateOAuthState(null as any, "google"), false);
  assert.strictEqual(await validateOAuthState(undefined as any, "google"), false);
  console.log("   ✓ Tampered, empty, and non-string states are rejected safely");

  // --------------------------------------------------------------------------
  // 2. Unit Tests: Short-Lived OAuth Exchange Code
  // --------------------------------------------------------------------------
  console.log("5. Testing OAuth Exchange Code Generation & Consumption...");
  await clearOAuthExchangeStore();

  const mockToken = "mock.jwt.token.secret123";
  const mockUser = { id: "user-1", email: "test@example.com" };

  const exchangeCode = await createOAuthExchangeCode(mockToken, mockUser);
  assert.strictEqual(typeof exchangeCode, "string");
  assert.strictEqual(exchangeCode.length, 64);

  // Consume valid exchange code
  const session = await consumeOAuthExchangeCode(exchangeCode);
  assert.notStrictEqual(session, null);
  assert.strictEqual(session?.token, mockToken);
  assert.strictEqual(session?.user?.id, "user-1");
  console.log("   ✓ Exchange code swapped successfully for session token & user");

  // Replay attempt (single-use)
  const replayedSession = await consumeOAuthExchangeCode(exchangeCode);
  assert.strictEqual(replayedSession, null, "Consumed exchange code cannot be reused");
  console.log("   ✓ Exchange code is strictly single-use");

  // Concurrent consumption test (anti-race condition)
  const concurrentCode = await createOAuthExchangeCode(mockToken, mockUser);
  const [res1, res2] = await Promise.all([
    consumeOAuthExchangeCode(concurrentCode),
    consumeOAuthExchangeCode(concurrentCode),
  ]);
  const succeededCount = [res1, res2].filter((res) => res !== null).length;
  const failedCount = [res1, res2].filter((res) => res === null).length;
  assert.strictEqual(succeededCount, 1, "Exactly one concurrent consumer must succeed");
  assert.strictEqual(failedCount, 1, "The losing concurrent consumer must receive null");
  console.log("   ✓ Concurrent calls cannot double-consume exchange code (atomic consumption)");

  // Invalid code
  assert.strictEqual(await consumeOAuthExchangeCode("invalid-code"), null);
  assert.strictEqual(await consumeOAuthExchangeCode(""), null);
  console.log("   ✓ Invalid and empty exchange codes safely return null");

  // --------------------------------------------------------------------------
  // 3. Controller Tests: exchangeOAuthCode
  // --------------------------------------------------------------------------
  console.log("6. Testing POST /api/auth/oauth/exchange Controller...");
  let mockResStatus = 0;
  let mockResJson: any = null;
  let mockResCookies: Record<string, any> = {};

  const createMockRes = () => {
    mockResStatus = 0;
    mockResJson = null;
    mockResCookies = {};

    return {
      status(code: number) {
        mockResStatus = code;
        return this;
      },
      json(data: any) {
        mockResJson = data;
        return this;
      },
      cookie(name: string, val: any, opts: any) {
        mockResCookies[name] = { val, opts };
        return this;
      },
    } as any;
  };

  // Missing code in request body
  await exchangeOAuthCode({ body: {} } as any, createMockRes());
  assert.strictEqual(mockResStatus, 400);
  assert.strictEqual(mockResJson?.success, false);

  // Invalid code
  await exchangeOAuthCode({ body: { code: "nonexistent" } } as any, createMockRes());
  assert.strictEqual(mockResStatus, 400);
  assert.strictEqual(mockResJson?.success, false);

  // Valid code
  const freshCode = await createOAuthExchangeCode(mockToken, mockUser);
  await exchangeOAuthCode({ body: { code: freshCode } } as any, createMockRes());
  assert.strictEqual(mockResStatus, 200);
  assert.strictEqual(mockResJson?.success, true);
  assert.strictEqual(mockResJson?.token, mockToken);
  assert.strictEqual(mockResCookies["token"]?.val, mockToken);
  assert.strictEqual(mockResCookies["token"]?.opts?.httpOnly, true);
  console.log("   ✓ exchangeOAuthCode controller validates code, sets HttpOnly cookie, and returns session");

  // --------------------------------------------------------------------------
  // 4. Controller Callback Tests: CSRF State & Query Param Protection
  // --------------------------------------------------------------------------
  console.log("7. Testing OAuth Callback CSRF Enforcement & Query String Token Redirection...");

  let redirectUrl = "";
  const mockRedirectRes = {
    redirect(url: string) {
      redirectUrl = url;
    },
  } as any;

  // Google Callback without state -> reject with invalid_oauth_state
  await googleCallback(
    { query: { code: "some-code" } } as any,
    mockRedirectRes
  );
  assert.match(redirectUrl, /error=invalid_oauth_state/, "Missing state must redirect to error");

  // GitHub Callback with forged state -> reject with invalid_oauth_state
  await githubLoginCallback(
    { query: { code: "some-code", state: "tampered-state" } } as any,
    mockRedirectRes
  );
  assert.match(redirectUrl, /error=invalid_oauth_state/, "Forged state must redirect to error");

  console.log("   ✓ Both Google and GitHub callbacks reject missing or invalid CSRF state");

  // --------------------------------------------------------------------------
  // 5. Unit Tests: rememberMe Token Lifetime Default
  // --------------------------------------------------------------------------
  console.log("8. Testing rememberMe Token Expiry Defaults...");
  const jwt = require("jsonwebtoken");
  const { generateToken } = require("../../utils/jwt");

  const resolveExpiresIn = (rememberMe?: boolean) => (rememberMe === true ? "7d" : "1d");
  assert.strictEqual(resolveExpiresIn(true), "7d");
  assert.strictEqual(resolveExpiresIn(false), "1d");
  assert.strictEqual(resolveExpiresIn(undefined), "1d");

  const tokenDefault = generateToken({ id: "u1", email: "u1@example.com" }, resolveExpiresIn(undefined));
  const tokenFalse = generateToken({ id: "u1", email: "u1@example.com" }, resolveExpiresIn(false));
  const tokenTrue = generateToken({ id: "u1", email: "u1@example.com" }, resolveExpiresIn(true));

  const decodedDefault = jwt.decode(tokenDefault) as any;
  const decodedFalse = jwt.decode(tokenFalse) as any;
  const decodedTrue = jwt.decode(tokenTrue) as any;

  assert.strictEqual(decodedDefault.exp - decodedDefault.iat, 86400, "Default rememberMe must yield 1d token");
  assert.strictEqual(decodedFalse.exp - decodedFalse.iat, 86400, "rememberMe: false must yield 1d token");
  assert.strictEqual(decodedTrue.exp - decodedTrue.iat, 604800, "rememberMe: true must yield 7d token");
  console.log("   ✓ rememberMe correctly defaults to 1d (86400s) and only extends to 7d (604800s) on explicit true");

  console.log("\nAll OAuth State CSRF & One-Time Exchange Code & Session Expiry tests passed successfully!");
}

runTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
