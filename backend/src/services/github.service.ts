import crypto from "crypto";
import axios from "axios";
import prisma from "../lib/prisma";
import { encryptToken,  decryptToken } from "../utils/crypto";

/**
 * Generates a cryptographically random OAuth state for the user and stores its SHA-256 hash in DB.
 */
export const generateConnectUrl = async (userId: string): Promise<string> => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    throw new Error("GITHUB_CLIENT_ID environment variable is missing.");
  }

  // Generate cryptographically random token (32 bytes = 64 hex chars)
  const rawState = crypto.randomBytes(32).toString("hex");
  const stateHash = crypto.createHash("sha256").update(rawState).digest("hex");

  // Clean up any stale states for this user
  await prisma.githubOauthState.deleteMany({
    where: { userId },
  });

  // Store state hash in DB (valid for 10 minutes)
  await prisma.githubOauthState.create({
    data: {
      stateHash,
      userId,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });

  const params = new URLSearchParams({
    client_id: clientId,
    scope: "repo",
    state: rawState,
    prompt: "select_account",
  });

  return `https://github.com/login/oauth/authorize?${params.toString()}`;
};

/**
 * Validates OAuth state (checking existence and expiry), consumes it once,
 * exchanges authorization code for access token, fetches user profile, and saves encrypted token.
 */
export const handleCallback = async (code: string, state: string): Promise<void> => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("GitHub OAuth environment variables missing.");
  }

  // Hash incoming raw state to look up stored record
  const stateHash = crypto.createHash("sha256").update(state).digest("hex");

  const stateRecord = await prisma.githubOauthState.findUnique({
    where: { stateHash },
  });

  if (!stateRecord) {
    throw new Error("Invalid or missing OAuth state.");
  }

  // Verify expiry BEFORE consuming/deleting the state
  if (stateRecord.expiresAt < new Date()) {
    // Clean up expired state record
    await prisma.githubOauthState.deleteMany({
      where: { id: stateRecord.id },
    });
    throw new Error("OAuth state has expired.");
  }

  // Atomically consume valid state exactly once
  const deleteResult = await prisma.githubOauthState.deleteMany({
    where: {
      id: stateRecord.id,
      stateHash,
      expiresAt: { gte: new Date() },
    },
  });

  if (deleteResult.count !== 1) {
    throw new Error("Invalid or missing OAuth state.");
  }

  const userId = stateRecord.userId;

  // Exchange authorization code for access token
  const tokenResponse = await axios.post(
    "https://github.com/login/oauth/access_token",
    {
      client_id: clientId,
      client_secret: clientSecret,
      code,
    },
    {
      headers: {
        Accept: "application/json",
      },
    }
  );

  const { access_token, scope, error } = tokenResponse.data;

  if (error || !access_token) {
    throw new Error("Failed to exchange code for GitHub access token.");
  }

  // Fetch GitHub user profile
  const userResponse = await axios.get("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${access_token}`,
      "User-Agent": "HAVN-App",
    },
  });

  const { id: githubUserIdNum, login: githubUsername } = userResponse.data;

  if (!githubUserIdNum || !githubUsername) {
    throw new Error("Failed to retrieve GitHub profile details.");
  }

  const githubUserId = String(githubUserIdNum);
  const encryptedAccessToken = encryptToken(access_token);

  // Check whether this GitHub account is already connected to another HAVN user
  const existingGithubAccount = await prisma.githubAccount.findUnique({
    where: { githubUserId },
  });

  if (existingGithubAccount && existingGithubAccount.userId !== userId) {
    const error = new Error("ACCOUNT_ALREADY_LINKED");
    (error as any).code = "ACCOUNT_ALREADY_LINKED";
    throw error;
  }

  // Safe to connect/refresh for current user:
  // If the same user already has this GitHub account (or another), upsert updates it.
  await prisma.githubAccount.upsert({
    where: { userId },
    update: {
      githubUserId,
      githubUsername,
      accessToken: encryptedAccessToken,
      scope: scope || "repo",
    },
    create: {
      userId,
      githubUserId,
      githubUsername,
      accessToken: encryptedAccessToken,
      scope: scope || "repo",
    },
  });
};

