import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import {
  SCRATCH_ROOT_DIR,
  GIT_CLONE_TIMEOUT_MS,
  GIT_DEFAULT_TIMEOUT_MS,
  GITHUB_REPO_URL_REGEX,
  BRANCH_DANGEROUS_CHARS_REGEX,
} from "../constants/build.constants";
import { sanitizeErrorMessage, sanitizeLogOutput } from "../utils/sanitizer";

export interface CommitMetadata {
  commitSha: string;
  commitMsg: string;
  commitAuthor: string;
}

export interface BuildContext {
  deploymentId: string;
  workspaceDir: string;
  repoDir: string;
  dockerfilePath: string;
  commitSha: string;
  commitMsg: string;
  commitAuthor: string;
  imageTag: string;
}

/**
 * Validates that the workspace directory is strictly contained within SCRATCH_ROOT_DIR.
 * Uses path.relative() to prevent directory traversal or outside escapes.
 */
export function assertWorkspaceBoundary(workspaceDir: string): void {
  const normalizedRoot = path.resolve(SCRATCH_ROOT_DIR);
  const normalizedTarget = path.resolve(workspaceDir);
  const relative = path.relative(normalizedRoot, normalizedTarget);

  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Security violation: Workspace path escapes configured scratch directory.");
  }
}

/**
 * Validates that the target Dockerfile path is strictly contained within repoDir.
 * Also asserts that the file exists, is a regular file, and is not a symlink targeting outside repoDir.
 */
export async function assertDockerfilePath(repoDir: string, relativeDockerfilePath: string): Promise<string> {
  const normalizedRepo = path.resolve(repoDir);
  const resolvedTarget = path.resolve(normalizedRepo, relativeDockerfilePath);
  const relative = path.relative(normalizedRepo, resolvedTarget);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Security violation: Dockerfile path escapes repository directory.");
  }

  let stat: fs.Stats;
  try {
    stat = await fs.promises.stat(resolvedTarget);
  } catch {
    throw new Error(`Dockerfile not found at relative path: ${relativeDockerfilePath}`);
  }

  if (!stat.isFile()) {
    throw new Error(`Target Dockerfile is not a regular file: ${relativeDockerfilePath}`);
  }

  // Check realpath to prevent symlinks targeting outside repoDir
  const realPath = await fs.promises.realpath(resolvedTarget);
  const realRelative = path.relative(normalizedRepo, realPath);

  if (realRelative.startsWith("..") || path.isAbsolute(realRelative)) {
    throw new Error("Security violation: Dockerfile symlink targets a location outside repository directory.");
  }

  return resolvedTarget;
}

/**
 * Validates a GitHub repository URL against strict canonical patterns.
 * Disallows embedded credentials, arbitrary protocols, and arbitrary hosts.
 */
export function validateRepositoryUrl(url: string): { owner: string; repo: string; canonicalUrl: string } {
  if (!url || typeof url !== "string") {
    throw new Error("Repository URL is required.");
  }

  const trimmed = url.trim();
  const match = trimmed.match(GITHUB_REPO_URL_REGEX);

  if (!match) {
    throw new Error("Invalid GitHub repository URL format. Must be https://github.com/owner/repo");
  }

  const owner = match[1];
  const repo = match[2];
  const canonicalUrl = `https://github.com/${owner}/${repo}.git`;

  return { owner, repo, canonicalUrl };
}

/**
 * Environment variable allowlist for Git child processes.
 * Strictly prevents backend secrets (e.g., DATABASE_URL, JWT_SECRET, ENCRYPTION_KEY)
 * from being inherited by Git or askpass subprocesses.
 */
const SAFE_GIT_ENV_ALLOWLIST = new Set([
  // Core path and executable resolution
  "PATH",
  "Path",
  "PATHEXT",
  // Windows OS environment essentials
  "SYSTEMROOT",
  "SystemRoot",
  "SYSTEMDRIVE",
  "SystemDrive",
  "COMSPEC",
  "ComSpec",
  "WINDIR",
  "windir",
  "ALLUSERSPROFILE",
  "ProgramData",
  "PROGRAMFILES",
  "ProgramFiles",
  "PROGRAMFILES(X86)",
  "ProgramFiles(x86)",
  "COMMONPROGRAMFILES",
  "CommonProgramFiles",
  // Temporary directories
  "TEMP",
  "TMP",
  "TMPDIR",
  // User home and profile directories (needed by Git and SSH/GPG tools)
  "HOME",
  "USERPROFILE",
  "HOMEDRIVE",
  "HOMEPATH",
  // Localization and system settings
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "LC_MESSAGES",
  "TZ",
]);

