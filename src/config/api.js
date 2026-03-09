// ===========================================
// Centralized API Configuration
// ===========================================
// All API requests go through the Vite/reverse proxy.
//
// How it works:
//   API_BASE_URL = '/api'
//   fetch(`${API_BASE_URL}/api/login`) → /api/api/login
//   Vite proxy strips first /api → forwards /api/login to backend
//
// To change the backend target:
//   1. Edit VITE_API_BASE_URL in .env (used by vite.config.mjs proxy)
//   2. Restart the dev server
// ===========================================

/**
 * Base URL prefix for all API calls.
 * Set to '/api' so that all requests go through the proxy.
 * The actual backend target is set via VITE_API_BASE_URL in .env
 * (used by vite.config.mjs proxy target).
 */
export const API_BASE_URL = '/api';

/**
 * Fingerprint WebSocket service URL.
 * Set via VITE_FINGERPRINT_WS_URL in .env
 * Default: ws://localhost:8089
 */
export const FINGERPRINT_WS_URL = import.meta.env.VITE_FINGERPRINT_WS_URL || 'ws://localhost:8089';
