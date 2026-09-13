import { Request, Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import * as githubService from "../services/github.service";

export const connectGithub = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized user.",
      });
    }

    const authUrl = await githubService.generateConnectUrl(userId);

    // If client requested JSON (e.g. authenticated Axios call from frontend), return the URL as JSON
    if (req.headers.accept?.includes("application/json") || req.xhr) {
      return res.status(200).json({
        success: true,
        url: authUrl,
      });
    }

    return res.redirect(authUrl);
  } catch (error: any) {
    console.error("GitHub OAuth initiation failed:", error.message || "Unknown error");

    return res.status(500).json({
      success: false,
      message: "Failed to initiate GitHub OAuth connection.",
    });
  }
};

export const githubCallback = async (req: Request, res: Response) => {
  const frontendUrl =
    process.env.FRONTEND_URL || "http://localhost:3000";

  // GitHub denied or cancelled the OAuth request
  if (typeof req.query.error === "string") {
    return res.redirect(
      `${frontendUrl}/dashboard?github_error=access_denied`
    );
  }

  const { code, state } = req.query;

  // Validate callback parameters
  if (
    typeof code !== "string" ||
    typeof state !== "string" ||
    !code ||
    !state
  ) {
    return res.redirect(
      `${frontendUrl}/dashboard?github_error=connection_failed`
    );
  }

  try {
    await githubService.handleCallback(code, state);

    return res.redirect(
      `${frontendUrl}/dashboard?github_success=connected`
    );
  } catch (error: any) {
    console.error("GitHub OAuth callback failed:", error.message || "Unknown error");

    if (error.message === "ACCOUNT_ALREADY_LINKED" || error.code === "ACCOUNT_ALREADY_LINKED") {
      return res.redirect(
        `${frontendUrl}/dashboard?github_error=account_already_linked`
      );
    }

    return res.redirect(
      `${frontendUrl}/dashboard?github_error=connection_failed`
    );
  }
};

export const githubStatus = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized user.",
      });
    }

    const status = await githubService.getGithubStatus(userId);

    return res.status(200).json({
      success: true,
      ...status,
    });
  } catch (error) {
    console.error("GitHub status error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch GitHub connection status.",
    });
  }
};

export const githubRepositories = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized user.",
      });
    }

    const pageQuery = req.query.page;
    const perPageQuery = req.query.per_page;
    const maxPagesQuery = req.query.max_pages;

    const page = typeof pageQuery === "string" ? parseInt(pageQuery, 10) : undefined;
    const perPage = typeof perPageQuery === "string" ? parseInt(perPageQuery, 10) : undefined;
    const maxPages = typeof maxPagesQuery === "string" ? parseInt(maxPagesQuery, 10) : undefined;

    const repositories = await githubService.getGithubRepositories(userId, {
      page: page && !isNaN(page) ? page : undefined,
      perPage: perPage && !isNaN(perPage) ? perPage : undefined,
      maxPages: maxPages && !isNaN(maxPages) ? maxPages : undefined,
    });

    return res.status(200).json({
      success: true,
      repositories,
    });
  } catch (error: any) {
    if (error.response?.status === 401) {
      return res.status(401).json({
        success: false,
        message:
          "GitHub access token has expired or is invalid. Please reconnect your GitHub account.",
        requiresReconnect: true,
      });
    }

    console.error("GitHub repositories error:", error.message || "Unknown error");

    return res.status(500).json({
      success: false,
      message: "Failed to fetch GitHub repositories.",
    });
  }
};

export const githubBranches = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized user.",
      });
    }

    const { owner, repo } = req.params;

    if (
      typeof owner !== "string" ||
      typeof repo !== "string" ||
      !owner ||
      !repo
    ) {
      return res.status(400).json({
        success: false,
        message: "Repository owner and name are required.",
      });
    }

    const branches = await githubService.getGithubBranches(
      userId,
      owner,
      repo
    );

    return res.status(200).json({
      success: true,
      branches,
    });
  } catch (error: any) {
    if (error.response?.status === 401) {
      return res.status(401).json({
        success: false,
        message:
          "GitHub access token has expired or is invalid. Please reconnect your GitHub account.",
        requiresReconnect: true,
      });
    }

    console.error("GitHub branches error:", error.message || "Unknown error");

    return res.status(500).json({
      success: false,
      message: "Failed to fetch GitHub branches.",
    });
  }
};

export const disconnectGithub = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized user.",
      });
    }

    await githubService.disconnectGithub(userId);

    return res.status(200).json({
      success: true,
      message: "GitHub account disconnected successfully.",
    });
  } catch (error: any) {
    console.error("Disconnect GitHub error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to disconnect GitHub account.",
    });
  }
};