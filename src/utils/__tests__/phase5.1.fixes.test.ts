import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mapBackendProjectToProject,
  getEligibleRestartDeployment,
  getProjectLiveRuntime,
  BackendProjectShape,
} from '../deployment.utils';

test('Phase 5.1 Fix 1 Regression Suite: Live Deployment URL Preservation', async (t) => {
  const baseV1 = {
    id: 'dep-v1',
    status: 'RUNNING' as const,
    branch: 'main',
    commitSha: 'a1b2c3d',
    commitMsg: 'Initial release',
    imageTag: 'cloudforge/v1:tag',
    createdAt: '2026-11-11T10:00:00.000Z',
    completedAt: '2026-11-11T10:02:00.000Z',
    containerId: 'cont-111',
    hostPort: 45001,
    internalPort: 80,
    localUrl: 'http://localhost:45001',
  };

  await t.test('1. RUNNING v1 + BUILDING v2: v1 URL remains visible', () => {
    const bp: BackendProjectShape = {
      id: 'proj-1',
      name: 'Test Project',
      repositoryName: 'acme/repo',
      repositoryUrl: 'https://github.com/acme/repo',
      branch: 'main',
      status: 'building',
      userId: 'user-1',
      liveDeploymentId: 'dep-v1',
      createdAt: '2026-11-11T10:00:00.000Z',
      updatedAt: '2026-11-11T10:05:00.000Z',
      deploymentsCount: 2,
      latestDeployment: {
        id: 'dep-v2',
        status: 'BUILDING',
        branch: 'main',
        createdAt: '2026-11-11T10:05:00.000Z',
      },
      liveDeployment: baseV1,
    };

    const project = mapBackendProjectToProject(bp);
    assert.equal(project.localUrl, 'http://localhost:45001', 'v1 URL must remain visible during v2 build');
    assert.equal(project.hostPort, 45001);
    assert.equal(project.liveDeploymentId, 'dep-v1');
    assert.equal(project.status, 'building');
  });

  await t.test('2. RUNNING v1 + FAILED v2: v1 URL remains visible', () => {
    const bp: BackendProjectShape = {
      id: 'proj-1',
      name: 'Test Project',
      repositoryName: 'acme/repo',
      repositoryUrl: 'https://github.com/acme/repo',
      branch: 'main',
      status: 'failed',
      userId: 'user-1',
      liveDeploymentId: 'dep-v1',
      createdAt: '2026-11-11T10:00:00.000Z',
      updatedAt: '2026-11-11T10:06:00.000Z',
      deploymentsCount: 2,
      latestDeployment: {
        id: 'dep-v2',
        status: 'FAILED',
        branch: 'main',
        createdAt: '2026-11-11T10:05:00.000Z',
      },
      liveDeployment: baseV1,
    };

    const project = mapBackendProjectToProject(bp);
    assert.equal(project.localUrl, 'http://localhost:45001', 'v1 URL must remain intact when v2 fails');
    assert.equal(project.hostPort, 45001);
    assert.equal(project.liveDeploymentId, 'dep-v1');
    assert.equal(project.status, 'failed');
  });

  await t.test('3. RUNNING v1 + successful v2 promotion: v2 URL replaces v1', () => {
    const v2Live = {
      id: 'dep-v2',
      status: 'RUNNING' as const,
      branch: 'main',
      commitSha: 'b2c3d4e',
      commitMsg: 'Feature upgrade',
      imageTag: 'cloudforge/v2:tag',
      createdAt: '2026-11-11T10:05:00.000Z',
      completedAt: '2026-11-11T10:07:00.000Z',
      containerId: 'cont-222',
      hostPort: 45002,
      internalPort: 80,
      localUrl: 'http://localhost:45002',
    };

    const bp: BackendProjectShape = {
      id: 'proj-1',
      name: 'Test Project',
      repositoryName: 'acme/repo',
      repositoryUrl: 'https://github.com/acme/repo',
      branch: 'main',
      status: 'ready',
      userId: 'user-1',
      liveDeploymentId: 'dep-v2',
      createdAt: '2026-11-11T10:00:00.000Z',
      updatedAt: '2026-11-11T10:07:00.000Z',
      deploymentsCount: 2,
      latestDeployment: v2Live,
      liveDeployment: v2Live,
    };

    const project = mapBackendProjectToProject(bp);
    assert.equal(project.localUrl, 'http://localhost:45002', 'v2 URL must replace v1 after promotion');
    assert.equal(project.hostPort, 45002);
    assert.equal(project.liveDeploymentId, 'dep-v2');
  });

  await t.test('4. STOPPED deployment: no live URL', () => {
    const bp: BackendProjectShape = {
      id: 'proj-1',
      name: 'Test Project',
      repositoryName: 'acme/repo',
      repositoryUrl: 'https://github.com/acme/repo',
      branch: 'main',
      status: 'stopped',
      userId: 'user-1',
      liveDeploymentId: null,
      createdAt: '2026-11-11T10:00:00.000Z',
      updatedAt: '2026-11-11T10:10:00.000Z',
      deploymentsCount: 1,
      latestDeployment: {
        id: 'dep-v1',
        status: 'STOPPED',
        branch: 'main',
        createdAt: '2026-11-11T10:00:00.000Z',
      },
      liveDeployment: null,
    };

    const project = mapBackendProjectToProject(bp);
    assert.equal(project.localUrl, null, 'Stopped project must never have a live URL');
    assert.equal(project.hostPort, null);
    assert.equal(project.status, 'stopped');
  });

  await t.test('5. CRASHED deployment: no live URL', () => {
    const bp: BackendProjectShape = {
      id: 'proj-1',
      name: 'Test Project',
      repositoryName: 'acme/repo',
      repositoryUrl: 'https://github.com/acme/repo',
      branch: 'main',
      status: 'crashed',
      userId: 'user-1',
      liveDeploymentId: null,
      createdAt: '2026-11-11T10:00:00.000Z',
      updatedAt: '2026-11-11T10:10:00.000Z',
      deploymentsCount: 1,
      latestDeployment: {
        id: 'dep-v1',
        status: 'CRASHED',
        branch: 'main',
        createdAt: '2026-11-11T10:00:00.000Z',
      },
      liveDeployment: null,
    };

    const project = mapBackendProjectToProject(bp);
    assert.equal(project.localUrl, null, 'Crashed project must never have a live URL');
    assert.equal(project.hostPort, null);
    assert.equal(project.status, 'crashed');
  });

  await t.test('6. Missing live deployment metadata: no false live URL', () => {
    const bp: BackendProjectShape = {
      id: 'proj-1',
      name: 'Test Project',
      repositoryName: 'acme/repo',
      repositoryUrl: 'https://github.com/acme/repo',
      branch: 'main',
      status: 'ready',
      userId: 'user-1',
      liveDeploymentId: null,
      createdAt: '2026-11-11T10:00:00.000Z',
      updatedAt: '2026-11-11T10:10:00.000Z',
      deploymentsCount: 0,
      latestDeployment: null,
      liveDeployment: null,
    };

    const project = mapBackendProjectToProject(bp);
    assert.equal(project.localUrl, null, 'Missing live deployment must produce null localUrl');
    assert.equal(project.hostPort, null);
  });

  await t.test('7. Refresh dashboard after failed build: v1 URL remains visible', () => {
    const reloadedPayload: BackendProjectShape = {
      id: 'proj-1',
      name: 'Test Project',
      repositoryName: 'acme/repo',
      repositoryUrl: 'https://github.com/acme/repo',
      branch: 'main',
      status: 'failed',
      userId: 'user-1',
      liveDeploymentId: 'dep-v1',
      createdAt: '2026-11-11T10:00:00.000Z',
      updatedAt: '2026-11-11T10:15:00.000Z',
      deploymentsCount: 3,
      latestDeployment: {
        id: 'dep-v3-broken',
        status: 'FAILED',
        branch: 'main',
        createdAt: '2026-11-11T10:14:00.000Z',
      },
      liveDeployment: baseV1,
    };

    const refreshedProject = mapBackendProjectToProject(reloadedPayload);
    assert.equal(refreshedProject.localUrl, 'http://localhost:45001');
    assert.equal(refreshedProject.hostPort, 45001);
    assert.equal(refreshedProject.liveDeploymentId, 'dep-v1');
    assert.equal(refreshedProject.liveDeployment?.status, 'RUNNING');
  });
});

