import crypto from 'crypto';

/**
 * API Key Utilities
 *
 * Generates and hashes API keys following the format:
 * helios_{env}_{random}
 *
 * Keys are hashed using SHA-256 before storage. Plaintext keys
 * are shown only once on creation and never retrievable.
 */

export interface GeneratedApiKey {
  /** Full plaintext key - SHOW ONCE, never store */
  key: string;
  /** SHA-256 hash for database storage */
  hash: string;
  /** Prefix for UI display (e.g., "helios_prod_a9k3...") */
  prefix: string;
  /** Environment identifier */
  env: string;
}

/**
 * Generate a new API key with cryptographically secure randomness
 *
 * Format: helios_{env}_{random}
 * - env: "prod" in production, "dev" otherwise
 * - random: 32 bytes of crypto-random data, base64url encoded
 *
 * @returns GeneratedApiKey object with key, hash, and prefix
 */
export function generateApiKey(): GeneratedApiKey {
  // Determine environment
  const env = process.env['NODE_ENV'] === 'production' ? 'prod' : 'dev';

  // Generate 32 bytes of cryptographically secure random data
  // base64url encoding: URL-safe, no padding, 43 characters
  const random = crypto.randomBytes(32).toString('base64url');

  // Construct full key: helios_prod_a9k3f8ds7fg2h5j1k4l9m3n8p2q7r5t6w9x2...
  const key = `helios_${env}_${random}`;

  // Hash for storage (never store plaintext)
  const hash = hashApiKey(key);

  // Create prefix for UI display
  const prefix = `${key.substring(0, 20)}...`;

  return {
    key,
    hash,
    prefix,
    env,
  };
}

/**
 * Hash an API key using SHA-256
 *
 * Used for:
 * 1. Storing key hashes in database
 * 2. Looking up keys during authentication
 *
 * @param key - Plaintext API key
 * @returns SHA-256 hash as hex string
 */
export function hashApiKey(key: string): string {
  return crypto
    .createHash('sha256')
    .update(key)
    .digest('hex');
}

/**
 * Validate API key format
 *
 * Checks that key matches expected format: helios_{env}_{random}
 *
 * @param key - API key to validate
 * @returns true if valid format, false otherwise
 */
export function validateApiKeyFormat(key: string): boolean {
  // Must start with helios_
  if (!key.startsWith('helios_')) {
    return false;
  }

  // Must have three parts separated by underscores
  const parts = key.split('_');
  if (parts.length !== 3) {
    return false;
  }

  const [prefix, env, random] = parts;

  // Validate prefix
  if (prefix !== 'helios') {
    return false;
  }

  // Validate environment (prod or dev)
  if (env !== 'prod' && env !== 'dev') {
    return false;
  }

  // Validate random part (base64url is alphanumeric + - and _)
  // Should be 43 characters for 32 bytes
  const base64urlPattern = /^[A-Za-z0-9_-]{43}$/;
  if (!base64urlPattern.test(random)) {
    return false;
  }

  return true;
}

/**
 * Extract environment from API key
 *
 * @param key - API key
 * @returns Environment ('prod' or 'dev') or null if invalid
 */
export function extractEnvironment(key: string): 'prod' | 'dev' | null {
  if (!validateApiKeyFormat(key)) {
    return null;
  }

  const parts = key.split('_');
  return parts[1] as 'prod' | 'dev';
}

/**
 * Create display prefix from full key
 *
 * Shows first ~20 characters + ellipsis for UI
 *
 * @param key - Full API key
 * @returns Display prefix (e.g., "helios_prod_a9k3...")
 */
export function createKeyPrefix(key: string): string {
  return `${key.substring(0, 20)}...`;
}
