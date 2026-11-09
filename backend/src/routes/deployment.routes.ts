import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import {
  getDeploymentById,
  getDeploymentLogs,
  getDeploymentRawLogs,
  cancelDeployment,
  getDeploymentRuntime,
  getDeploymentRuntimeLogs,
  stopDeploymentHandler,
  restartDeploymentHandler,
} from "../controllers/deployment.controller";
import { queryDeploymentAiHandler } from "../controllers/ai.controller";

const router = Router();

router.use(authenticate);

router.get("/:deploymentId/logs/raw", getDeploymentRawLogs);
router.get("/:deploymentId/logs", getDeploymentLogs);
router.get("/:deploymentId/runtime", getDeploymentRuntime);
router.get("/:deploymentId/runtime-logs", getDeploymentRuntimeLogs);
router.get("/:deploymentId", getDeploymentById);
router.post("/:deploymentId/cancel", cancelDeployment);
router.post("/:deploymentId/stop", stopDeploymentHandler);
router.post("/:deploymentId/restart", (req, res) => { restartDeploymentHandler(req, res); });
router.post("/:deploymentId/ai/query", queryDeploymentAiHandler);

export default router;
