import { AiAction, AiMode } from "./ai.service";

export interface CachedAiResponse {
  deploymentId: string;
  mode: AiMode;
  action: AiAction;
  question?: string;
  answer: string;
  citedSequences: number[];
  invalidCitations: number[];
  citationsValidated: boolean;
  model: string;
  contextStats: {
    totalLogs: number;
    selectedLogs: number;
  };
  cachedAt: string; // ISO string
  expiresAt: number; // Unix ms
}

export class AiCacheService {
  private cache = new Map<string, CachedAiResponse>();
  private readonly defaultTtlMs: number;
  private readonly maxEntries: number;
  private hits = 0;
  private misses = 0;

  constructor(defaultTtlMs = 24 * 60 * 60 * 1000, maxEntries = 500) {
    this.defaultTtlMs = defaultTtlMs;
    this.maxEntries = maxEntries;
  }

  /**
   * Normalizes a question string for cache key consistency:
   * trims leading/trailing whitespace, converts to lowercase, collapses consecutive whitespace.
   */
  public normalizeQuestion(question?: string): string {
    if (!question) return "";
    return question.trim().toLowerCase().replace(/\s+/g, " ");
  }

  /**
   * Builds deterministic cache key scoped by deployment, mode, action, and normalized question.
   */
  public buildKey(deploymentId: string, mode: AiMode, action: AiAction, question?: string): string {
    const normQ = this.normalizeQuestion(question);
    return `${deploymentId}:${mode}:${action}:${normQ}`;
  }

  /**
   * Retrieves a cached response if present and not expired.
   */
  public get(
    deploymentId: string,
    mode: AiMode,
    action: AiAction,
    question?: string
  ): CachedAiResponse | null {
    const key = this.buildKey(deploymentId, mode, action, question);
    const item = this.cache.get(key);

    if (!item) {
      this.misses++;
      return null;
    }

    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    // Refresh entry position in Map for LRU behavior
    this.cache.delete(key);
    this.cache.set(key, item);
    this.hits++;
    return item;
  }

  /**
   * Checks if an unexpired cache entry exists without updating hits/misses.
   */
  public has(deploymentId: string, mode: AiMode, action: AiAction, question?: string): boolean {
    const key = this.buildKey(deploymentId, mode, action, question);
    const item = this.cache.get(key);
    if (!item) return false;
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Saves a response into the cache with bounded size and TTL.
   */
  public set(
    deploymentId: string,
    mode: AiMode,
    action: AiAction,
    data: Omit<CachedAiResponse, "cachedAt" | "expiresAt">,
    question?: string,
    ttlMs: number = this.defaultTtlMs
  ): CachedAiResponse {
    // Evict oldest if capacity reached
    if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    const key = this.buildKey(deploymentId, mode, action, question);
    const now = new Date();
    const entry: CachedAiResponse = {
      ...data,
      question,
      cachedAt: now.toISOString(),
      expiresAt: Date.now() + ttlMs,
    };

    this.cache.set(key, entry);
    return entry;
  }

  /**
   * Finds any valid cached diagnosis for a deployment, optionally matching action and mode.
   * Used for graceful demo fallback when live provider is rate-limited or unavailable.
   * NOTE: Custom questions are strictly excluded so questions never cross-contaminate.
   */
  public getAnyForDeployment(
    deploymentId: string,
    mode?: AiMode,
    action?: AiAction
  ): CachedAiResponse | null {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (key.startsWith(`${deploymentId}:`)) {
        if (now <= item.expiresAt) {
          // Custom questions must NEVER be served as a generic fallback for other questions or actions
          if (item.action === "custom") continue;
          if (mode && item.mode !== mode) continue;
          if (action && item.action !== action) continue;
          return item;
        } else {
          this.cache.delete(key);
        }
      }
    }
    return null;
  }

  /**
   * Invalidates all cache entries for a specific deployment.
   */
  public invalidateDeployment(deploymentId: string): number {
    let count = 0;
    const prefix = `${deploymentId}:`;
    for (const key of Array.from(this.cache.keys())) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Clears the entire cache (useful for test resets).
   */
  public clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Returns cache stats.
   */
  public stats(): { size: number; hits: number; misses: number } {
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
    };
  }
}

// Singleton in-memory AI cache instance
export const aiCacheService = new AiCacheService();
