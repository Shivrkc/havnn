import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config();

import app from "./app";
import { deploymentWorker } from "./services/deployment.worker";

const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  console.log(`🚀 CloudForge Backend running on http://localhost:${PORT}`);
  try {
    await deploymentWorker.start();
    console.log(`👷 Deployment Worker (${deploymentWorker.workerId}) active`);
  } catch (err) {
    console.error("Failed to start Deployment Worker:", err);
  }
});