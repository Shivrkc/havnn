import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DeploymentStatus, BackendDeployment } from '../../types';

/**
 * Pure lifecycle state machine representing the state-driven polling logic
 * used in DeploymentConsolePage and BuildLogModal.
 */
class DeploymentPollingController {
  public status: DeploymentStatus;
  public isTerminal: boolean;
  public activeIntervalsCount = 0;
  public inFlightRequestsCount = 0;
  public logs: { id: string; sequence: number; line: string }[] = [];
  public lastSequence = 0;
  public generation = 0;
  public pollExecutionCount = 0;
  private isPolling = false;

  constructor(initialStatus: DeploymentStatus) {
    this.status = initialStatus;
    this.isTerminal = this.isTerminalStatus(initialStatus);
    this.syncPollingState();
  }

  public isTerminalStatus(s: DeploymentStatus): boolean {
    return s === 'STOPPED' || s === 'CRASHED' || s === 'FAILED' || s === 'CANCELLED';
  }

  public shouldPoll(): boolean {
    return !this.isTerminal;
  }

  private syncPollingState(): void {
    if (this.shouldPoll()) {
      // Ensure only 1 interval exists (prevent duplicates)
      if (this.activeIntervalsCount === 0) {
        this.activeIntervalsCount = 1;
      }
    } else {
      // Terminal state -> clear interval
      this.activeIntervalsCount = 0;
    }
  }

  /**
   * Simulates a tick of the polling function with concurrency guard and generation tracking.
   */
  public async executePoll(
    simulatedResponse: {
      status: DeploymentStatus;
      isTerminal: boolean;
      logs: { id: string; sequence: number; line: string }[];
      requestGeneration: number;
    },
    delayMs = 0
  ): Promise<{ applied: boolean; reason?: string }> {
    // 1. In-flight mutex guard: reject overlapping request executions
    if (this.isPolling) {
      return { applied: false, reason: 'OVERLAPPING_REQUEST_PREVENTED' };
    }

    this.isPolling = true;
    this.inFlightRequestsCount++;

    try {
      if (delayMs > 0) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
      this.pollExecutionCount++;

      // 2. Stale state check: reject responses from older generation (prior to restart)
      if (simulatedResponse.requestGeneration !== this.generation) {
        return { applied: false, reason: 'STALE_RESPONSE_IGNORED' };
      }

      // 3. Apply logs
      if (simulatedResponse.logs.length > 0) {
        const existingIds = new Set(this.logs.map((l) => l.id));
        const newLogs = simulatedResponse.logs.filter((l) => !existingIds.has(l.id));
        this.logs.push(...newLogs);
        const maxSeq = Math.max(...simulatedResponse.logs.map((l) => l.sequence));
        if (maxSeq > this.lastSequence) {
          this.lastSequence = maxSeq;
        }
      }

      // 4. Update status & terminal state
      this.status = simulatedResponse.status;
      if (this.isTerminalStatus(simulatedResponse.status) || simulatedResponse.isTerminal) {
        this.isTerminal = true;
      }

      this.syncPollingState();
      return { applied: true };
    } finally {
      this.isPolling = false;
      this.inFlightRequestsCount = Math.max(0, this.inFlightRequestsCount - 1);
    }
  }

  /**
   * Simulates user triggering restart on stopped/crashed deployment.
   */
  public restart(): void {
    if (!this.isTerminalStatus(this.status)) {
      throw new Error(`Cannot restart deployment in active status ${this.status}`);
    }

    this.generation++;
    this.status = 'QUEUED';
    this.isTerminal = false;
    this.lastSequence = 0;
    this.logs = [];

    // State-driven effect automatically reactivates interval
    this.syncPollingState();
  }

  /**
   * Simulates component unmount.
   */
  public unmount(): void {
    this.activeIntervalsCount = 0;
  }
}

