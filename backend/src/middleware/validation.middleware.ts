import { Request, Response, NextFunction } from "express";
import { z } from "zod";

const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must be less than 50 characters"),

  email: z
    .string()
    .trim()
    .email("Please enter a valid email address")
    .toLowerCase(),

  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password is too long"),
}).strict();

export const validateRegister = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const result = registerSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid registration data",
      errors: result.error.flatten().fieldErrors,
    });
  }

  req.body = result.data;
  next();
};

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Please enter a valid email address")
    .toLowerCase(),

  password: z
    .string()
    .min(1, "Password is required")
    .max(128, "Password is too long"),

  rememberMe: z.boolean().optional(),
});

export const validateLogin = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const result = loginSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid login data",
      errors: result.error.flatten().fieldErrors,
    });
  }

  req.body = result.data;
  next();
};

const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Please enter a valid email address")
    .toLowerCase(),
});

export const validateForgotPassword = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const result = forgotPasswordSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Please provide a valid email address.",
      errors: result.error.flatten().fieldErrors,
    });
  }

  req.body = result.data;
  next();
};

const resetPasswordSchema = z.object({
  token: z
    .string()
    .trim()
    .min(1, "Reset token is required"),

  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .max(128, "Password must not exceed 128 characters"),
});

export const validateResetPassword = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const result = resetPasswordSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid password reset data.",
      errors: result.error.flatten().fieldErrors,
    });
  }

  req.body = result.data;
  next();
};

const changePasswordSchema = z.object({
  currentPassword: z
    .string()
    .min(1, "Current password is required")
    .max(128, "Current password is too long"),

  newPassword: z
    .string()
    .min(8, "New password must be at least 8 characters long")
    .max(128, "New password must not exceed 128 characters"),
});

export const validateChangePassword = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const result = changePasswordSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid password change data.",
      errors: result.error.flatten().fieldErrors,
    });
  }

  req.body = result.data;
  next();
};

const createProjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Project name must be at least 2 characters")
    .max(100, "Project name must not exceed 100 characters"),

  description: z.string().max(500, "Description must not exceed 500 characters").optional().nullable(),
  repositoryName: z.string().max(200, "Repository name must not exceed 200 characters").optional().nullable(),
  repositoryUrl: z
    .string()
    .max(500, "Repository URL must not exceed 500 characters")
    .regex(/^https:\/\/github\.com\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+(?:\.git)?$/, "Must be a valid GitHub repository URL (https://github.com/owner/repo)")
    .optional()
    .nullable()
    .or(z.literal("")),
  branch: z
    .string()
    .max(100, "Branch name must not exceed 100 characters")
    .regex(/^[a-zA-Z0-9_./-]+$/, "Branch name contains invalid characters")
    .optional()
    .nullable(),
  status: z.string().max(50).optional().nullable(),
});

export const validateCreateProject = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const result = createProjectSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid project data",
      errors: result.error.flatten().fieldErrors,
    });
  }

  req.body = result.data;
  next();
};

const updateProjectSchema = createProjectSchema.partial();

export const validateUpdateProject = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const result = updateProjectSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid project update data",
      errors: result.error.flatten().fieldErrors,
    });
  }

  req.body = result.data;
  next();
};