import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject,
} from "../controllers/project.controller";
import {
  createDeployment,
  getProjectDeployments,
} from "../controllers/deployment.controller";
import {
  validateCreateProject,
  validateUpdateProject,
} from "../middleware/validation.middleware";
import { deploymentCreationLimiter } from "../middleware/rateLimit.middleware";

const router = Router();

router.use(authenticate);

router.post("/", validateCreateProject, createProject);
router.get("/", getProjects);
router.get("/:id", getProjectById);
router.patch("/:id", validateUpdateProject, updateProject);
router.delete("/:id", deleteProject);

// Phase 1.4 Deployment endpoints scoped to Project
router.post("/:projectId/deployments", deploymentCreationLimiter, createDeployment);
router.get("/:projectId/deployments", getProjectDeployments);

export default router;