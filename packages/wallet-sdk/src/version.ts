export const SDK_NAME = '@vitalcv/wallet-sdk';
export const SDK_VERSION = '1.0.0';
export const MIN_API_VERSION = '1.0.0';

export interface CompatibilityResult { compatible: boolean; warning?: string }

export function checkVersionCompatibility(apiVersion: string): CompatibilityResult {
  const [sdkMajor] = SDK_VERSION.split('.').map(Number);
  const [apiMajor] = apiVersion.split('.').map(Number);
  if (Number.isNaN(apiMajor)) return { compatible: false, warning: `Cannot parse API version: ${apiVersion}` };
  if (apiMajor < sdkMajor) return { compatible: false, warning: `API major ${apiMajor} behind SDK ${sdkMajor}` };
  if (apiMajor > sdkMajor) return { compatible: true, warning: `API major ${apiMajor} ahead of SDK ${sdkMajor}` };
  return { compatible: true };
}
