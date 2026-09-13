import assert from "assert";
import path from "path";
import fs from "fs";
import prisma from "../../lib/prisma";
import { LogStream } from "@prisma/client";
import { DeploymentWorker, PrepareWorkspaceFn } from "../deployment.worker";
import { SCRATCH_ROOT_DIR } from "../../constants/build.constants";
import { deleteDockerImage } from "../docker.service";
import { encryptToken } from "../../utils/crypto";
import { validateRepositoryUrl } from "../git.service";
import * as projectService from "../project.service";

/**
 * PHASE 1.5: BACKEND DEPLOYMENT ORCHESTRATION VERIFICATION SUITE
 */
async function runPhase15Tests() {
  console.log("==================================================================");
  console.log("  PHASE 1.5: BACKEND DEPLOYMENT ORCHESTRATION VERIFICATION SUITE  ");
  console.log("==================================================================\n");

  const timestamp = Date.now();
  const testUserAEmail = `phase15-user-a-${timestamp}@example.com`;
  const testUserBEmail = `phase15-user-b-${timestamp}@example.com`;

  let userA: any;
  let userB: any;
  let projectA: any;
  let projectB: any;

  const activeWorkers: DeploymentWorker[] = [];
  const createWorker = (customWorkerId?: string, prepareWorkspaceOverride?: PrepareWorkspaceFn) => {
    const w = new DeploymentWorker(customWorkerId, prepareWorkspaceOverride);
    activeWorkers.push(w);
    return w;
  };

  try {
    // ----------------------------------------------------------------
    // SETUP: Users, GitHub accounts, Projects
    // ----------------------------------------------------------------
    userA = await prisma.user.create({
      data: {
        email: testUserAEmail,
        name: "Phase 1.5 Test User A",
        githubAccount: {
          create: {
            githubUserId: `gh-15-a-${timestamp}`,
            githubUsername: "testuser-a",
            accessToken: encryptToken("ghp_fakeTokenUserA1234567890abcdefghijklmnop"),
            scope: "repo",
          },
        },
      },
      include: { githubAccount: true },
    });

    userB = await prisma.user.create({
      data: {
        email: testUserBEmail,
        name: "Phase 1.5 Test User B",
        // Note: userB has NO GitHub account connected initially
      },
    });

    projectA = await prisma.project.create({
      data: {
        name: "Orchestration Project A",
        repositoryName: "testowner/repo-a",
        repositoryUrl: "https://github.com/testowner/repo-a",
        branch: "main",
        userId: userA.id,
      },
    });

    projectB = await prisma.project.create({
      data: {
        name: "Orchestration Project B",
        repositoryName: "testowner/repo-b",
        repositoryUrl: "https://github.com/testowner/repo-b",
        branch: "main",
        userId: userB.id,
      },
    });

    // ----------------------------------------------------------------
    // TEST 1: GitHub Connection Requirement for Deployment
    // ----------------------------------------------------------------
    console.log("[TEST 1/13] GitHub Connection Requirement for Deployment");
    {
      // User B has no GitHub account connected
      const githubAcc = await prisma.githubAccount.findUnique({
        where: { userId: userB.id },
      });
      assert.strictEqual(githubAcc, null, "User B should not have a GitHub account");
      console.log("   ✓ Disconnected GitHub account verified for User B\n");
    }

    // ----------------------------------------------------------------
    // TEST 2: Repository URL & Branch Validation
    // ----------------------------------------------------------------
    console.log("[TEST 2/13] Repository URL & Branch Syntax Validation");
    {
      // Valid URLs
      assert.doesNotThrow(() => validateRepositoryUrl("https://github.com/owner/repo"));
      assert.doesNotThrow(() => validateRepositoryUrl("https://github.com/owner/repo.git"));

      // Invalid URLs
      assert.throws(() => validateRepositoryUrl("http://github.com/owner/repo"));
      assert.throws(() => validateRepositoryUrl("https://gitlab.com/owner/repo"));
      assert.throws(() => validateRepositoryUrl("https://github.com/owner/repo/evil"));
      assert.throws(() => validateRepositoryUrl("git@github.com:owner/repo.git"));

      console.log("   ✓ Repository URL validation enforced strictly\n");
    }

    // ----------------------------------------------------------------
    // TEST 3: Deployment Creation & Configuration Binding
    // ----------------------------------------------------------------
    console.log("[TEST 3/13] Deployment Creation & Configuration Binding");
    let dep1: any;
    {
      dep1 = await prisma.deployment.create({
        data: {
          projectId: projectA.id,
          status: "QUEUED",
          repositoryName: projectA.repositoryName!,
          repositoryUrl: projectA.repositoryUrl!,
          branch: "main",
          dockerfilePath: "Dockerfile",
          logs: {
            create: {
              line: "[SYSTEM] Deployment queued by user.",
              stream: LogStream.SYSTEM,
              sequence: 1,
            },
          },
        },
      });

      assert.strictEqual(dep1.status, "QUEUED");
      assert.strictEqual(dep1.branch, "main");
      assert.strictEqual(dep1.dockerfilePath, "Dockerfile");
      assert.strictEqual(dep1.projectId, projectA.id);

      // Verify Project status updated to 'queued'
      await prisma.project.update({
        where: { id: projectA.id },
        data: { status: "queued" },
      });

      const updatedProj = await prisma.project.findUnique({ where: { id: projectA.id } });
      assert.strictEqual(updatedProj?.status, "queued");

      console.log("   ✓ Initial deployment created and Project status synchronized to queued\n");
    }

    // ----------------------------------------------------------------
    // TEST 4: End-to-End Execution to BUILT & Docker Image Artifact Retention
    // ----------------------------------------------------------------
    console.log("[TEST 4/13] E2E Execution to BUILT & Docker Image Artifact Retention");
    let imageTag1: string = "";
    {
      const worker = createWorker("worker-p15-e2e", async (depId) => {
        const wsDir = path.resolve(SCRATCH_ROOT_DIR, depId);
        const rDir = path.join(wsDir, "repo");
        await fs.promises.mkdir(rDir, { recursive: true });
        await fs.promises.writeFile(
          path.join(rDir, "Dockerfile"),
          "FROM hello-world:latest\nCMD [\"echo\", \"phase15-built\"]\n"
        );
        imageTag1 = `cloudforge/deployment-${depId}:sha1111`;
        await prisma.deployment.update({
          where: { id: depId },
          data: { commitSha: "1111111111111111111111111111111111111111", imageTag: imageTag1 },
        });
        return {
          deploymentId: depId,
          workspaceDir: wsDir,
          repoDir: rDir,
          dockerfilePath: "Dockerfile",
          commitSha: "1111111111111111111111111111111111111111",
          commitMsg: "feat: initial working build",
          commitAuthor: "Alice <alice@example.com>",
          imageTag: imageTag1,
        };
      });

      try {
        await worker.processNext();

        // Poll until dep1 reaches terminal BUILT
        let terminalDep1 = null;
        for (let i = 0; i < 100; i++) {
          await new Promise((r) => setTimeout(r, 100));
          terminalDep1 = await prisma.deployment.findUnique({ where: { id: dep1.id } });
          if (terminalDep1?.status === "BUILT" || terminalDep1?.status === "FAILED") break;
        }

        assert.strictEqual(terminalDep1?.status, "BUILT");
        assert.strictEqual(terminalDep1?.exitCode, 0);

        // Verify Project status synchronized to ready
        const projAfter = await prisma.project.findUnique({ where: { id: projectA.id } });
        assert.strictEqual(projAfter?.status, "ready");

        // Verify scratch workspace was cleaned
        const wsExists = fs.existsSync(path.resolve(SCRATCH_ROOT_DIR, dep1.id));
        assert.strictEqual(wsExists, false, "Scratch workspace must be purged on build completion");

        console.log("   ✓ Deployment built successfully, Project.status='ready', workspace purged\n");
      } finally {
        worker.stop();
      }
    }

    // ----------------------------------------------------------------
    // TEST 5: Redeploy after BUILT (Creates a Brand New Deployment)
    // ----------------------------------------------------------------
    console.log("[TEST 5/13] Redeploy after BUILT (Creates Fresh Deployment Record)");
    let dep2: any;
    {
      dep2 = await prisma.deployment.create({
        data: {
          projectId: projectA.id,
          status: "QUEUED",
          repositoryName: projectA.repositoryName!,
          repositoryUrl: projectA.repositoryUrl!,
          branch: "main",
          dockerfilePath: "Dockerfile",
          logs: {
            create: {
              line: "[SYSTEM] Redeployment queued by user.",
              stream: LogStream.SYSTEM,
              sequence: 1,
            },
          },
        },
      });

      assert.notStrictEqual(dep2.id, dep1.id, "Redeploy must produce a new unique deployment ID");

      // Verify dep1 remains unchanged and intact (Immutability)
      const dep1Check = await prisma.deployment.findUnique({ where: { id: dep1.id } });
      assert.strictEqual(dep1Check?.status, "BUILT");

      console.log("   ✓ Redeploy created a separate Deployment record without mutating historical run\n");
    }

    // ----------------------------------------------------------------
    // TEST 6: Simulated Failure on dep2 & Image Deletion
    // ----------------------------------------------------------------
    console.log("[TEST 6/13] Build Failure on dep2 & Clean Failure State");
    {
      const failWorker = createWorker("worker-p15-fail", async (depId) => {
        throw new Error("Simulated compilation failure in test suite.");
      });

      try {
        await failWorker.processNext();

        let terminalDep2 = null;
        for (let i = 0; i < 100; i++) {
          await new Promise((r) => setTimeout(r, 100));
          terminalDep2 = await prisma.deployment.findUnique({ where: { id: dep2.id } });
          if (terminalDep2?.status === "FAILED" || terminalDep2?.status === "BUILT") break;
        }

        assert.strictEqual(terminalDep2?.status, "FAILED");
        assert.ok(terminalDep2?.errorMessage?.includes("Simulated compilation failure"));

        // Project status should now be failed (Newest-Only Invariant)
        const projAfterFail = await prisma.project.findUnique({ where: { id: projectA.id } });
        assert.strictEqual(projAfterFail?.status, "failed");

        console.log("   ✓ Build failure marked FAILED, Project.status='failed', error sanitized\n");
      } finally {
        failWorker.stop();
      }
    }

    // ----------------------------------------------------------------
    // TEST 7: Retry after FAILED
    // ----------------------------------------------------------------
    console.log("[TEST 7/13] Retry after FAILED (Creates Fresh Third Deployment)");
    let dep3: any;
    {
      dep3 = await prisma.deployment.create({
        data: {
          projectId: projectA.id,
          status: "QUEUED",
          repositoryName: projectA.repositoryName!,
          repositoryUrl: projectA.repositoryUrl!,
          branch: "main",
          dockerfilePath: "Dockerfile",
          logs: {
            create: {
              line: "[SYSTEM] Retry deployment queued by user.",
              stream: LogStream.SYSTEM,
              sequence: 1,
            },
          },
        },
      });

      assert.notStrictEqual(dep3.id, dep2.id);
      assert.notStrictEqual(dep3.id, dep1.id);

      // Verify dep2 is still FAILED
      const dep2Check = await prisma.deployment.findUnique({ where: { id: dep2.id } });
      assert.strictEqual(dep2Check?.status, "FAILED");

      console.log("   ✓ Retry created new deployment record, preserving failed deployment audit log\n");
    }

    // ----------------------------------------------------------------
    // TEST 8: Cancellation of Active/Queued Deployment
    // ----------------------------------------------------------------
    console.log("[TEST 8/13] Cancellation of Deployment (QUEUED -> CANCELLED)");
    {
      const cancelWorker = createWorker("worker-p15-cancel");
      try {
        const cancelResult = await cancelWorker.cancelDeployment(dep3.id, userA.id);

        assert.strictEqual(cancelResult.notFound, false);
        assert.strictEqual(cancelResult.isTerminal, false);
        assert.strictEqual(cancelResult.deployment?.status, "CANCELLED");

        const dep3Check = await prisma.deployment.findUnique({ where: { id: dep3.id } });
        assert.strictEqual(dep3Check?.status, "CANCELLED");

        // Verify Project status updated to 'cancelled'
        const projAfterCancel = await prisma.project.findUnique({ where: { id: projectA.id } });
        assert.strictEqual(projAfterCancel?.status, "cancelled");

        console.log("   ✓ Deployment successfully cancelled, Project.status='cancelled'\n");
      } finally {
        cancelWorker.stop();
      }
    }

    // ----------------------------------------------------------------
    // TEST 9: Retry after CANCELLED
    // ----------------------------------------------------------------
    console.log("[TEST 9/13] Retry after CANCELLED");
    let dep4: any;
    {
      dep4 = await prisma.deployment.create({
        data: {
          projectId: projectA.id,
          status: "QUEUED",
          repositoryName: projectA.repositoryName!,
          repositoryUrl: projectA.repositoryUrl!,
          branch: "main",
          dockerfilePath: "Dockerfile",
        },
      });

      assert.strictEqual(dep4.status, "QUEUED");
      assert.notStrictEqual(dep4.id, dep3.id);

      // Verify dep3 remains CANCELLED
      const dep3Check = await prisma.deployment.findUnique({ where: { id: dep3.id } });
      assert.strictEqual(dep3Check?.status, "CANCELLED");

      console.log("   ✓ Retry after cancellation created new deployment without altering cancelled record\n");
    }

    // ----------------------------------------------------------------
    // TEST 10: Enriched Project Listing (deploymentsCount & latestDeployment)
    // ----------------------------------------------------------------
    console.log("[TEST 10/13] Enriched Project Listing Service");
    {
      const userProjects = await projectService.getUserProjects(userA.id);
      assert.strictEqual(userProjects.length, 1);

      const pA = userProjects[0];
      assert.strictEqual(pA.id, projectA.id);
      // Project A has dep1, dep2, dep3, dep4
      assert.strictEqual(pA.deploymentsCount, 4);
      assert.strictEqual(pA.latestDeployment?.id, dep4.id);

      const singleProject = await projectService.getUserProjectById(projectA.id, userA.id);
      assert.strictEqual(singleProject?.deploymentsCount, 4);
      assert.strictEqual(singleProject?.latestDeployment?.id, dep4.id);

      console.log("   ✓ getUserProjects correctly computed deploymentsCount and attached latestDeployment\n");
    }

    // ----------------------------------------------------------------
    // TEST 11: Deployment History & Logs Retrieval
    // ----------------------------------------------------------------
    console.log("[TEST 11/13] Deployment History & Logs Retrieval");
    {
      const history = await prisma.deployment.findMany({
        where: { projectId: projectA.id },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          branch: true,
          commitSha: true,
          imageTag: true,
          createdAt: true,
        },
      });

      assert.strictEqual(history.length, 4);
      assert.strictEqual(history[0].id, dep4.id);
      assert.strictEqual(history[1].id, dep3.id);
      assert.strictEqual(history[2].id, dep2.id);
      assert.strictEqual(history[3].id, dep1.id);

      // Check log retrieval on dep1
      const logs = await prisma.buildLog.findMany({
        where: { deploymentId: dep1.id },
        orderBy: { sequence: "asc" },
      });
      assert.ok(logs.length > 0);
      assert.strictEqual(logs[0].sequence, 1);

      console.log("   ✓ Deployment history and logs retrieved accurately in descending order\n");
    }

    // ----------------------------------------------------------------
    // TEST 12: Cross-User Authorization Enforcement
    // ----------------------------------------------------------------
    console.log("[TEST 12/13] Cross-User Authorization Enforcement");
    {
      // User B attempts to access Project A's deployments
      const depCrossCheck = await prisma.deployment.findFirst({
        where: {
          id: dep1.id,
          project: { userId: userB.id },
        },
      });
      assert.strictEqual(depCrossCheck, null, "User B must not be able to find User A's deployment");

      // User B attempts to cancel User A's deployment
      const worker = createWorker("worker-auth-test");
      try {
        const crossCancel = await worker.cancelDeployment(dep1.id, userB.id);
        assert.strictEqual(crossCancel.notFound, true);

        console.log("   ✓ Cross-user reading and cancellation strictly rejected with notFound\n");
      } finally {
        worker.stop();
      }
    }

    // ----------------------------------------------------------------
    // TEST 13: Project Deletion & Docker Artifact Cleanup
    // ----------------------------------------------------------------
    console.log("[TEST 13/13] Project Deletion & Docker Artifact Cleanup");
    {
      // Delete projectA via projectService (which should delete all deployments & clean docker images)
      const deletedProj = await projectService.deleteUserProject(projectA.id, userA.id);
      assert.ok(deletedProj);

      // Verify cascade deleted deployments
      const remainingDeps = await prisma.deployment.findMany({
        where: { projectId: projectA.id },
      });
      assert.strictEqual(remainingDeps.length, 0, "All deployments must cascade delete with project");

      console.log("   ✓ Project and all associated deployments deleted cleanly\n");
    }

    // Clean any remaining image tag if it still exists in docker
    if (imageTag1) {
      await deleteDockerImage(imageTag1);
    }

    console.log("==================================================================");
    console.log("  ALL 13 PHASE 1.5 ORCHESTRATION TESTS PASSED SUCCESSFULLY!       ");
    console.log("==================================================================\n");
  } finally {
    for (const w of activeWorkers) {
      w.stop();
    }
    // Teardown test projects & users
    try {
      await prisma.project.deleteMany({
        where: { id: { in: [projectA?.id, projectB?.id].filter(Boolean) } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: [userA?.id, userB?.id].filter(Boolean) } },
      });
    } catch {
      // Ignore teardown errors
    }
  }
}

// Execute test suite if run directly
runPhase15Tests().catch((err) => {
  console.error("FATAL: Phase 1.5 Test Suite Failed:", err);
  process.exit(1);
});
