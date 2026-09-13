/**
 * Sanitizes errors and log messages before storing or displaying them.
 * Ensures that tokens, secrets, and absolute host filesystem paths are redacted.
 */
export function sanitizeLogOutput(text: string, tokenToRedact?: string): string {
  if (!text) return "";

  let sanitized = text;

  // Redact specific user token if provided
  if (tokenToRedact && tokenToRedact.trim().length > 0) {
    sanitized = sanitized.split(tokenToRedact).join("[REDACTED_TOKEN]");
  }

  // Redact known GitHub Personal Access Token and OAuth token patterns
  sanitized = sanitized.replace(/ghp_[a-zA-Z0-9]{36}/g, "[REDACTED_TOKEN]");
  sanitized = sanitized.replace(/gho_[a-zA-Z0-9]{36}/g, "[REDACTED_TOKEN]");
  sanitized = sanitized.replace(/ghu_[a-zA-Z0-9]{36}/g, "[REDACTED_TOKEN]");
  sanitized = sanitized.replace(/ghs_[a-zA-Z0-9]{36}/g, "[REDACTED_TOKEN]");
  sanitized = sanitized.replace(/ghr_[a-zA-Z0-9]{36}/g, "[REDACTED_TOKEN]");
  sanitized = sanitized.replace(/github_pat_[a-zA-Z0-9_]{82}/g, "[REDACTED_TOKEN]");

  // Redact JWT tokens if printed by tooling
  sanitized = sanitized.replace(/eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g, "[REDACTED_TOKEN]");

  // Redact authorization headers if printed by tooling
  sanitized = sanitized.replace(/Authorization:\s*(Bearer|token)\s+[^\r\n]+/gi, "Authorization: [REDACTED]");

  // Mask Windows absolute file paths (e.g. C:\Users\... or D:\projects\...)
  sanitized = sanitized.replace(/[a-zA-Z]:\\[^ \r\n\t"']+/g, "[WORKSPACE_PATH]");

  // Mask Unix absolute file paths (e.g. /home/..., /Users/..., /tmp/...)
  sanitized = sanitized.replace(/(^|[\s"'])\/(home|Users|tmp|var|etc)\/[^ \r\n\t"']+/g, "$1[WORKSPACE_PATH]");

  return sanitized;
}

/**
 * Produces a safe, user-friendly error message from a raw error or Git stderr.
 */
export function sanitizeErrorMessage(rawError: unknown, tokenToRedact?: string): string {
  const message = rawError instanceof Error ? rawError.message : String(rawError);
  const clean = sanitizeLogOutput(message, tokenToRedact);

  // Common Git error translations for clearer feedback
  if (clean.includes("Remote branch") && clean.includes("not found")) {
    return "The requested branch was not found in the remote repository.";
  }
  if (clean.includes("Repository not found") || clean.includes("Authentication failed")) {
    return "Repository not found or GitHub access was denied. Please verify repository permissions.";
  }
  if (clean.includes("Docker")) {
    return clean;
  }
  if (clean.includes("timed out")) {
    return "Repository operation timed out.";
  }

  return clean.length > 500 ? clean.substring(0, 500) + "..." : clean;
}
