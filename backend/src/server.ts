import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config();

import app from "./app";
import { deploymentWorker, isDeploymentWorkerEnabled } from "./services/deployment.worker";

const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  console.log(`HAVN Backend API listening on port ${PORT}`);
  if (!isDeploymentWorkerEnabled()) {
    deploymentWorker.stop();
    console.log("Deployment Worker disabled in API-only mode (ENABLE_DEPLOYMENT_WORKER!=true).");
    return;
  }

  try {
    await deploymentWorker.start();
    console.log(`Deployment Worker (${deploymentWorker.workerId}) active`);
  } catch (err) {
    console.error("Failed to start Deployment Worker:", err);
  }
});