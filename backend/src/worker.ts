import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config();

import prisma from "./lib/prisma";
import { DeploymentWorker, deploymentWorker } from "./services/deployment.worker";
import { verifyDockerDaemon } from "./services/docker.service";
import { encryptToken, decryptToken } from "./utils/crypto";
import { sanitizeErrorMessage } from "./utils/sanitizer";

export interface WorkerEnvironmentValidation {
  valid: boolean;
  errors: string[];
}

export interface WorkerPreflightOptions {
  env?: NodeJS.ProcessEnv;
  checkDatabase?: () => Promise<void>;
  checkDocker?: () => Promise<void>;
}

export interface StandaloneWorkerOptions {
  worker?: DeploymentWorker;
  runtimeDir?: string;
  preflights?: WorkerPreflightOptions;
  pollStopSignalMs?: number;
  disconnectDb?: () => Promise<void>;
  registerSignalHandlers?: boolean;
  onExit?: (code: number) => void;
}

export interface StandaloneWorkerHandle {
  worker: DeploymentWorker;
  pidFile: string;
  stopFile: string;
  shutdown: (reason?: string) => Promise<void>;
}

function redactConnectionStrings(message: string): string {
  return message.replace(/postgres(?:ql)?:\/\/[^\s@]+@/gi, "postgresql://[REDACTED]@");
}

/**
 * Validates required environment variables for standalone worker execution without exposing secret values.
 */
