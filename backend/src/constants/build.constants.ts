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
