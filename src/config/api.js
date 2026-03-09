// ===========================================
// Centralized API Configuration
// ===========================================
// All API URLs are configured via .env file.
// To switch between localhost and production:
//   1. Edit .env in the project root
//   2. Restart the dev server
// ===========================================

/**
 * Base URL for the Express backend API.
 * Set via VITE_API_BASE_URL in .env
 * Default: http://localhost:5000
 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

/**
 * Fingerprint WebSocket service URL.
 * Set via VITE_FINGERPRINT_WS_URL in .env
 * Default: ws://localhost:8089
 */
export const FINGERPRINT_WS_URL = import.meta.env.VITE_FINGERPRINT_WS_URL || 'ws://localhost:8089';