/**
 * Builds a restricted environment object containing only allowlisted platform variables
 * and explicitly passed Git configuration variables.
 */
export function getSafeGitChildEnv(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  const safeEnv: NodeJS.ProcessEnv = {};

  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && SAFE_GIT_ENV_ALLOWLIST.has(key)) {
      safeEnv[key] = value;
    }
  }

  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined) {
      safeEnv[key] = value;
    }
  }

  return safeEnv;
}

/**
 * Executes a Git command with discrete argument arrays, shell disabled, and timeout.
 */
function runGitProcess(
  args: string[],
  options: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    timeoutMs?: number;
    tokenToRedact?: string;
    signal?: AbortSignal;
  } = {}
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) {
      reject(new Error("Git command aborted by user."));
      return;
    }

    const timeoutMs = options.timeoutMs ?? GIT_DEFAULT_TIMEOUT_MS;
    let stdout = "";
    let stderr = "";
    let isSettled = false;

    const child = spawn("git", args, {
      cwd: options.cwd,
      env: options.env ?? getSafeGitChildEnv(),
      shell: false,
      windowsHide: true,
    });

    if (options.signal) {
      options.signal.addEventListener("abort", () => {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timer);
          try {
            child.kill("SIGKILL");
          } catch {
            // ignore kill errors
          }
          reject(new Error("Git command aborted by user."));
        }
      });
    }

    const timer = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        try {
          child.kill("SIGKILL");
        } catch {
          // ignore kill errors
        }
        reject(new Error(`Git command timed out after ${Math.round(timeoutMs / 1000)} seconds.`));
      }
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (err) => {
      if (!isSettled) {
        isSettled = true;
        clearTimeout(timer);
        reject(new Error(`Failed to spawn git: ${sanitizeErrorMessage(err, options.tokenToRedact)}`));
      }
    });

    child.on("close", (code) => {
      if (!isSettled) {
        isSettled = true;
        clearTimeout(timer);
        resolve({
          stdout,
          stderr,
          exitCode: code ?? -1,
        });
      }
    });
  });
}

/**
 * Validates a branch name using safety pre-filtering followed by git check-ref-format.
 */
export async function validateBranchName(branch: string): Promise<void> {
  if (!branch || typeof branch !== "string") {
    throw new Error("Branch name is required.");
  }

  const trimmed = branch.trim();

  // 1. Safety pre-filtering
  if (trimmed.length === 0 || trimmed.length > 255) {
    throw new Error("Invalid branch name length.");
  }
  if (trimmed.startsWith("-")) {
    throw new Error("Branch name cannot start with a hyphen.");
  }
  if (BRANCH_DANGEROUS_CHARS_REGEX.test(trimmed)) {
    throw new Error("Branch name contains illegal or dangerous characters.");
  }

  // 2. Authoritative check via git check-ref-format --branch <branch>
  const result = await runGitProcess(["check-ref-format", "--branch", trimmed]);

  if (result.exitCode !== 0) {
    throw new Error(`Invalid branch format according to Git ref specifications: "${trimmed}"`);
  }
}

/**
 * Creates an ephemeral Node-based askpass helper script in the workspace directory.
 * The script does NOT contain credentials. It only reads process.env.CLOUDFORGE_GIT_TOKEN at runtime.
 */
async function createAskpassHelper(workspaceDir: string): Promise<string> {
  const askpassPath = path.join(workspaceDir, "askpass.js");

  // Minimal script: when Git asks for password, return token; when asking for username, return x-access-token.
  const scriptContent = `// Ephemeral CloudForge Git Askpass Helper
const prompt = process.argv[2] || '';
if (/username/i.test(prompt)) {
  process.stdout.write('x-access-token\\n');
} else {
  const token = process.env.CLOUDFORGE_GIT_TOKEN || '';
  process.stdout.write(token + '\\n');
}
`;

  await fs.promises.writeFile(askpassPath, scriptContent, {
    mode: 0o700,
    encoding: "utf8",
  });

  return askpassPath;
}

