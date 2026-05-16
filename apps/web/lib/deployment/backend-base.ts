export const SURVIVAL_PUBLIC_API_BASE = 'https://api.vitalcv.com';

function normalizeBase(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function isProductionLikeDeployment(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.CF_PAGES === '1' || env.NODE_ENV === 'production';
}

export function resolveDeploymentBackendBase(env: NodeJS.ProcessEnv = process.env): string {
  const explicit =
    env.BACKEND_URL ||
    env.NEXT_PUBLIC_API_BASE ||
    env.NEXT_PUBLIC_BACKEND_URL ||
    env.NEXT_PUBLIC_API_URL;

  if (explicit && explicit.length > 0) {
    return normalizeBase(explicit);
  }

  return isProductionLikeDeployment(env)
    ? SURVIVAL_PUBLIC_API_BASE
    : 'http://localhost:4000';
}