test('Phase 4.1: State-Driven Polling Lifecycle Regression Suite', async (t) => {
  await t.test('1. Polling starts active for in-flight statuses and ceases at terminal state', () => {
    const activeStatuses: DeploymentStatus[] = ['QUEUED', 'INITIALIZING', 'BUILDING', 'BUILT', 'STARTING'];
    for (const status of activeStatuses) {
      const controller = new DeploymentPollingController(status);
      assert.equal(controller.shouldPoll(), true, `Status ${status} must maintain active polling`);
      assert.equal(controller.activeIntervalsCount, 1, `Status ${status} must have exactly 1 active interval`);
    }

    const terminalStatuses: DeploymentStatus[] = ['STOPPED', 'CRASHED', 'FAILED', 'CANCELLED'];
    for (const status of terminalStatuses) {
      const controller = new DeploymentPollingController(status);
      assert.equal(controller.shouldPoll(), false, `Status ${status} must NOT poll`);
      assert.equal(controller.activeIntervalsCount, 0, `Status ${status} must have 0 intervals`);
    }
  });

  await t.test('2. Polling automatically stops when poll response reports terminal state', async () => {
    const controller = new DeploymentPollingController('BUILDING');
    assert.equal(controller.activeIntervalsCount, 1);

    const pollResult = await controller.executePoll({
      status: 'CRASHED',
      isTerminal: true,
      logs: [{ id: 'log-1', sequence: 1, line: 'Process exited with code 137' }],
      requestGeneration: 0,
    });

    assert.equal(pollResult.applied, true);
    assert.equal(controller.status, 'CRASHED');
    assert.equal(controller.isTerminal, true);
    assert.equal(controller.activeIntervalsCount, 0, 'Interval must be cleared upon reaching terminal state');
  });

  await t.test('3. Restart reactivates polling automatically and resets sequence state', async () => {
    const controller = new DeploymentPollingController('STOPPED');
    assert.equal(controller.activeIntervalsCount, 0, 'Stopped deployment must not have active interval');

    // Trigger restart
    controller.restart();

    assert.equal(controller.status, 'QUEUED', 'Status must transition to QUEUED');
    assert.equal(controller.isTerminal, false, 'isTerminal must flip to false');
    assert.equal(controller.activeIntervalsCount, 1, 'Polling interval must automatically reactivate');
    assert.equal(controller.lastSequence, 0, 'lastSequence must be reset to 0');
    assert.equal(controller.logs.length, 0, 'Logs must be reset for new run');
    assert.equal(controller.generation, 1, 'Generation must increment');

    // Polling receives new logs from new run
    const pollResult = await controller.executePoll({
      status: 'STARTING',
      isTerminal: false,
      logs: [{ id: 'new-log-1', sequence: 1, line: '[SYSTEM] Starting container...' }],
      requestGeneration: 1,
    });

    assert.equal(pollResult.applied, true);
    assert.equal(controller.status, 'STARTING');
    assert.equal(controller.activeIntervalsCount, 1, 'Interval remains active through STARTING');
    assert.equal(controller.logs.length, 1);
  });

  await t.test('4. In-flight mutex prevents overlapping concurrent poll executions', async () => {
    const controller = new DeploymentPollingController('BUILDING');

    // Simulate an execution that is slow
    const slowExecution = controller.executePoll(
      {
        status: 'BUILDING',
        isTerminal: false,
        logs: [{ id: 'log-1', sequence: 1, line: 'Step 1' }],
        requestGeneration: 0,
      },
      50
    );

    // Attempt second poll while first is in-flight
    const duplicateExecution = await controller.executePoll({
      status: 'BUILDING',
      isTerminal: false,
      logs: [{ id: 'log-2', sequence: 2, line: 'Step 2' }],
      requestGeneration: 0,
    });

    assert.equal(duplicateExecution.applied, false);
    assert.equal(duplicateExecution.reason, 'OVERLAPPING_REQUEST_PREVENTED');

    await slowExecution;
  });

  await t.test('5. Stale in-flight response from before restart is safely dropped', async () => {
    const controller = new DeploymentPollingController('STOPPED');

    // An in-flight request was initiated prior to restart (generation 0)
    const staleRequestGeneration = controller.generation; // 0

    // User restarts the deployment -> generation increments to 1
    controller.restart();
    assert.equal(controller.generation, 1);
    assert.equal(controller.status, 'QUEUED');

    // The delayed stale response from generation 0 arrives
    const staleResult = await controller.executePoll({
      status: 'STOPPED',
      isTerminal: true,
      logs: [{ id: 'old-log', sequence: 99, line: 'Old stopped log' }],
      requestGeneration: staleRequestGeneration,
    });

    assert.equal(staleResult.applied, false);
    assert.equal(staleResult.reason, 'STALE_RESPONSE_IGNORED');

    // Invariant: Controller status remains QUEUED, logs remain empty
    assert.equal(controller.status, 'QUEUED', 'Stale response must NOT overwrite QUEUED status');
    assert.equal(controller.isTerminal, false, 'Stale response must NOT mark restarted deployment terminal');
    assert.equal(controller.logs.length, 0, 'Stale logs must NOT be appended to restarted deployment');
  });

  await t.test('6. Unmount cleanly disposes interval and stops polling', () => {
    const controller = new DeploymentPollingController('BUILDING');
    assert.equal(controller.activeIntervalsCount, 1);

    controller.unmount();
    assert.equal(controller.activeIntervalsCount, 0, 'Unmount must clean up all intervals');
  });
});