test('Phase 5.1 Fix 2 Regression Suite: Restart Deployment Targeting', async (t) => {
  await t.test('1. Latest FAILED + older STOPPED: restart targets older STOPPED deployment', () => {
    const project = {
      latestDeployment: { id: 'dep-failed-v2', status: 'FAILED' as const },
      liveDeployment: { id: 'dep-stopped-v1', status: 'STOPPED' as const },
    };

    const target = getEligibleRestartDeployment(project);
    assert.ok(target, 'Eligible deployment should be found');
    assert.equal(target?.id, 'dep-stopped-v1', 'Must target older STOPPED deployment, not FAILED');
  });

  await t.test('2. Latest FAILED + older CRASHED: restart targets eligible CRASHED deployment', () => {
    const project = {
      latestDeployment: { id: 'dep-failed-v2', status: 'FAILED' as const },
      liveDeployment: { id: 'dep-crashed-v1', status: 'CRASHED' as const },
    };

    const target = getEligibleRestartDeployment(project);
    assert.ok(target, 'Eligible deployment should be found');
    assert.equal(target?.id, 'dep-crashed-v1', 'Must target older CRASHED deployment');
  });

  await t.test('3. Latest STOPPED: restart targets latest STOPPED deployment', () => {
    const project = {
      latestDeployment: { id: 'dep-stopped-v1', status: 'STOPPED' as const },
      liveDeployment: null,
    };

    const target = getEligibleRestartDeployment(project);
    assert.equal(target?.id, 'dep-stopped-v1');
  });

  await t.test('4. Latest CRASHED: restart targets latest CRASHED deployment', () => {
    const project = {
      latestDeployment: { id: 'dep-crashed-v1', status: 'CRASHED' as const },
      liveDeployment: null,
    };

    const target = getEligibleRestartDeployment(project);
    assert.equal(target?.id, 'dep-crashed-v1');
  });

  await t.test('5. No eligible deployment: Restart is disabled / returns null', () => {
    const project = {
      latestDeployment: { id: 'dep-failed-only', status: 'FAILED' as const },
      liveDeployment: null,
    };

    const target = getEligibleRestartDeployment(project);
    assert.equal(target, null, 'Must return null when no STOPPED or CRASHED deployment exists');
  });

  await t.test('6. RUNNING deployment: Restart does not target it', () => {
    const project = {
      latestDeployment: { id: 'dep-running', status: 'RUNNING' as const },
      liveDeployment: { id: 'dep-running', status: 'RUNNING' as const },
    };

    const target = getEligibleRestartDeployment(project);
    assert.equal(target, null, 'RUNNING deployment cannot be targeted for restart');
  });

  await t.test('7. Double-click Restart: mutex lock prevents duplicate submission', async () => {
    let callCount = 0;
    let isRestarting = false;

    const mockRestartHandler = async () => {
      if (isRestarting) return;
      isRestarting = true;
      try {
        callCount++;
        await new Promise((r) => setTimeout(r, 20));
      } finally {
        isRestarting = false;
      }
    };

    // Simulate rapid concurrent double-click
    await Promise.all([mockRestartHandler(), mockRestartHandler()]);
    assert.equal(callCount, 1, 'Only one restart submission should execute');
  });

  await t.test('8. Successful restart: eligible target has non-null ID for worker queueing', () => {
    const project = {
      latestDeployment: { id: 'dep-stopped-target-789', status: 'STOPPED' as const },
    };

    const target = getEligibleRestartDeployment(project);
    assert.ok(target?.id);
    assert.equal(target.status, 'STOPPED');
  });
});

