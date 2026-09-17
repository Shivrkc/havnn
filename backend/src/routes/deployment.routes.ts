import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import {
  getDeploymentById,
  getDeploymentLogs,
  getDeploymentRawLogs,
  cancelDeployment,
} from "../controllers/deployment.controller";
import { queryDeploymentAiHandler } from "../controllers/ai.controller";

const router = Router();

router.use(authenticate);

router.get("/:deploymentId/logs/raw", getDeploymentRawLogs);
router.get("/:deploymentId/logs", getDeploymentLogs);
router.get("/:deploymentId", getDeploymentById);
router.post("/:deploymentId/cancel", cancelDeployment);
router.post("/:deploymentId/ai/query", queryDeploymentAiHandler);

export default router;
