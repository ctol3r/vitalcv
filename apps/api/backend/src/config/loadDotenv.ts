import path from 'node:path';
import dotenv from 'dotenv';

/**
 * Loads dotenv files for local development. `.env.local` wins over `.env`.
 * Both calls use `override: false` so platform-provided env vars (Railway,
 * Render, Vercel, shell exports) always take precedence over file values.
 *
 * Paths are anchored at the backend package root via `__dirname` so the
 * loader works regardless of the shell's cwd.
 *
 * Missing files are silently ignored — dotenv returns an error in the
 * result object rather than throwing, and production environments
 * typically have no dotenv files.
 */
export function loadDotenv(): void {
  const backendRoot = path.resolve(__dirname, '..', '..');
  dotenv.config({
    path: path.join(backendRoot, '.env.local'),
    override: false,
    quiet: true,
  });
  dotenv.config({
    path: path.join(backendRoot, '.env'),
    override: false,
    quiet: true,
  });
}