export function validateWorkerEnvironment(
  env: NodeJS.ProcessEnv = process.env
): WorkerEnvironmentValidation {
  const errors: string[] = [];

  const databaseUrl = env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    errors.push("DATABASE_URL is missing or empty.");
  } else {
    try {
      const parsed = new URL(databaseUrl);
      if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
        errors.push("DATABASE_URL must use a postgresql:// or postgres:// protocol.");
      }
    } catch {
      errors.push("DATABASE_URL is not a valid URL.");
    }
  }

  const encryptionKey = env.ENCRYPTION_KEY;
  if (!encryptionKey || !encryptionKey.trim()) {
    errors.push("ENCRYPTION_KEY is missing or empty.");
  } else {
    const isHex64 = /^[0-9a-fA-F]{64}$/.test(encryptionKey);
    const isUtf832 = Buffer.byteLength(encryptionKey, "utf8") === 32;

    if (!isHex64 && !isUtf832) {
      errors.push("ENCRYPTION_KEY must be a 64-character hex key or a 32-byte UTF-8 key.");
    } else if (env === process.env) {
      try {
        const encrypted = encryptToken("havn-worker-preflight");
        if (decryptToken(encrypted) !== "havn-worker-preflight") {
          errors.push("ENCRYPTION_KEY failed cipher round-trip verification.");
        }
      } catch {
        errors.push("ENCRYPTION_KEY failed cipher initialization.");
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Runs environment, PostgreSQL connectivity, and local Docker daemon preflight checks before claiming jobs.
 */
export async function runWorkerPreflights(
  options: WorkerPreflightOptions = {}
): Promise<void> {
  const env = options.env || process.env;
  const envValidation = validateWorkerEnvironment(env);

  if (!envValidation.valid) {
    throw new Error(`Worker environment validation failed: ${envValidation.errors.join(" ")}`);
  }

  const checkDatabase =
    options.checkDatabase ||
    (async () => {
      await prisma.$queryRaw`SELECT 1`;
    });

  try {
    await checkDatabase();
  } catch (err: any) {
    const safeMsg = redactConnectionStrings(sanitizeErrorMessage(err));
    throw new Error(`PostgreSQL connectivity check failed: ${safeMsg}`);
  }

  const checkDocker = options.checkDocker || verifyDockerDaemon;

  try {
    await checkDocker();
  } catch (err: any) {
    const safeMsg = sanitizeErrorMessage(err);
    throw new Error(`Docker daemon availability check failed: ${safeMsg}`);
  }
}

/**
 * Starts the standalone HAVN DeploymentWorker process with preflight checks and cross-platform stop handling.
 */
export async function startStandaloneWorker(
  options: StandaloneWorkerOptions = {}
): Promise<StandaloneWorkerHandle> {
  const env = options.preflights?.env || process.env;
  const explicitFlag = env.ENABLE_DEPLOYMENT_WORKER?.trim().toLowerCase();

  if (explicitFlag === "false" || explicitFlag === "0" || explicitFlag === "no") {
    throw new Error("Standalone worker cannot start when ENABLE_DEPLOYMENT_WORKER is disabled.");
  }

  env.ENABLE_DEPLOYMENT_WORKER = "true";

  await runWorkerPreflights({
    ...options.preflights,
    env,
  });

  const worker = options.worker || deploymentWorker;
  const runtimeDir = options.runtimeDir || path.resolve(__dirname, "../scratch");
  const pidFile = path.join(runtimeDir, "worker.pid");
  const stopFile = path.join(runtimeDir, "worker.stop");
  const pollStopSignalMs = options.pollStopSignalMs ?? 500;
  const disconnectDb = options.disconnectDb || (() => prisma.$disconnect());

  fs.mkdirSync(runtimeDir, { recursive: true });
  fs.rmSync(stopFile, { force: true });
  fs.writeFileSync(pidFile, String(process.pid), "utf8");

  let shutdownPromise: Promise<void> | null = null;
  let stopPollTimer: NodeJS.Timeout | null = null;

  const onSigInt = () => {
    void shutdown("SIGINT");
  };
  const onSigTerm = () => {
    void shutdown("SIGTERM");
  };

  const shutdown = async (reason = "shutdown"): Promise<void> => {
    if (shutdownPromise) {
      return shutdownPromise;
    }

    shutdownPromise = (async () => {
      console.log(`[WorkerEntrypoint] Stopping DeploymentWorker (${worker.workerId}) due to ${reason}...`);
      if (stopPollTimer) {
        clearInterval(stopPollTimer);
        stopPollTimer = null;
      }

      if (options.registerSignalHandlers) {
        process.removeListener("SIGINT", onSigInt);
        process.removeListener("SIGTERM", onSigTerm);
      }

      worker.stop();

      try {
        await disconnectDb();
      } catch (err: any) {
        console.warn(`[WorkerEntrypoint] Prisma disconnect warning: ${sanitizeErrorMessage(err)}`);
      }

      fs.rmSync(pidFile, { force: true });
      fs.rmSync(stopFile, { force: true });

      console.log(`[WorkerEntrypoint] DeploymentWorker (${worker.workerId}) stopped cleanly.`);
      if (options.onExit) {
        options.onExit(0);
      }
    })();

    return shutdownPromise;
  };

  if (options.registerSignalHandlers) {
    process.on("SIGINT", onSigInt);
    process.on("SIGTERM", onSigTerm);
  }

  stopPollTimer = setInterval(() => {
    if (fs.existsSync(stopFile)) {
      void shutdown("stop-signal-file");
    }
  }, pollStopSignalMs);
  stopPollTimer.unref();

  try {
    await worker.start();
    console.log(
      `[WorkerEntrypoint] DeploymentWorker (${worker.workerId}) active with local Docker daemon verified.`
    );
  } catch (err) {
    if (stopPollTimer) {
      clearInterval(stopPollTimer);
      stopPollTimer = null;
    }
    if (options.registerSignalHandlers) {
      process.removeListener("SIGINT", onSigInt);
      process.removeListener("SIGTERM", onSigTerm);
    }
    fs.rmSync(pidFile, { force: true });
    fs.rmSync(stopFile, { force: true });
    throw err;
  }

  return {
    worker,
    pidFile,
    stopFile,
    shutdown,
  };
}

const isMainModule =
  typeof require !== "undefined" &&
  typeof module !== "undefined" &&
  require.main === module;

if (isMainModule) {
  startStandaloneWorker({
    registerSignalHandlers: true,
    onExit: (code) => process.exit(code),
  }).catch(async (err: any) => {
    const safeMsg = redactConnectionStrings(sanitizeErrorMessage(err));
    console.error(`[WorkerEntrypoint] Fatal startup error: ${safeMsg}`);
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  });
}
