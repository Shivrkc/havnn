import assert from "assert";
import path from "path";
import fs from "fs";
import {
  validateRepositoryUrl,
  validateBranchName,
  assertWorkspaceBoundary,
  assertDockerfilePath,
  cleanupWorkspace,
  getSafeGitChildEnv,
} from "../git.service";
import { sanitizeLogOutput, sanitizeErrorMessage } from "../../utils/sanitizer";
import { SCRATCH_ROOT_DIR } from "../../constants/build.constants";

async function runTests() {
  console.log("Starting Phase 1.2 Git Isolation & Security Tests...\n");

  // 1. Repository URL validation
  console.log("1. Testing repository URL validation...");
  assert.throws(() => validateRepositoryUrl("http://github.com/owner/repo"), /Invalid GitHub repository URL/);
  assert.throws(() => validateRepositoryUrl("git@github.com:owner/repo.git"), /Invalid GitHub repository URL/);
  assert.throws(() => validateRepositoryUrl("https://evil.com/owner/repo"), /Invalid GitHub repository URL/);
  assert.throws(() => validateRepositoryUrl("https://user:token@github.com/owner/repo"), /Invalid GitHub repository URL/);
  
  const validUrl = validateRepositoryUrl("https://github.com/Shivrkc/cloudforge");
  assert.strictEqual(validUrl.owner, "Shivrkc");
  assert.strictEqual(validUrl.repo, "cloudforge");
  assert.strictEqual(validUrl.canonicalUrl, "https://github.com/Shivrkc/cloudforge.git");
  console.log("   ✓ Repository URL validation passed");

  // 2. Branch validation
  console.log("2. Testing branch name validation...");
  await assert.rejects(async () => validateBranchName("-bad-flag"), /Branch name cannot start with a hyphen/);
  await assert.rejects(async () => validateBranchName("../traversal"), /illegal or dangerous/);
  await assert.rejects(async () => validateBranchName("bad branch with spaces"), /illegal or dangerous/);
  await assert.rejects(async () => validateBranchName("bad;command"), /illegal or dangerous/);

  // Authoritative check on valid branches
  await validateBranchName("main");
  await validateBranchName("feature/phase-1.2");
  await validateBranchName("v1.0.0");
  console.log("   ✓ Branch validation passed");

  // 3. Workspace boundary assert
  console.log("3. Testing workspace boundary enforcement...");
  const validWorkspace = path.resolve(SCRATCH_ROOT_DIR, "cm12345678");
  assert.doesNotThrow(() => assertWorkspaceBoundary(validWorkspace));

  const escapingWorkspace = path.resolve(SCRATCH_ROOT_DIR, "..", "escaped");
  assert.throws(() => assertWorkspaceBoundary(escapingWorkspace), /Workspace path escapes/);

  const directRoot = path.resolve(SCRATCH_ROOT_DIR);
  assert.throws(() => assertWorkspaceBoundary(directRoot), /Workspace path escapes/);
  console.log("   ✓ Workspace boundary checks passed");

  // 4. Dockerfile path & symlink escape checks
  console.log("4. Testing Dockerfile path validation...");
  const testWorkspace = path.resolve(SCRATCH_ROOT_DIR, "test-workspace-check");
  const testRepoDir = path.join(testWorkspace, "repo");
  await fs.promises.mkdir(testRepoDir, { recursive: true });

  const testDockerfilePath = path.join(testRepoDir, "Dockerfile");
  await fs.promises.writeFile(testDockerfilePath, "FROM node:18\n");

  // Valid Dockerfile
  const resolved = await assertDockerfilePath(testRepoDir, "Dockerfile");
  assert.strictEqual(resolved, testDockerfilePath);

  // Traversal attempts
  await assert.rejects(
    async () => assertDockerfilePath(testRepoDir, "../../Dockerfile"),
    /Security violation: Dockerfile path escapes repository/
  );

  // Missing Dockerfile
  await assert.rejects(
    async () => assertDockerfilePath(testRepoDir, "nonexistent.Dockerfile"),
    /Dockerfile not found/
  );

  // Cleanup test workspace
  await cleanupWorkspace(testWorkspace);
  assert.strictEqual(fs.existsSync(testWorkspace), false);
  console.log("   ✓ Dockerfile path validation & cleanup passed");

  // 5. Sanitizer token & path redaction
  console.log("5. Testing error & log sanitization...");
  const secretToken = "ghp_1234567890abcdefghijklmnopqrstuvwxyz";
  const rawLog = `fatal: could not read Username for 'https://${secretToken}@github.com': No such device or address at C:\\Users\\Administrator\\AppData\\Local\\Temp`;
  const sanitized = sanitizeLogOutput(rawLog, secretToken);

  assert.strictEqual(sanitized.includes(secretToken), false, "Token must be redacted");
  assert.strictEqual(sanitized.includes("C:\\Users\\"), false, "Absolute Windows paths must be redacted");
  assert.strictEqual(sanitized.includes("[REDACTED_TOKEN]"), true);
  assert.strictEqual(sanitized.includes("[WORKSPACE_PATH]"), true);

  const errorMsg = sanitizeErrorMessage("fatal: Remote branch feature-x not found in upstream origin");
  assert.strictEqual(errorMsg, "The requested branch was not found in the remote repository.");
  console.log("   ✓ Error & log sanitization passed");

  // 6. Git child-process environment isolation (CodeRabbit Finding #1)
  console.log("6. Testing Git child-process environment isolation...");
  // Inject mock backend secrets into parent process.env
  const originalEnv = { ...process.env };
  try {
    process.env.DATABASE_URL = "postgresql://user:secretpass@localhost:5432/cloudforge";
    process.env.JWT_SECRET = "super-secret-jwt-key-never-leak";
    process.env.ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef";
    process.env.GOOGLE_CLIENT_SECRET = "google-secret-xyz";
    process.env.GITHUB_CLIENT_SECRET = "github-secret-abc";

    const childEnv = getSafeGitChildEnv({
      GIT_TERMINAL_PROMPT: "0",
      GIT_ASKPASS: "C:\\mock\\askpass.bat",
      CLOUDFORGE_GIT_TOKEN: "mock-gh-token",
    });

    // Verify backend secrets are NOT inherited
    assert.strictEqual(childEnv.DATABASE_URL, undefined, "DATABASE_URL must not be present in Git child env");
    assert.strictEqual(childEnv.JWT_SECRET, undefined, "JWT_SECRET must not be present in Git child env");
    assert.strictEqual(childEnv.ENCRYPTION_KEY, undefined, "ENCRYPTION_KEY must not be present in Git child env");
    assert.strictEqual(childEnv.GOOGLE_CLIENT_SECRET, undefined, "GOOGLE_CLIENT_SECRET must not be present in Git child env");
    assert.strictEqual(childEnv.GITHUB_CLIENT_SECRET, undefined, "GITHUB_CLIENT_SECRET must not be present in Git child env");

    // Verify required Git and askpass variables ARE present
    assert.strictEqual(childEnv.GIT_TERMINAL_PROMPT, "0");
    assert.strictEqual(childEnv.GIT_ASKPASS, "C:\\mock\\askpass.bat");
    assert.strictEqual(childEnv.CLOUDFORGE_GIT_TOKEN, "mock-gh-token");

    // Verify essential OS environment variables are preserved
    const hasPath = childEnv.PATH !== undefined || childEnv.Path !== undefined;
    assert.strictEqual(hasPath, true, "PATH/Path must be preserved for Git execution");
    if (process.platform === "win32") {
      const hasSystemRoot = childEnv.SystemRoot !== undefined || childEnv.SYSTEMROOT !== undefined;
      assert.strictEqual(hasSystemRoot, true, "SystemRoot must be preserved on Windows");
    }
  } finally {
    process.env = originalEnv;
  }
  console.log("   ✓ Git child-process environment isolation passed");

  console.log("\nAll Phase 1.2 Git isolation tests passed successfully!");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