/**
 * Clones a repository safely into an isolated workspace using GIT_ASKPASS.
 * Verified exit code === 0, shallow clone depth 1, child-only environment.
 */
export async function cloneRepositorySecurely(options: {
  workspaceDir: string;
  canonicalUrl: string;
  branch: string;
  githubToken: string;
  signal?: AbortSignal;
}): Promise<string> {
  const { workspaceDir, canonicalUrl, branch, githubToken, signal } = options;

  assertWorkspaceBoundary(workspaceDir);

  const repoDir = path.join(workspaceDir, "repo");

  // Create ephemeral askpass helper inside workspace
  const askpassScriptPath = await createAskpassHelper(workspaceDir);

  // Construct child-only environment with allowlisted system variables and Git tokens
  const childEnv = getSafeGitChildEnv({
    GIT_TERMINAL_PROMPT: "0",
    GIT_ASKPASS: process.execPath, // Path to current node executable
    GIT_ASKPASS_SCRIPT: askpassScriptPath,
    CLOUDFORGE_GIT_TOKEN: githubToken,
  });

  // Run a wrapper askpass caller script so git executes node askpass.js
  const runnerScriptPath = path.join(workspaceDir, "askpass-runner.bat");
  if (process.platform === "win32") {
    // Windows batch helper to invoke node askpass.js
    await fs.promises.writeFile(
      runnerScriptPath,
      `@"${process.execPath}" "${askpassScriptPath}" %*`,
      { mode: 0o700, encoding: "utf8" }
    );
    childEnv.GIT_ASKPASS = runnerScriptPath;
  } else {
    // Unix shell helper
    const unixRunner = path.join(workspaceDir, "askpass-runner.sh");
    await fs.promises.writeFile(
      unixRunner,
      `#!/bin/sh\nexec "${process.execPath}" "${askpassScriptPath}" "$@"`,
      { mode: 0o700, encoding: "utf8" }
    );
    childEnv.GIT_ASKPASS = unixRunner;
  }

  const gitArgs = [
    "clone",
    "--depth", "1",
    "--branch", branch,
    "--single-branch",
    canonicalUrl,
    repoDir,
  ];

  const result = await runGitProcess(gitArgs, {
    cwd: workspaceDir,
    env: childEnv,
    timeoutMs: GIT_CLONE_TIMEOUT_MS,
    tokenToRedact: githubToken,
    signal,
  });

  if (result.exitCode !== 0) {
    const sanitizedError = sanitizeErrorMessage(result.stderr, githubToken);
    throw new Error(`Git clone failed with exit code ${result.exitCode}: ${sanitizedError}`);
  }

  return repoDir;
}

/**
 * Extracts and sanitizes commit metadata from a cloned repository.
 */
export async function resolveCommitMetadata(repoDir: string): Promise<CommitMetadata> {
  // 1. Get exact commit SHA
  const shaResult = await runGitProcess(["rev-parse", "HEAD"], { cwd: repoDir });
  if (shaResult.exitCode !== 0) {
    throw new Error("Failed to resolve commit SHA from cloned repository.");
  }
  const commitSha = shaResult.stdout.trim();
  if (!/^[0-9a-f]{40}$/i.test(commitSha)) {
    throw new Error(`Invalid commit SHA format resolved: ${commitSha}`);
  }

  // 2. Get commit message and author
  const metaResult = await runGitProcess(["log", "-1", "--format=%s%x1f%an <%ae>"], { cwd: repoDir });
  let commitMsg = "Commit";
  let commitAuthor = "Unknown";

  if (metaResult.exitCode === 0 && metaResult.stdout.includes("\x1f")) {
    const parts = metaResult.stdout.trim().split("\x1f");
    commitMsg = (parts[0] || "Commit").substring(0, 255);
    commitAuthor = (parts[1] || "Unknown").substring(0, 100);
  }

  return {
    commitSha,
    commitMsg: sanitizeLogOutput(commitMsg),
    commitAuthor: sanitizeLogOutput(commitAuthor),
  };
}

/**
 * Safely removes an isolated workspace directory.
 * Path boundary check is enforced prior to deletion.
 */
export async function cleanupWorkspace(workspaceDir: string): Promise<void> {
  try {
    assertWorkspaceBoundary(workspaceDir);
    await fs.promises.rm(workspaceDir, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 200,
    });
  } catch (err) {
    console.error(`Failed to clean up workspace ${workspaceDir}:`, err);
  }
}
