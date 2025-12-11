/**
 * Central API Configuration
 *
 * IMPORTANT: All API calls should use these exports instead of hardcoding URLs.
 * This enables the app to work through nginx reverse proxy for remote access.
 *
 * When VITE_API_URL is empty/undefined, uses relative URLs (same origin via nginx).
 * When VITE_API_URL is set, uses that URL (for direct development access).
 */

// Get the API URL from environment, defaulting to empty (relative URLs)
const envApiUrl = import.meta.env.VITE_API_URL;

// API_BASE_URL: The base URL for API calls
// - Empty string = relative URLs (works through nginx proxy)
// - Full URL = direct access (e.g., http://localhost:3001)
export const API_BASE_URL = envApiUrl !== undefined && envApiUrl !== ''
  ? envApiUrl
  : '';

// API_URL: Base URL without /api suffix (for services that add it themselves)
export const API_URL = API_BASE_URL.replace(/\/api$/, '');

// Helper to build API paths
export function apiPath(path: string): string {
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  // If API_BASE_URL already includes /api, don't duplicate it
  if (API_BASE_URL.endsWith('/api') && normalizedPath.startsWith('/api')) {
    return `${API_URL}${normalizedPath}`;
  }

  return `${API_BASE_URL}${normalizedPath}`;
}

// For WebSocket connections
export function wsUrl(path: string): string {
  if (API_URL) {
    // Convert http(s) to ws(s)
    return API_URL.replace(/^http/, 'ws') + path;
  }
  // For relative URLs, use current host with ws protocol
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${path}`;
}
