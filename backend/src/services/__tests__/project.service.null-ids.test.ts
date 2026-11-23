import assert from "assert";
import prisma from "../../lib/prisma";
import { getUserProjects } from "../project.service";

async function runNullAndValidStringRegressionTest() {
  console.log("==================================================================");
  console.log("  REGRESSION TEST: getUserProjects NULL & STRING liveDeploymentId ");
  console.log("==================================================================\n");

  // 1. Direct unit verification of the type predicate
  console.log("[TEST 1/2] Type predicate filters null, undefined, empty string, and already-included IDs");
  const mixedIds: (string | null | undefined)[] = [
    null,
    undefined,
    "",
    "live-dep-already-latest",
    null,
    "live-dep-missing-from-latest",
    undefined,
  ];
  const mockProjects = [
    { deployments: [{ id: "live-dep-already-latest" }] },
  ];

  const filteredIds: string[] = mixedIds.filter(
    (id): id is string =>
      Boolean(id && !mockProjects.some((pr) => pr.deployments[0]?.id === id))
  );

  assert.strictEqual(Array.isArray(filteredIds), true);
  assert.strictEqual(filteredIds.length, 1);
  assert.strictEqual(filteredIds[0], "live-dep-missing-from-latest");
  // TypeScript compile-time type verification: filteredIds must be assignable to string[]
  const typeVerification: string[] = filteredIds;
  assert.ok(typeVerification, "Filtered IDs array must be typed as string[]");
  console.log("   ✓ Type predicate narrowed array to string[] with only eligible valid ID\n");

  // 2. Database integration test with real PostgreSQL records
  console.log("[TEST 2/2] Integration test with real DB records: null, same-as-latest, and missing-from-latest");
  const testUser = await prisma.user.create({
    data: {
      name: "Type Predicate Test User",
      email: `type-pred-${Date.now()}@example.com`,
    },
  });

  const projectWithNullLive = await prisma.project.create({
    data: {
      name: "proj-null-live",
      userId: testUser.id,
      status: "idle",
      liveDeploymentId: null,
    },
  });

  const projectWithLatestLive = await prisma.project.create({
    data: {
      name: "proj-latest-live",
      userId: testUser.id,
      status: "ready",
    },
  });

  const depLatest = await prisma.deployment.create({
    data: {
      projectId: projectWithLatestLive.id,
      repositoryName: "acme/latest-live",
      repositoryUrl: "https://github.com/acme/latest-live",
      branch: "main",
      status: "RUNNING",
      localUrl: "http://localhost:54321",
    },
  });

  await prisma.project.update({
    where: { id: projectWithLatestLive.id },
    data: { liveDeploymentId: depLatest.id },
  });

  const projectWithOlderLive = await prisma.project.create({
    data: {
      name: "proj-older-live",
      userId: testUser.id,
      status: "ready",
    },
  });

  const depOlderLive = await prisma.deployment.create({
    data: {
      projectId: projectWithOlderLive.id,
      repositoryName: "acme/older-live",
      repositoryUrl: "https://github.com/acme/older-live",
      branch: "main",
      status: "RUNNING",
      localUrl: "http://localhost:54322",
      createdAt: new Date(Date.now() - 3600000),
    },
  });

  await prisma.project.update({
    where: { id: projectWithOlderLive.id },
    data: { liveDeploymentId: depOlderLive.id },
  });

  // Newer deployment in-flight for projectWithOlderLive
  const depNewerBuilding = await prisma.deployment.create({
    data: {
      projectId: projectWithOlderLive.id,
      repositoryName: "acme/older-live",
      repositoryUrl: "https://github.com/acme/older-live",
      branch: "main",
      status: "BUILDING",
      createdAt: new Date(),
    },
  });

  try {
    const userProjects = await getUserProjects(testUser.id);
    assert.strictEqual(userProjects.length, 3);

    const projA = userProjects.find((p) => p.id === projectWithNullLive.id);
    assert.ok(projA, "proj-null-live must exist");
    assert.strictEqual(projA.liveDeploymentId, null);
    assert.strictEqual(projA.liveDeployment, null);

    const projB = userProjects.find((p) => p.id === projectWithLatestLive.id);
    assert.ok(projB, "proj-latest-live must exist");
    assert.strictEqual(projB.liveDeploymentId, depLatest.id);
    assert.strictEqual(projB.liveDeployment?.id, depLatest.id);
    assert.strictEqual(projB.latestDeployment?.id, depLatest.id);

    const projC = userProjects.find((p) => p.id === projectWithOlderLive.id);
    assert.ok(projC, "proj-older-live must exist");
    assert.strictEqual(projC.liveDeploymentId, depOlderLive.id);
    assert.strictEqual(projC.liveDeployment?.id, depOlderLive.id);
    assert.strictEqual(projC.latestDeployment?.id, depNewerBuilding.id);
    assert.strictEqual(projC.liveDeployment?.localUrl, "http://localhost:54322");

    console.log("   ✓ getUserProjects correctly resolved null, same-as-latest, and missing-from-latest DB records\n");

    console.log("==================================================================");
    console.log("  NULL & STRING REGRESSION TESTS PASSED SUCCESSFULLY!             ");
    console.log("==================================================================\n");
  } finally {
    await prisma.deployment.deleteMany({
      where: {
        projectId: { in: [projectWithNullLive.id, projectWithLatestLive.id, projectWithOlderLive.id] },
      },
    });
    await prisma.project.deleteMany({ where: { userId: testUser.id } });
    await prisma.user.deleteMany({ where: { id: testUser.id } });
  }
}

runNullAndValidStringRegressionTest().catch((err) => {
  console.error("Null & String Regression Test Failed:", err);
  process.exit(1);
});