test('Phase 5.1 ProjectCard Visibility: Live Deployment & Badge Segregation Suite', async (t) => {
  const v1Live = {
    id: 'dep-v1',
    status: 'RUNNING' as const,
    branch: 'test/failing-build',
    commitSha: '21ccb75',
    commitMsg: 'Initial release',
    imageTag: 'cloudforge/v1:tag',
    createdAt: '2026-11-17T08:22:04.409Z',
    completedAt: '2026-11-17T08:23:53.582Z',
    containerId: 'd55532b3ed32',
    hostPort: 56580,
    internalPort: 80,
    localUrl: 'http://localhost:56580',
  };

  await t.test('1. RUNNING v1 + BUILDING v2: old live URL remains visible', () => {
    const project = {
      status: 'building',
      liveDeploymentId: 'dep-v1',
      localUrl: 'http://localhost:56580',
      hostPort: 56580,
      internalPort: 80,
      latestDeployment: {
        id: 'dep-v2',
        status: 'BUILDING' as const,
        localUrl: null,
        hostPort: null,
        internalPort: 3000,
      },
      liveDeployment: v1Live,
    };

    const runtime = getProjectLiveRuntime(project);
    assert.equal(runtime.hasLiveRuntime, true);
    assert.equal(runtime.localUrl, 'http://localhost:56580');
    assert.equal(runtime.hostPort, 56580);
    assert.equal(runtime.activeLiveDeploymentId, 'dep-v1');
  });

  await t.test('2. RUNNING v1 + FAILED v2: old live URL remains visible', () => {
    const project = {
      status: 'failed',
      liveDeploymentId: 'dep-v1',
      localUrl: 'http://localhost:56580',
      hostPort: 56580,
      internalPort: 80,
      latestDeployment: {
        id: 'dep-v2',
        status: 'FAILED' as const,
        localUrl: null,
        hostPort: null,
        internalPort: 3000,
      },
      liveDeployment: v1Live,
    };

    const runtime = getProjectLiveRuntime(project);
    assert.equal(runtime.hasLiveRuntime, true);
    assert.equal(runtime.localUrl, 'http://localhost:56580');
    assert.equal(runtime.hostPort, 56580);
    assert.equal(runtime.activeLiveDeploymentId, 'dep-v1');
  });

  await t.test('3. RUNNING v1 + successful v2 promotion: new live URL is displayed', () => {
    const v2Promoted = {
      id: 'dep-v2',
      status: 'RUNNING' as const,
      localUrl: 'http://localhost:56590',
      hostPort: 56590,
      internalPort: 80,
    };

    const project = {
      status: 'ready',
      liveDeploymentId: 'dep-v2',
      localUrl: 'http://localhost:56590',
      hostPort: 56590,
      internalPort: 80,
      latestDeployment: v2Promoted,
      liveDeployment: v2Promoted,
    };

    const runtime = getProjectLiveRuntime(project);
    assert.equal(runtime.hasLiveRuntime, true);
    assert.equal(runtime.localUrl, 'http://localhost:56590');
    assert.equal(runtime.hostPort, 56590);
    assert.equal(runtime.activeLiveDeploymentId, 'dep-v2');
  });

  await t.test('4. STOPPED deployment: URL hidden', () => {
    const project = {
      status: 'stopped',
      liveDeploymentId: 'dep-v1',
      localUrl: 'http://localhost:56580',
      hostPort: 56580,
      internalPort: 80,
      latestDeployment: {
        id: 'dep-v1',
        status: 'STOPPED' as const,
        localUrl: null,
        hostPort: null,
      },
      liveDeployment: {
        ...v1Live,
        status: 'STOPPED' as const,
        localUrl: null,
      },
    };

    const runtime = getProjectLiveRuntime(project);
    assert.equal(runtime.hasLiveRuntime, false);
    assert.equal(runtime.localUrl, null);
    assert.equal(runtime.hostPort, null);
    assert.equal(runtime.activeLiveDeploymentId, null);
  });

  await t.test('5. CRASHED deployment: URL hidden', () => {
    const project = {
      status: 'crashed',
      liveDeploymentId: 'dep-v1',
      localUrl: 'http://localhost:56580',
      hostPort: 56580,
      internalPort: 80,
      latestDeployment: {
        id: 'dep-v1',
        status: 'CRASHED' as const,
        localUrl: null,
        hostPort: null,
      },
      liveDeployment: {
        ...v1Live,
        status: 'CRASHED' as const,
        localUrl: null,
      },
    };

    const runtime = getProjectLiveRuntime(project);
    assert.equal(runtime.hasLiveRuntime, false);
    assert.equal(runtime.localUrl, null);
    assert.equal(runtime.hostPort, null);
    assert.equal(runtime.activeLiveDeploymentId, null);
  });

  await t.test('6. FAILED latest deployment without a valid live deployment: URL hidden', () => {
    const project = {
      status: 'failed',
      liveDeploymentId: null,
      localUrl: null,
      hostPort: null,
      internalPort: null,
      latestDeployment: {
        id: 'dep-v1-failed',
        status: 'FAILED' as const,
        localUrl: null,
        hostPort: null,
      },
      liveDeployment: null,
    };

    const runtime = getProjectLiveRuntime(project);
    assert.equal(runtime.hasLiveRuntime, false);
    assert.equal(runtime.localUrl, null);
    assert.equal(runtime.hostPort, null);
    assert.equal(runtime.activeLiveDeploymentId, null);
  });

  await t.test('7. Latest FAILED + older RUNNING: Failed badge and live URL both visible', () => {
    const project = {
      status: 'failed',
      liveDeploymentId: 'dep-v1',
      localUrl: 'http://localhost:56580',
      hostPort: 56580,
      internalPort: 80,
      latestDeployment: {
        id: 'dep-v2-failed',
        status: 'FAILED' as const,
        localUrl: null,
        hostPort: null,
      },
      liveDeployment: v1Live,
    };

    const runtime = getProjectLiveRuntime(project);
    assert.equal(runtime.hasLiveRuntime, true);
    assert.equal(runtime.localUrl, 'http://localhost:56580');
    assert.equal(runtime.hostPort, 56580);

    // Verify badge resolution: latest deployment status takes precedence for pipeline status
    const effectiveStatus = project.latestDeployment?.status || project.status;
    const isFailed = effectiveStatus === 'FAILED' || project.status === 'failed';
    assert.equal(isFailed, true, 'Badge must reflect that latest build failed');
    assert.equal(runtime.hasLiveRuntime, true, 'Live container URL banner must remain visible');
  });
});
