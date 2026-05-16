import { resolveDeploymentBackendBase } from '@/lib/deployment/backend-base';

export const BACKEND_URL: string = (() => {
  return resolveDeploymentBackendBase();
})();
