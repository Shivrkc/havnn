import path from "path";

/**
 * Root directory for isolated build workspaces.
 * Placed in backend/scratch/builds.
 */
export const SCRATCH_ROOT_DIR = path.resolve(process.cwd(), "scratch", "builds");

/**
 * Hard timeout for git clone operations (120 seconds).
 */
export const GIT_CLONE_TIMEOUT_MS = 120_000;

/**
 * Generic git command timeout for lightweight operations like rev-parse / check-ref-format.
 */
export const GIT_DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Strict GitHub repository URL regex.
 * Disallows embedded credentials, arbitrary protocols, and arbitrary hosts.
 * Example: https://github.com/owner/repo or https://github.com/owner/repo.git
 */
export const GITHUB_REPO_URL_REGEX = /^https:\/\/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(\.git)?$/;

/**
 * Prohibited characters and patterns in branch names for safety pre-filtering.
 * Includes whitespace, null bytes, ASCII control characters, and Git ref metacharacters.
 */
export const BRANCH_DANGEROUS_CHARS_REGEX = /[\s\x00-\x1F\x7F~^:?*\[\\@;&|`$"'<>(){}]|\.\.|\/\//;

/**
 * Hard timeout for Docker build operations (10 minutes).
 */
export const DOCKER_BUILD_TIMEOUT_MS = 600_000;

/**
 * Short timeout for checking Docker daemon availability (5 seconds).
 */
export const DOCKER_DAEMON_CHECK_TIMEOUT_MS = 5_000;

/**
 * Maximum permitted Docker image size (2 GB).
 */
export const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024 * 1024;

/**
 * Hard timeout for docker inspect image size checks (15 seconds).
 */
export const DOCKER_INSPECT_TIMEOUT_MS = 15_000;

/**
 * Hard timeout for docker rmi removal operations (15 seconds).
 */
export const DOCKER_RMI_TIMEOUT_MS = 15_000;

/**
 * Default internal application HTTP port fallback.
 */
export const DEFAULT_INTERNAL_PORT = 3000;

/**
 * Hard timeout for container startup readiness checks (30 seconds).
 */
export const READINESS_TIMEOUT_MS = 30_000;

/**
 * Interval between successive HTTP readiness probes (1 second).
 */
export const READINESS_INTERVAL_MS = 1_000;

/**
 * Container resource limits for local PoC isolation.
 */
export const CONTAINER_CPU_LIMIT = "1.0";
export const CONTAINER_MEMORY_LIMIT = "512m";
export const CONTAINER_MEMORY_SWAP_LIMIT = "512m";
export const CONTAINER_PIDS_LIMIT = 100;

/**
 * Timeout for graceful container termination before force killing (10 seconds).
 */
export const CONTAINER_STOP_TIMEOUT_SECS = 10;

/**
 * Interval for background runtime liveness reconciliation (15 seconds).
 */
export const RUNTIME_RECONCILE_INTERVAL_MS = 15_000;

/**
 * Lease threshold for reclaiming crashed container startup operations (30 seconds).
 */
export const STALE_STARTUP_LEASE_THRESHOLD_SECONDS = 30;

/**
 * Lease threshold for reclaiming full build operations (120 seconds).
 */
export const STALE_BUILD_LEASE_THRESHOLD_SECONDS = 120;

/**
 * TTL for distributed database reconciler coordination lock (30 seconds).
 */
export const RECONCILER_LOCK_TTL_MS = 30_000;
