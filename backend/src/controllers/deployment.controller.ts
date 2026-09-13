import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import prisma from "../lib/prisma";
import { deploymentWorker, syncProjectStatus } from "../services/deployment.worker";
import { validateBranchName, validateRepositoryUrl } from "../services/git.service";
import { LogStream } from "@prisma/client";

/**
 * POST /api/projects/:projectId/deployments
 * Triggers a new deployment. Enforces project ownership, GitHub connection,
 * and a race-safe queue limit (max 1 active + 1 queued) via a row-level lock on Project.
 */
export const createDeployment = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const projectId = Array.isArray(req.params.projectId)
      ? req.params.projectId[0]
      : req.params.projectId;

    const { branch: customBranch, dockerfilePath: customDockerfilePath } = req.body || {};

    // 1. Verify GitHub account connection
    const githubAccount = await prisma.githubAccount.findUnique({
      where: { userId },
    });

    if (!githubAccount || !githubAccount.accessToken) {
      return res.status(400).json({
        success: false,
        message: "GitHub account is not connected. Please connect your GitHub account to deploy.",
      });
    }

    // 2. Transaction with row-level lock on Project to serialize queue-limit enforcement
    let deployment;
    try {
      deployment = await prisma.$transaction(async (tx) => {
        // Exclusively lock Project row
        const projects = await tx.$queryRaw<
          Array<{ id: string; repositoryName: string | null; repositoryUrl: string | null; branch: string | null }>
        >`
          SELECT "id", "repositoryName", "repositoryUrl", "branch"
          FROM "Project"
          WHERE "id" = ${projectId} AND "userId" = ${userId}
          FOR UPDATE;
        `;

        if (!projects || projects.length === 0) {
          throw { status: 404, message: "Project not found or access denied." };
        }

        const project = projects[0];

        if (!project.repositoryUrl) {
          throw { status: 400, message: "Project does not have a configured repository URL." };
        }

        // Validate repository URL syntax
        try {
          validateRepositoryUrl(project.repositoryUrl);
        } catch (urlErr: any) {
          throw { status: 400, message: urlErr.message || "Invalid repository URL." };
        }

        // Count non-terminal deployments under the lock
        const activeCountResult = await tx.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*)::bigint as count
          FROM "Deployment"
          WHERE "projectId" = ${projectId}
            AND "status" IN ('QUEUED'::"DeploymentStatus", 'INITIALIZING'::"DeploymentStatus", 'BUILDING'::"DeploymentStatus");
        `;

        const activeCount = Number(activeCountResult[0]?.count ?? 0);

        if (activeCount >= 2) {
          throw {
            status: 409,
            message: "Project queue limit reached. Maximum 1 active build and 1 queued build permitted.",
          };
        }

        // Sanitize branch
        const targetBranch =
          typeof customBranch === "string" && customBranch.trim()
            ? customBranch.trim()
            : project.branch || "main";

        await validateBranchName(targetBranch);

        // Sanitize dockerfilePath
        let targetDockerfilePath = "Dockerfile";
        if (typeof customDockerfilePath === "string" && customDockerfilePath.trim()) {
          const trimmed = customDockerfilePath.trim();
          if (trimmed.includes("..") || trimmed.startsWith("/") || trimmed.startsWith("\\")) {
            throw { status: 400, message: "Invalid Dockerfile path: directory traversal is prohibited." };
          }
          targetDockerfilePath = trimmed;
        }

        // Create initial QUEUED deployment
        const newDep = await tx.deployment.create({
          data: {
            projectId,
            status: "QUEUED",
            repositoryName: project.repositoryName || "repository",
            repositoryUrl: project.repositoryUrl,
            branch: targetBranch,
            dockerfilePath: targetDockerfilePath,
            logs: {
              create: {
                line: "[SYSTEM] Deployment queued by user.",
                stream: LogStream.SYSTEM,
                sequence: 1,
              },
            },
          },
        });

        // Conditionally update Project.status using newest-only invariant
        await tx.project.updateMany({
          where: {
            id: projectId,
            deployments: {
              none: {
                createdAt: { gt: newDep.createdAt },
              },
            },
          },
          data: {
            status: "queued",
          },
        });

        return newDep;
      });
    } catch (txError: any) {
      if (txError.status) {
        return res.status(txError.status).json({ success: false, message: txError.message });
      }
      throw txError;
    }

    // 3. Immediately notify background worker
    deploymentWorker.notify();

    // 4. Return HTTP 201 Created without blocking
    return res.status(201).json({
      success: true,
      message: "Deployment queued successfully.",
      deployment,
    });
  } catch (error: any) {
    console.error("Error creating deployment:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create deployment.",
    });
  }
};

/**
 * GET /api/projects/:projectId/deployments
 * Lists all deployments for a project, sorted newest first.
 */
export const getProjectDeployments = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const projectId = Array.isArray(req.params.projectId)
      ? req.params.projectId[0]
      : req.params.projectId;

    // Verify project ownership
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId },
      select: { id: true },
    });

    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found or access denied." });
    }

    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 10));
    const skip = (page - 1) * limit;

    const [total, deployments] = await Promise.all([
      prisma.deployment.count({ where: { projectId } }),
      prisma.deployment.findMany({
        where: { projectId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          projectId: true,
          status: true,
          repositoryName: true,
          repositoryUrl: true,
          branch: true,
          commitSha: true,
          commitMsg: true,
          commitAuthor: true,
          imageTag: true,
          dockerfilePath: true,
          startedAt: true,
          completedAt: true,
          durationMs: true,
          exitCode: true,
          errorMessage: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    return res.status(200).json({
      success: true,
      deployments,
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error("Error fetching project deployments:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch deployments." });
  }
};

/**
 * GET /api/deployments/:deploymentId
 * Fetches status and metadata for a specific deployment.
 */
export const getDeploymentById = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const deploymentId = Array.isArray(req.params.deploymentId)
      ? req.params.deploymentId[0]
      : req.params.deploymentId;

    const deployment = await prisma.deployment.findFirst({
      where: {
        id: deploymentId,
        project: { userId },
      },
      select: {
        id: true,
        projectId: true,
        status: true,
        repositoryName: true,
        repositoryUrl: true,
        branch: true,
        commitSha: true,
        commitMsg: true,
        commitAuthor: true,
        imageTag: true,
        dockerfilePath: true,
        startedAt: true,
        completedAt: true,
        durationMs: true,
        exitCode: true,
        errorMessage: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!deployment) {
      return res.status(404).json({ success: false, message: "Deployment not found or access denied." });
    }

    return res.status(200).json({
      success: true,
      deployment,
    });
  } catch (error) {
    console.error("Error fetching deployment:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch deployment." });
  }
};

/**
 * GET /api/deployments/:deploymentId/logs?afterSequence=N
 * Fetches build logs for polling.
 */
export const getDeploymentLogs = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const deploymentId = Array.isArray(req.params.deploymentId)
      ? req.params.deploymentId[0]
      : req.params.deploymentId;

    const deployment = await prisma.deployment.findFirst({
      where: {
        id: deploymentId,
        project: { userId },
      },
      select: { id: true, status: true },
    });

    if (!deployment) {
      return res.status(404).json({ success: false, message: "Deployment not found or access denied." });
    }

    const afterSequence = Math.max(0, parseInt(req.query.afterSequence as string, 10) || 0);
    const limit = Math.min(1000, Math.max(1, parseInt(req.query.limit as string, 10) || 200));

    const logs = await prisma.buildLog.findMany({
      where: {
        deploymentId,
        sequence: { gt: afterSequence },
      },
      orderBy: { sequence: "asc" },
      take: limit,
    });

    const isTerminal = ["BUILT", "FAILED", "CANCELLED"].includes(deployment.status);

    return res.status(200).json({
      success: true,
      logs,
      currentStatus: deployment.status,
      isTerminal,
    });
  } catch (error) {
    console.error("Error fetching deployment logs:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch deployment logs." });
  }
};

/**
 * GET /api/deployments/:deploymentId/logs/raw
 * Fetches all build logs as formatted plain text for raw download/export.
 */
export const getDeploymentRawLogs = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const deploymentId = Array.isArray(req.params.deploymentId)
      ? req.params.deploymentId[0]
      : req.params.deploymentId;

    const deployment = await prisma.deployment.findFirst({
      where: {
        id: deploymentId,
        project: { userId },
      },
      select: { id: true, repositoryName: true, branch: true, status: true },
    });

    if (!deployment) {
      return res.status(404).json({ success: false, message: "Deployment not found or access denied." });
    }

    const logs = await prisma.buildLog.findMany({
      where: { deploymentId },
      orderBy: { sequence: "asc" },
    });

    const lines = logs.map(
      (l) => `[${l.timestamp.toISOString()}] [${l.stream}] [${l.sequence}] ${l.line}`
    );
    const rawContent = lines.join("\n") + (lines.length > 0 ? "\n" : "");

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="deployment-${deploymentId.substring(0, 8)}.log"`
    );
    return res.status(200).send(rawContent);
  } catch (error) {
    console.error("Error fetching raw deployment logs:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch raw deployment logs." });
  }
};

/**
 * POST /api/deployments/:deploymentId/cancel
 * Cancels a queued or active deployment.
 */
export const cancelDeployment = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const deploymentId = Array.isArray(req.params.deploymentId)
      ? req.params.deploymentId[0]
      : req.params.deploymentId;

    const result = await deploymentWorker.cancelDeployment(deploymentId, userId);

    if (result.notFound) {
      return res.status(404).json({ success: false, message: "Deployment not found or access denied." });
    }

    if (result.isTerminal) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel deployment in terminal state: ${result.status}.`,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Deployment cancelled successfully.",
      deployment: result.deployment,
    });
  } catch (error) {
    console.error("Error cancelling deployment:", error);
    return res.status(500).json({ success: false, message: "Failed to cancel deployment." });
  }
};
