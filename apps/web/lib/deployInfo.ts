/**
 * deployInfo.ts — server-side deployment context reader.
 *
 * Only call from RSC / route handlers. These env vars are NOT available
 * client-side unless explicitly prefixed NEXT_PUBLIC_.
 *
 * Canonical platform is Railway, which injects:
 *   RAILWAY_ENVIRONMENT        production | staging | <env name>
 *   RAILWAY_PUBLIC_DOMAIN      deployment domain (no https://)
 *   RAILWAY_GIT_COMMIT_SHA
 *   RAILWAY_GIT_COMMIT_MESSAGE
 *   RAILWAY_GIT_BRANCH         branch name
 *
 * Vercel vars (VERCEL_ENV / VERCEL_URL / VERCEL_GIT_*) are read as a
 * backwards-compatible fallback only — Vercel is deprecated infrastructure.
 */

export type DeployEnv = 'production' | 'preview' | 'development';
export type DeployPlatform = 'railway' | 'vercel' | 'local';

export interface DeployInfo {
  env: DeployEnv;
  url: string;           // full https:// URL
  sha: string;           // short 7-char SHA
  shaFull: string;       // full SHA
  message: string;       // commit message (first line)
  branch: string;        // git branch or ref
  deployedAt: string;    // ISO timestamp (build time)
  platform: DeployPlatform;
  isRailway: boolean;
  /** @deprecated Vercel is legacy; retained for backwards compatibility. */
  isVercel: boolean;
}

function resolveEnv(): DeployEnv {
  const railwayEnv = process.env.RAILWAY_ENVIRONMENT?.trim();
  if (railwayEnv) {
    return railwayEnv.toLowerCase() === 'production' ? 'production' : 'preview';
  }
  const vercelEnv = process.env.VERCEL_ENV?.trim();
  if (vercelEnv) return vercelEnv as DeployEnv;
  return 'development';
}

export function getDeployInfo(): DeployInfo {
  const isRailway = Boolean(process.env.RAILWAY_ENVIRONMENT);
  const isVercel = Boolean(process.env.VERCEL);
  const platform: DeployPlatform = isRailway ? 'railway' : isVercel ? 'vercel' : 'local';

  const env = resolveEnv();
  const rawUrl =
    process.env.RAILWAY_PUBLIC_DOMAIN ?? process.env.VERCEL_URL ?? 'localhost:3000';
  const url = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
  const shaFull =
    process.env.RAILWAY_GIT_COMMIT_SHA ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.GIT_SHA ??
    '';
  const sha = shaFull.slice(0, 7) || 'local';
  const rawMessage =
    process.env.RAILWAY_GIT_COMMIT_MESSAGE ?? process.env.VERCEL_GIT_COMMIT_MESSAGE ?? '';
  // First line only — strip multi-line commit bodies
  const message = rawMessage.split('\n')[0]?.trim() || 'Local build';
  const branch =
    process.env.RAILWAY_GIT_BRANCH ??
    process.env.VERCEL_GIT_COMMIT_REF ??
    process.env.GIT_BRANCH ??
    'main';
  // BUILD_TIMESTAMP is set by the CI/build step if available; fallback to now
  const deployedAt = process.env.BUILD_TIMESTAMP ?? new Date().toISOString();

  return { env, url, sha, shaFull, message, branch, deployedAt, platform, isRailway, isVercel };
}

/** Safe subset for the /api/deploy-info route (no secrets) */
export interface PublicDeployInfo {
  env: DeployEnv;
  sha: string;
  message: string;
  branch: string;
  deployedAt: string;
  platform: DeployPlatform;
  isRailway: boolean;
  /** @deprecated Vercel is legacy; retained for backwards compatibility. */
  isVercel: boolean;
}

export function getPublicDeployInfo(): PublicDeployInfo {
  const { env, sha, message, branch, deployedAt, platform, isRailway, isVercel } = getDeployInfo();
  return { env, sha, message, branch, deployedAt, platform, isRailway, isVercel };
}
