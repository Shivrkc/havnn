import assert from "assert";
import prisma from "../../lib/prisma";
import {
  getDeploymentById,
  getProjectDeployments,
} from "../../controllers/deployment.controller";

async function runPhase4MetadataTests() {
  console.log("==================================================================");
  console.log("  PHASE 4.1: RUNTIME METADATA CONTROLLER PROJECTION TESTS         ");
  console.log("==================================================================\n");

  const testUser = await prisma.user.create({
    data: {
      name: "Phase 4 User",
      email: `phase4-meta-${Date.now()}@example.com`,
    },
  });

  const attackerUser = await prisma.user.create({
    data: {
      name: "Phase 4 Attacker",
      email: `phase4-attacker-${Date.now()}@example.com`,
    },
  });

  const testProject = await prisma.project.create({
    data: {
      name: "phase4-meta-project",
      userId: testUser.id,
      status: "ready",
    },
  });

  const testDeployment = await prisma.deployment.create({
    data: {
      projectId: testProject.id,
      repositoryName: "acme/web-app",
      repositoryUrl: "https://github.com/acme/web-app",
      branch: "main",
      status: "RUNNING",
      containerId: "container-phase4-meta-12345",
      hostPort: 34567,
      internalPort: 8080,
      localUrl: "http://localhost:34567",
      commitSha: "abcdef1234567890",
      commitMsg: "feat: runtime metadata test",
    },
  });

  try {
    // ----------------------------------------------------------------
    // TEST 1: getDeploymentById returns containerId, hostPort, internalPort, localUrl
    // ----------------------------------------------------------------
    console.log("[TEST 1/4] getDeploymentById Projection Includes Runtime Metadata");
    {
      let statusCode = 0;
      let responseBody: any = null;

      const req: any = {
        user: { id: testUser.id },
        params: { deploymentId: testDeployment.id },
      };
      const res: any = {
        status: (code: number) => {
          statusCode = code;
          return {
            json: (data: any) => {
              responseBody = data;
            },
          };
        },
      };

      await getDeploymentById(req, res);

      assert.strictEqual(statusCode, 200, "Must return HTTP 200");
      assert.strictEqual(responseBody?.success, true);
      const dep = responseBody?.deployment;
      assert.ok(dep, "Deployment object must be returned");
      assert.strictEqual(dep.id, testDeployment.id);
      assert.strictEqual(dep.containerId, "container-phase4-meta-12345", "containerId must be present in projection");
      assert.strictEqual(dep.hostPort, 34567, "hostPort must be present in projection");
      assert.strictEqual(dep.internalPort, 8080, "internalPort must be present in projection");
      assert.strictEqual(dep.localUrl, "http://localhost:34567", "localUrl must be present in projection");
      assert.strictEqual(dep.status, "RUNNING");

      console.log("   ✓ getDeploymentById returns all 4 runtime fields cleanly\n");
    }

    // ----------------------------------------------------------------
    // TEST 2: getProjectDeployments returns runtime fields in deployments array
    // ----------------------------------------------------------------
    console.log("[TEST 2/4] getProjectDeployments Projection Includes Runtime Metadata");
    {
      let statusCode = 0;
      let responseBody: any = null;

      const req: any = {
        user: { id: testUser.id },
        params: { projectId: testProject.id },
        query: { page: "1", limit: "10" },
      };
      const res: any = {
        status: (code: number) => {
          statusCode = code;
          return {
            json: (data: any) => {
              responseBody = data;
            },
          };
        },
      };

      await getProjectDeployments(req, res);

      assert.strictEqual(statusCode, 200, "Must return HTTP 200");
      assert.strictEqual(responseBody?.success, true);
      assert.ok(Array.isArray(responseBody?.deployments), "deployments must be an array");
      assert.strictEqual(responseBody.deployments.length, 1);

      const item = responseBody.deployments[0];
      assert.strictEqual(item.id, testDeployment.id);
      assert.strictEqual(item.containerId, "container-phase4-meta-12345", "containerId must be present in item projection");
      assert.strictEqual(item.hostPort, 34567, "hostPort must be present in item projection");
      assert.strictEqual(item.internalPort, 8080, "internalPort must be present in item projection");
      assert.strictEqual(item.localUrl, "http://localhost:34567", "localUrl must be present in item projection");

      console.log("   ✓ getProjectDeployments returns runtime fields in deployment list\n");
    }

    // ----------------------------------------------------------------
    // TEST 3: IDOR Security Isolation on getDeploymentById
    // ----------------------------------------------------------------
    console.log("[TEST 3/4] IDOR Isolation: Attacker Cannot Read Another User's Runtime Metadata");
    {
      let statusCode = 0;
      let responseBody: any = null;

      const attackerReq: any = {
        user: { id: attackerUser.id },
        params: { deploymentId: testDeployment.id },
      };
      const res: any = {
        status: (code: number) => {
          statusCode = code;
          return {
            json: (data: any) => {
              responseBody = data;
            },
          };
        },
      };

      await getDeploymentById(attackerReq, res);

      assert.strictEqual(statusCode, 404, "Must return HTTP 404 for cross-user deployment access");
      assert.strictEqual(responseBody?.success, false);
      assert.ok(responseBody?.message?.includes("not found or access denied"));

      console.log("   ✓ Ownership boundaries strictly enforced on getDeploymentById\n");
    }

    // ----------------------------------------------------------------
    // TEST 4: IDOR Security Isolation on getProjectDeployments
    // ----------------------------------------------------------------
    console.log("[TEST 4/4] IDOR Isolation: Attacker Cannot Read Another User's Project Deployments");
    {
      let statusCode = 0;
      let responseBody: any = null;

      const attackerReq: any = {
        user: { id: attackerUser.id },
        params: { projectId: testProject.id },
        query: { page: "1", limit: "10" },
      };
      const res: any = {
        status: (code: number) => {
          statusCode = code;
          return {
            json: (data: any) => {
              responseBody = data;
            },
          };
        },
      };

      await getProjectDeployments(attackerReq, res);

      assert.strictEqual(statusCode, 404, "Must return HTTP 404 for cross-user project deployment access");
      assert.strictEqual(responseBody?.success, false);
      assert.ok(responseBody?.message?.includes("not found or access denied"));

      console.log("   ✓ Ownership boundaries strictly enforced on getProjectDeployments\n");
    }

    console.log("==================================================================");
    console.log("  ALL PHASE 4.1 RUNTIME METADATA TESTS PASSED SUCCESSFULLY!       ");
    console.log("==================================================================\n");
  } finally {
    await prisma.deployment.deleteMany({ where: { projectId: testProject.id } });
    await prisma.project.deleteMany({ where: { id: testProject.id } });
    await prisma.user.deleteMany({ where: { id: { in: [testUser.id, attackerUser.id] } } });
  }
}

runPhase4MetadataTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
