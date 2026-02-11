import { randomUUID, createHash } from "crypto";

const API_KEY_PREFIX = "q5r_";

/** Generate a new API key with the q5r_ prefix */
export function generateApiKey(): string {
  return `${API_KEY_PREFIX}${randomUUID().replace(/-/g, "")}`;
}

/** Hash an API key for storage (SHA-256) */
export function hashApiKey(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex");
}

/** Validate format of an API key */
export function isValidApiKeyFormat(apiKey: string): boolean {
  return apiKey.startsWith(API_KEY_PREFIX) && apiKey.length === 36;
}
