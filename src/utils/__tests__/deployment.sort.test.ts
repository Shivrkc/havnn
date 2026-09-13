import assert from "assert";
import { sortDeploymentsNewestFirst, mapBackendDeploymentToFrontend } from "../../pages/Dashboard";
import { Deployment, BackendDeployment } from "../../types";

console.log("Starting Dashboard Deployment Sorting Regression Test...\n");

// -----------------------------------------------------------------------------
// TEST 1: Demonstrates that relative-time strings fail with new Date()
// -----------------------------------------------------------------------------
console.log("1. Verifying relative-time strings produce NaN with new Date()...");
assert.ok(isNaN(new Date("Just now").getTime()), "'Just now' must produce NaN with new Date");
assert.ok(isNaN(new Date("5m ago").getTime()), "'5m ago' must produce NaN with new Date");
assert.ok(isNaN(new Date("2h ago").getTime()), "'2h ago' must produce NaN with new Date");
assert.ok(isNaN(new Date("Yesterday").getTime()), "'Yesterday' must produce NaN with new Date");
console.log("   ✓ Verified: naive Date parsing of relative-time strings produces NaN\n");

// -----------------------------------------------------------------------------
// TEST 2: sortDeploymentsNewestFirst sorts newest-first using real createdAt
// -----------------------------------------------------------------------------
console.log("2. Testing sortDeploymentsNewestFirst with differing relative-time labels...");
const now = Date.now();

const dep1: Deployment = {
  id: "dep-1",
  projectName: "Project A",
  status: "ready",
  branch: "main",
  commitMsg: "Latest commit",
  commitHash: "abc1234",
  deployedAt: "Just now",
  createdAt: new Date(now).toISOString(),
  url: "https://github.com/org/repo",
  environment: "production",
};

const dep2: Deployment = {
  id: "dep-2",
  projectName: "Project A",
  status: "ready",
  branch: "main",
  commitMsg: "Older commit",
  commitHash: "def5678",
  deployedAt: "5m ago",
  createdAt: new Date(now - 5 * 60 * 1000).toISOString(),
  url: "https://github.com/org/repo",
  environment: "production",
};

const dep3: Deployment = {
  id: "dep-3",
  projectName: "Project A",
  status: "failed",
  branch: "main",
  commitMsg: "Oldest commit",
  commitHash: "ghi9012",
  deployedAt: "2h ago",
  createdAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
  url: "https://github.com/org/repo",
  environment: "production",
};

// Shuffled array
const list = [dep2, dep3, dep1];
list.sort(sortDeploymentsNewestFirst);

assert.strictEqual(list[0].id, "dep-1", "Newest deployment ('Just now') must be first");
assert.strictEqual(list[1].id, "dep-2", "Middle deployment ('5m ago') must be second");
assert.strictEqual(list[2].id, "dep-3", "Oldest deployment ('2h ago') must be third");
console.log("   ✓ Verified: deployments correctly sorted newest-first by real timestamp\n");

// -----------------------------------------------------------------------------
// TEST 3: Deployments with the SAME relative-time label sort correctly by timestamp
// -----------------------------------------------------------------------------
console.log("3. Testing deployments with identical relative-time labels...");
const depSameLabelOlder: Deployment = {
  id: "dep-same-older",
  projectName: "Project B",
  status: "ready",
  branch: "main",
  commitMsg: "Earlier within the same minute",
  commitHash: "1111111",
  deployedAt: "Just now",
  createdAt: new Date(now - 40 * 1000).toISOString(),
  url: "https://github.com/org/repo",
  environment: "production",
};

const depSameLabelNewer: Deployment = {
  id: "dep-same-newer",
  projectName: "Project B",
  status: "ready",
  branch: "main",
  commitMsg: "Latest within the same minute",
  commitHash: "2222222",
  deployedAt: "Just now",
  createdAt: new Date(now - 5 * 1000).toISOString(),
  url: "https://github.com/org/repo",
  environment: "production",
};

const sameLabelList = [depSameLabelOlder, depSameLabelNewer];
sameLabelList.sort(sortDeploymentsNewestFirst);

assert.strictEqual(sameLabelList[0].id, "dep-same-newer");
assert.strictEqual(sameLabelList[1].id, "dep-same-older");
console.log("   ✓ Verified: sub-minute resolution preserved when relative labels are identical\n");

// -----------------------------------------------------------------------------
// TEST 4: mapBackendDeploymentToFrontend populates createdAt & preserves deployedAt
// -----------------------------------------------------------------------------
console.log("4. Testing mapBackendDeploymentToFrontend sets real createdAt and formatted deployedAt...");
const backendDep: BackendDeployment = {
  id: "bd-1",
  projectId: "proj-1",
  status: "BUILT",
  repositoryName: "owner/repo",
  repositoryUrl: "https://github.com/owner/repo",
  branch: "main",
  commitSha: "abcdef1234567890",
  commitMsg: "feat: add feature",
  dockerfilePath: "Dockerfile",
  createdAt: new Date(now - 30 * 1000).toISOString(),
  updatedAt: new Date(now - 30 * 1000).toISOString(),
};

const mapped = mapBackendDeploymentToFrontend(backendDep);
assert.strictEqual(mapped.id, "bd-1");
assert.strictEqual(mapped.createdAt, backendDep.createdAt, "createdAt must preserve backend ISO timestamp");
assert.strictEqual(mapped.deployedAt, "Just now", "deployedAt must format human-readable relative time");
console.log("   ✓ Verified: mapBackendDeploymentToFrontend binds createdAt and relative deployedAt\n");

console.log("==================================================================");
console.log("  ALL DASHBOARD DEPLOYMENT SORTING TESTS PASSED SUCCESSFULLY!     ");
console.log("==================================================================");
