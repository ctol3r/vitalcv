/**
 * Resolve the backend API base URL.
 * Handles empty-string env vars (Vercel sets NEXT_PUBLIC_API_BASE="" in some configs).
 * Falls back to Railway production URL when running on Vercel with no explicit config.
 */
export const BACKEND_URL =
  [process.env.BACKEND_URL, process.env.NEXT_PUBLIC_API_BASE, process.env.NEXT_PUBLIC_BACKEND_URL]
    .find(v => typeof v === 'string' && v.length > 0)
  ?? (process.env.VERCEL
    ? 'https://delightful-essence-production.up.railway.app'
    : 'http://localhost:4000');
