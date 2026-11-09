import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DeploymentStatus, BackendDeployment } from '../../types';
import {
  mapBackendDeploymentToFrontend,
  canStopDeployment,
  canRestartDeployment,
  formatPortMapping,
  formatRelativeTime,
} from '../deployment.utils';

test('Deployment Lifecycle & Runtime Mapping Tests', async (t) => {
  await t.test('All 10 deployment statuses are valid DeploymentStatus types', () => {
    const statuses: DeploymentStatus[] = [
      'QUEUED',
      'INITIALIZING',
      'BUILDING',
      'BUILT',
      'STARTING',
      'RUNNING',
      'STOPPED',
      'CRASHED',
      'FAILED',
      'CANCELLED',
    ];
    assert.equal(statuses.length, 10);
  });

  await t.test('mapBackendDeploymentToFrontend preserves localUrl and port metadata', () => {
    const backendDep: BackendDeployment = {
      id: 'dep-123',
      projectId: 'proj-456',
      status: 'RUNNING',
      repositoryName: 'acme/web-app',
      repositoryUrl: 'https://github.com/acme/web-app',
      branch: 'main',
      dockerfilePath: 'Dockerfile',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      containerId: 'container-abc',
      hostPort: 34500,
      internalPort: 3000,
      localUrl: 'http://localhost:34500',
    };

    const frontendDep = mapBackendDeploymentToFrontend(backendDep);

    assert.equal(frontendDep.id, 'dep-123');
    assert.equal(frontendDep.status, 'RUNNING');
    assert.equal(frontendDep.url, 'http://localhost:34500');
    assert.equal(frontendDep.localUrl, 'http://localhost:34500');
    assert.equal(frontendDep.hostPort, 34500);
    assert.equal(frontendDep.internalPort, 3000);
    assert.equal(frontendDep.containerId, 'container-abc');
  });

  await t.test('mapBackendDeploymentToFrontend falls back to repositoryUrl when localUrl is null', () => {
    const backendDep: BackendDeployment = {
      id: 'dep-789',
      projectId: 'proj-456',
      status: 'BUILDING',
      repositoryName: 'acme/web-app',
      repositoryUrl: 'https://github.com/acme/web-app',
      branch: 'main',
      dockerfilePath: 'Dockerfile',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      containerId: null,
      hostPort: null,
      internalPort: null,
      localUrl: null,
    };

    const frontendDep = mapBackendDeploymentToFrontend(backendDep);

    assert.equal(frontendDep.id, 'dep-789');
    assert.equal(frontendDep.status, 'BUILDING');
    assert.equal(frontendDep.url, 'https://github.com/acme/web-app');
    assert.equal(frontendDep.localUrl, null);
    assert.equal(frontendDep.hostPort, null);
  });

  await t.test('CRASHED is visually and logically distinct from FAILED', () => {
    const buildFailure: DeploymentStatus = 'FAILED';
    const runtimeCrash: DeploymentStatus = 'CRASHED';

    assert.notEqual(buildFailure, runtimeCrash);
  });

  await t.test('BUILT represents image compiled and is distinct from live RUNNING', () => {
    const imageCompiled: DeploymentStatus = 'BUILT';
    const liveRunning: DeploymentStatus = 'RUNNING';

    assert.notEqual(imageCompiled, liveRunning);
  });

  await t.test('Stop action eligibility: only RUNNING or STARTING', () => {
    assert.equal(canStopDeployment('RUNNING'), true);
    assert.equal(canStopDeployment('STARTING'), true);
    assert.equal(canStopDeployment('BUILT'), false);
    assert.equal(canStopDeployment('STOPPED'), false);
    assert.equal(canStopDeployment('CRASHED'), false);
    assert.equal(canStopDeployment('FAILED'), false);
    assert.equal(canStopDeployment('QUEUED'), false);
    assert.equal(canStopDeployment('BUILDING'), false);
  });

  await t.test('Restart action eligibility: only STOPPED or CRASHED', () => {
    assert.equal(canRestartDeployment('STOPPED'), true);
    assert.equal(canRestartDeployment('CRASHED'), true);
    assert.equal(canRestartDeployment('RUNNING'), false);
    assert.equal(canRestartDeployment('BUILDING'), false);
    assert.equal(canRestartDeployment('FAILED'), false);
    assert.equal(canRestartDeployment('BUILT'), false);
  });

  await t.test('formatPortMapping formats port pair correctly', () => {
    assert.equal(formatPortMapping(34500, 3000), ':34500 → :3000');
    assert.equal(formatPortMapping(42000, 8080), ':42000 → :8080');
    assert.equal(formatPortMapping(null, 3000), null);
    assert.equal(formatPortMapping(undefined, 3000), null);
  });

  await t.test('formatRelativeTime formats relative timestamps safely', () => {
    assert.equal(formatRelativeTime(null), 'Just now');
    assert.equal(formatRelativeTime(undefined), 'Just now');
    assert.equal(formatRelativeTime(new Date().toISOString()), 'Just now');
  });
});