export const getGithubStatus = async (userId: string) => {
  const githubAccount = await prisma.githubAccount.findUnique({
    where: { userId },
    select: {
      githubUsername: true,
      githubUserId: true,
      scope: true,
    },
  });

  if (!githubAccount) {
    return {
      connected: false,
      github: null,
    };
  }

  return {
    connected: true,
    github: {
      username: githubAccount.githubUsername,
      githubUserId: githubAccount.githubUserId,
      scope: githubAccount.scope,
    },
  };
};

export interface GetGithubRepositoriesOptions {
  page?: number;
  perPage?: number;
  maxPages?: number;
}

export const getGithubRepositories = async (
  userId: string,
  options?: GetGithubRepositoriesOptions
) => {
  const githubAccount = await prisma.githubAccount.findUnique({
    where: { userId },
    select: {
      accessToken: true,
    },
  });

  if (!githubAccount) {
    throw new Error("GitHub account is not connected.");
  }

  const accessToken = decryptToken(githubAccount.accessToken);
  const perPage = options?.perPage ? Math.min(Math.max(1, options.perPage), 100) : 100;

  const mapRepo = (repo: any) => ({
    id: repo.id,
    name: repo.name,
    fullName: repo.full_name,
    owner: repo.owner?.login,
    url: repo.html_url,
    cloneUrl: repo.clone_url,
    defaultBranch: repo.default_branch,
    private: repo.private,
    description: repo.description,
  });

  // If a specific page is requested directly, fetch only that single page
  if (options?.page) {
    const response = await axios.get("https://api.github.com/user/repos", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "HAVN-App",
      },
      params: {
        visibility: "all",
        affiliation: "owner,collaborator,organization_member",
        sort: "updated",
        per_page: perPage,
        page: options.page,
      },
    });

    return response.data.map(mapRepo);
  }

  // Multi-page fetch: follow pagination to retrieve repositories beyond the first 100
  const maxPages = options?.maxPages || 10;
  const allRepos: any[] = [];
  let currentPage = 1;
  let hasNext = true;

  while (hasNext && currentPage <= maxPages) {
    const response = await axios.get("https://api.github.com/user/repos", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "HAVN-App",
      },
      params: {
        visibility: "all",
        affiliation: "owner,collaborator,organization_member",
        sort: "updated",
        per_page: perPage,
        page: currentPage,
      },
    });

    const repos = response.data;
    if (!Array.isArray(repos) || repos.length === 0) {
      break;
    }

    allRepos.push(...repos);

    const linkHeader = response.headers?.link || response.headers?.Link;
    if (typeof linkHeader === "string") {
      hasNext = linkHeader.includes('rel="next"');
    } else {
      hasNext = repos.length === perPage;
    }

    currentPage++;
  }

  return allRepos.map(mapRepo);
};

export const getGithubBranches = async (
  userId: string,
  owner: string,
  repo: string
) => {
  const githubAccount = await prisma.githubAccount.findUnique({
    where: { userId },
    select: {
      accessToken: true,
    },
  });

  if (!githubAccount) {
    throw new Error("GitHub account is not connected.");
  }

  const accessToken = decryptToken(githubAccount.accessToken);

  const response = await axios.get(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "HAVN-App",
      },
      params: {
        per_page: 100,
      },
    }
  );

  return response.data.map((branch: any) => ({
    name: branch.name,
    protected: branch.protected,
  }));
};

export const disconnectGithub = async (userId: string) => {
  // Delete user's connected GitHub account
  await prisma.githubAccount.deleteMany({
    where: { userId },
  });

  // Also clean up any lingering OAuth states
  await prisma.githubOauthState.deleteMany({
    where: { userId },
  });

  return { success: true };
};