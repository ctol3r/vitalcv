/**
 * Backend API base URL.
 * 
 * Production: Railway (delightful-essence)
 * Local dev: localhost:4000
 */
const RAILWAY_PRODUCTION = 'https://api.vitalcv.com';

export const BACKEND_URL: string = (() => {
  // Explicit override always wins
  const explicit = process.env.BACKEND_URL;
  if (explicit && explicit.length > 0) return explicit;

  // Non-empty API base
  const apiBase = process.env.NEXT_PUBLIC_API_BASE;
  if (apiBase && apiBase.length > 0) return apiBase;

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (backendUrl && backendUrl.length > 0) return backendUrl;

  // Production or any deployed environment → Railway
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    return RAILWAY_PRODUCTION;
  }

  // Local dev
  return 'http://localhost:4000';
})();
