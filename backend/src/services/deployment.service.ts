import fs from "fs";
import path from "path";
import prisma from "../lib/prisma";
import { decryptToken } from "../utils/crypto";
import { sanitizeErrorMessage } from "../utils/sanitizer";
import { SCRATCH_ROOT_DIR } from "../constants/build.constants";
import {
  BuildContext,
  assertWorkspaceBoundary,
  assertDockerfilePath,
  validateRepositoryUrl,
  validateBranchName,
  cloneRepositorySecurely,
  resolveCommitMetadata,
  cleanupWorkspace,
} from "./git.service";

/**
 * Prepares an isolated workspace for a deployment.
 * Phase 1.2 workflow:
 *  1. Ownership & permission validation
 *  2. Resolve & decrypt GitHub token
 *  3. Validate repository URL and branch
 *  4. Transition status: QUEUED -> INITIALIZING
 *  5. Allocate isolated workspace under scratch/builds/<deploymentId>
 *  6. Shallow git clone via child-only GIT_ASKPASS
 *  7. Resolve exact commit SHA & metadata
 *  8. Validate Dockerfile path and symlink boundary
 *  9. Persist commit metadata & imageTag to DB (status remains INITIALIZING)
 *  10. Return BuildContext for Phase 1.3
 *  11. On failure: status -> FAILED, sanitized error, workspace purged
 */
export async function prepareDeploymentWorkspace(
  deploymentId: string,
  authenticatedUserId: string,
  options?: { abortSignal?: AbortSignal }
): Promise<BuildContext> {
  // 1. Ownership & permission check
  const deployment = await prisma.deployment.findFirst({
    where: {
      id: deploymentId,
      project: {
        userId: authenticatedUserId,
      },
    },
    include: {
      project: {
        include: {
          user: {
            include: {
              githubAccount: true,
            },
          },
        },
      },
    },
  });

  if (!deployment) {
    throw new Error("Deployment not found or access denied.");
  }

  const githubAccount = deployment.project.user.githubAccount;
  if (!githubAccount || !githubAccount.accessToken) {
    throw new Error("GitHub account is not connected. Connect GitHub to build projects.");
  }

  // 2. Resolve & decrypt GitHub token into ephemeral memory
  const githubToken = decryptToken(githubAccount.accessToken);

  // 3. Validate repository URL & branch
  const { canonicalUrl } = validateRepositoryUrl(deployment.repositoryUrl);
  await validateBranchName(deployment.branch);

  if (options?.abortSignal?.aborted) {
    throw new Error("Deployment cancelled by user.");
  }

  // 4. Atomic status transition / verification (before creating workspace on disk)
  const claimed = await prisma.deployment.updateMany({
    where: {
      id: deploymentId,
      status: "QUEUED",
    },
    data: {
      status: "INITIALIZING",
      startedAt: new Date(),
      errorMessage: null,
    },
  });

  if (claimed.count === 0) {
    // Deployment was not QUEUED; check if it was already claimed by DeploymentWorker or cancelled/terminal
    const current = await prisma.deployment.findUnique({
      where: { id: deploymentId },
      select: { status: true },
    });

    if (!current) {
      throw new Error("Deployment not found or access denied.");
    }

    if (current.status === "CANCELLED" || options?.abortSignal?.aborted) {
      throw new Error("Deployment cancelled by user.");
    }

    if (current.status !== "INITIALIZING") {
      throw new Error(`Deployment cannot be prepared: current status is ${current.status}.`);
    }
  }

  // 5. Allocate isolated workspace path
  const workspaceDir = path.resolve(SCRATCH_ROOT_DIR, deploymentId);
  assertWorkspaceBoundary(workspaceDir);

  try {
    if (options?.abortSignal?.aborted) {
      throw new Error("Deployment cancelled by user.");
    }

    // Clean if directory already exists from previous attempts
    if (fs.existsSync(workspaceDir)) {
      await cleanupWorkspace(workspaceDir);
    }
    await fs.promises.mkdir(workspaceDir, { recursive: true });

    if (options?.abortSignal?.aborted) {
      throw new Error("Deployment cancelled by user.");
    }

    // 6. Secure shallow clone using child-only GIT_ASKPASS
    const repoDir = await cloneRepositorySecurely({
      workspaceDir,
      canonicalUrl,
      branch: deployment.branch,
      githubToken,
      signal: options?.abortSignal,
    });

    if (options?.abortSignal?.aborted) {
      throw new Error("Deployment cancelled by user.");
    }

    // 7. Resolve exact commit metadata
    const commitMeta = await resolveCommitMetadata(repoDir);

    // 8. Validate Dockerfile path & prevent symlink escape
    const relativeDockerfilePath = deployment.dockerfilePath || "Dockerfile";
    await assertDockerfilePath(repoDir, relativeDockerfilePath);

    // 9. Generate deterministic, collision-resistant imageTag
    const shortSha = commitMeta.commitSha.substring(0, 7);
    const imageTag = `cloudforge/deployment-${deploymentId}:${shortSha}`;

    // 10. Persist metadata to DB (state remains INITIALIZING for Phase 1.3 pickup)
    await prisma.deployment.update({
      where: { id: deploymentId },
      data: {
        commitSha: commitMeta.commitSha,
        commitMsg: commitMeta.commitMsg,
        commitAuthor: commitMeta.commitAuthor,
        imageTag,
      },
    });

    return {
      deploymentId,
      workspaceDir,
      repoDir,
      dockerfilePath: relativeDockerfilePath,
      commitSha: commitMeta.commitSha,
      commitMsg: commitMeta.commitMsg,
      commitAuthor: commitMeta.commitAuthor,
      imageTag,
    };
  } catch (error) {
    // Failure handling: sanitize error, transition to FAILED or CANCELLED, purge workspace
    const sanitizedError = sanitizeErrorMessage(error, githubToken);
    const isCancelled = options?.abortSignal?.aborted || sanitizedError.includes("cancelled by user") || sanitizedError.includes("aborted");

    const current = await prisma.deployment.findUnique({
      where: { id: deploymentId },
      select: { status: true },
    });

    if (current?.status !== "CANCELLED") {
      await prisma.deployment.update({
        where: { id: deploymentId },
        data: {
          status: isCancelled ? "CANCELLED" : "FAILED",
          completedAt: new Date(),
          errorMessage: sanitizedError,
        },
      });
    }

    await cleanupWorkspace(workspaceDir);
    throw new Error(sanitizedError);
  }
}
