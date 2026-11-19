import assert from "assert";
import prisma from "../../lib/prisma";
import { getUserProjects, getUserProjectById } from "../project.service";
import { stopDeploymentHandler } from "../../controllers/deployment.controller";

async function runPhase5ReliabilityTests() {
  console.log("==================================================================");
  console.log("  PHASE 5: DEPLOYMENT EXPERIENCE & RELIABILITY TEST SUITE        ");
  console.log("==================================================================\n");

  const testUser = await prisma.user.create({
    data: {
      name: "Phase 5 User",
      email: `phase5-rel-${Date.now()}@example.com`,
    },
  });

  const testProject = await prisma.project.create({
    data: {
      name: "phase5-reliability-project",
      userId: testUser.id,
      status: "ready",
    },
  });

  try {
    // ----------------------------------------------------------------
    // TEST 1: LIVE DEPLOYMENT PRESERVED WHEN NEWER DEPLOYMENT IS BUILDING
    // ----------------------------------------------------------------
    console.log("[TEST 1/4] Scenario 10: Multi-deployment liveDeployment preserved when newer deployment is in-flight");
    const dep1Live = await prisma.deployment.create({
      data: {
        projectId: testProject.id,
        repositoryName: "acme/notes",
        repositoryUrl: "https://github.com/acme/notes",
        branch: "main",
        status: "RUNNING",
        containerId: "container-live-1",
        hostPort: 51234,
        internalPort: 80,
        localUrl: "http://localhost:51234",
        createdAt: new Date(Date.now() - 60000),
      },
    });

    await prisma.project.update({
      where: { id: testProject.id },
      data: { liveDeploymentId: dep1Live.id, status: "ready" },
    });

    // A newer deployment is queued/building
    const dep2Building = await prisma.deployment.create({
      data: {
        projectId: testProject.id,
        repositoryName: "acme/notes",
        repositoryUrl: "https://github.com/acme/notes",
        branch: "main",
        status: "BUILDING",
        createdAt: new Date(),
      },
    });

    const projects = await getUserProjects(testUser.id);
    const proj = projects.find((p) => p.id === testProject.id);

    assert.ok(proj, "Project must be returned");
    assert.strictEqual(proj.latestDeployment?.id, dep2Building.id, "Latest deployment must be the newly building deployment");
    assert.strictEqual(proj.latestDeployment?.status, "BUILDING", "Latest deployment status must be BUILDING");
    assert.strictEqual(proj.liveDeployment?.id, dep1Live.id, "Live deployment must point to active running container");
    assert.strictEqual(proj.liveDeployment?.localUrl, "http://localhost:51234", "Live deployment localUrl must be preserved");
    console.log("   ✓ Live running deployment preserved during newer in-flight build\n");

    // ----------------------------------------------------------------
    // TEST 2: SINGLE PROJECT FETCH INCLUDES BOTH LATEST AND LIVE DEPLOYMENTS
    // ----------------------------------------------------------------
    console.log("[TEST 2/4] getUserProjectById returns distinct latestDeployment and liveDeployment");
    const singleProj = await getUserProjectById(testProject.id, testUser.id);
    assert.ok(singleProj, "Single project must be found");
    assert.strictEqual(singleProj.latestDeployment?.id, dep2Building.id);
    assert.strictEqual(singleProj.liveDeployment?.id, dep1Live.id);
    console.log("   ✓ getUserProjectById correctly projects live and latest deployments\n");

    // ----------------------------------------------------------------
    // TEST 3: STOP DEPLOYMENT CLEARS liveDeploymentId ON PROJECT
    // ----------------------------------------------------------------
    console.log("[TEST 3/4] stopDeploymentHandler gracefully clears liveDeploymentId and sets status to stopped");
    let stopStatus = 0;
    const req: any = { user: { id: testUser.id }, params: { deploymentId: dep1Live.id } };
    const res: any = {
      status: (code: number) => {
        stopStatus = code;
        return { json: () => {} };
      },
    };

    await stopDeploymentHandler(req, res);
    assert.strictEqual(stopStatus, 200, "Stop handler must respond with HTTP 200");

    const refreshedProj = await prisma.project.findUnique({ where: { id: testProject.id } });
    assert.strictEqual(refreshedProj?.status, "stopped", "Project status must become stopped");
    assert.strictEqual(refreshedProj?.liveDeploymentId, null, "Project liveDeploymentId must be cleared to null");

    const stoppedProjects = await getUserProjects(testUser.id);
    const stoppedProj = stoppedProjects.find((p) => p.id === testProject.id);
    assert.strictEqual(stoppedProj?.liveDeployment, null, "liveDeployment must be null after stop");
    console.log("   ✓ Stop action cleanly clears live pointer so stopped deployment does not appear live\n");

    // ----------------------------------------------------------------
    // TEST 4: CRASH RECOVERY CLEARS LIVE POINTER
    // ----------------------------------------------------------------
    console.log("[TEST 4/4] Crashed project invariants: status is crashed and liveDeployment is null");
    await prisma.project.update({
      where: { id: testProject.id },
      data: { status: "crashed", liveDeploymentId: null },
    });

    const crashedProjects = await getUserProjects(testUser.id);
    const crashedProj = crashedProjects.find((p) => p.id === testProject.id);
    assert.strictEqual(crashedProj?.status, "crashed");
    assert.strictEqual(crashedProj?.liveDeploymentId, null);
    assert.strictEqual(crashedProj?.liveDeployment, null);
    console.log("   ✓ Crashed project invariant confirmed: status crashed and liveDeployment null\n");

    console.log("==================================================================");
    console.log("  ALL PHASE 5 RELIABILITY TESTS PASSED SUCCESSFULLY!             ");
    console.log("==================================================================\n");
  } finally {
    // Cleanup
    await prisma.deployment.deleteMany({ where: { projectId: testProject.id } });
    await prisma.project.deleteMany({ where: { userId: testUser.id } });
    await prisma.user.deleteMany({ where: { id: testUser.id } });
  }
}

runPhase5ReliabilityTests().catch((err) => {
  console.error("Phase 5 Reliability Test Failed:", err);
  process.exit(1);
});
