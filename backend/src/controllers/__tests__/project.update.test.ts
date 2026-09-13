import assert from "assert";
import { updateProject } from "../project.controller";

async function runTest() {
  console.log("Starting Project Update Validation Regression Test...\n");

  let resStatus = 0;
  let resJson: any = null;

  const mockRes = {
    status(code: number) {
      resStatus = code;
      return this;
    },
    json(data: any) {
      resJson = data;
      return this;
    },
  } as any;

  // 1. Test empty string name
  console.log("1. Testing empty string name update...");
  resStatus = 0;
  resJson = null;
  await updateProject(
    {
      user: { id: "user-1", email: "test@example.com" },
      params: { id: "proj-1" },
      body: { name: "" },
    } as any,
    mockRes
  );
  assert.strictEqual(resStatus, 400);
  assert.strictEqual(resJson?.success, false);
  assert.strictEqual(resJson?.message, "Project name is required");
  console.log("   ✓ Empty string project name rejected with 400");

  // 2. Test whitespace-only name
  console.log("2. Testing whitespace-only name update...");
  resStatus = 0;
  resJson = null;
  await updateProject(
    {
      user: { id: "user-1", email: "test@example.com" },
      params: { id: "proj-1" },
      body: { name: "    " },
    } as any,
    mockRes
  );
  assert.strictEqual(resStatus, 400);
  assert.strictEqual(resJson?.success, false);
  assert.strictEqual(resJson?.message, "Project name is required");
  console.log("   ✓ Whitespace-only project name rejected with 400");

  // 3. Test non-string name
  console.log("3. Testing non-string name update...");
  resStatus = 0;
  resJson = null;
  await updateProject(
    {
      user: { id: "user-1", email: "test@example.com" },
      params: { id: "proj-1" },
      body: { name: 123 },
    } as any,
    mockRes
  );
  assert.strictEqual(resStatus, 400);
  assert.strictEqual(resJson?.success, false);
  assert.strictEqual(resJson?.message, "Project name is required");
  console.log("   ✓ Non-string project name rejected with 400");

  // 4. Test undefined name allows update and forwards undefined
  console.log("4. Testing undefined name preserves existing project name...");
  const projectService = require("../../services/project.service");
  const originalUpdate = projectService.updateUserProject;
  let capturedUpdateData: any = null;
  projectService.updateUserProject = async (id: string, userId: string, data: any) => {
    capturedUpdateData = data;
    return { id, userId, ...data };
  };

  try {
    resStatus = 0;
    resJson = null;
    await updateProject(
      {
        user: { id: "user-1", email: "test@example.com" },
        params: { id: "proj-1" },
        body: { description: "Updated description without renaming" },
      } as any,
      mockRes
    );
    assert.strictEqual(resStatus, 200);
    assert.strictEqual(resJson?.success, true);
    assert.strictEqual(capturedUpdateData.name, undefined);
    assert.strictEqual(capturedUpdateData.description, "Updated description without renaming");
    console.log("   ✓ Undefined project name is allowed and preserved");

    // 5. Test valid name is trimmed and forwarded to service
    console.log("5. Testing valid name trimming and update...");
    capturedUpdateData = null;
    resStatus = 0;
    resJson = null;
    await updateProject(
      {
        user: { id: "user-1", email: "test@example.com" },
        params: { id: "proj-1" },
        body: { name: "   My Updated Project   " },
      } as any,
      mockRes
    );
    assert.strictEqual(resStatus, 200);
    assert.strictEqual(resJson?.success, true);
    assert.strictEqual(capturedUpdateData.name, "My Updated Project");
    console.log("   ✓ Valid project name is properly trimmed and accepted");
  } finally {
    projectService.updateUserProject = originalUpdate;
  }

  console.log("\nAll Project Update Validation tests passed successfully!");
}

runTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
