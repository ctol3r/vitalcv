/**
 * deployInfo.ts — server-side Vercel deployment context reader.
 *
 * Only call from RSC / route handlers. These env vars are NOT available
 * client-side unless explicitly prefixed NEXT_PUBLIC_.
 *
 * Vercel injects these automatically for every deployment:
 *   VERCEL_ENV           production | preview | development
 *   VERCEL_URL           deployment URL (no https://)
 *   VERCEL_GIT_COMMIT_SHA
 *   VERCEL_GIT_COMMIT_MESSAGE
 *   VERCEL_GIT_COMMIT_REF  branch name
 */

export type DeployEnv = 'production' | 'preview' | 'development';

export interface DeployInfo {
  env: DeployEnv;
  url: string;           // full https:// URL
  sha: string;           // short 7-char SHA
  shaFull: string;       // full SHA
  message: string;       // commit message (first line)
  branch: string;        // git branch or ref
  deployedAt: string;    // ISO timestamp (build time)
  isVercel: boolean;
}

export function getDeployInfo(): DeployInfo {
  const isVercel = Boolean(process.env.VERCEL);
  const env = (process.env.VERCEL_ENV ?? 'development') as DeployEnv;
  const rawUrl = process.env.VERCEL_URL ?? 'localhost:3000';
  const url = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
  const shaFull = process.env.VERCEL_GIT_COMMIT_SHA ?? '';
  const sha = shaFull.slice(0, 7) || 'local';
  const rawMessage = process.env.VERCEL_GIT_COMMIT_MESSAGE ?? '';
  // First line only — strip multi-line commit bodies
  const message = rawMessage.split('\n')[0]?.trim() || 'Local build';
  const branch = process.env.VERCEL_GIT_COMMIT_REF ?? 'main';
  // BUILD_TIMESTAMP is set by the CI/build step if available; fallback to now
  const deployedAt = process.env.BUILD_TIMESTAMP ?? new Date().toISOString();

  return { env, url, sha, shaFull, message, branch, deployedAt, isVercel };
}

/** Safe subset for the /api/deploy-info route (no secrets) */
export interface PublicDeployInfo {
  env: DeployEnv;
  sha: string;
  message: string;
  branch: string;
  deployedAt: string;
  isVercel: boolean;
}

export function getPublicDeployInfo(): PublicDeployInfo {
  const { env, sha, message, branch, deployedAt, isVercel } = getDeployInfo();
  return { env, sha, message, branch, deployedAt, isVercel };
}
