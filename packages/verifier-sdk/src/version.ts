/**
 * version.ts — @vitalcv/verifier-sdk
 * Version metadata and API compatibility check.
 */

export const SDK_NAME = '@vitalcv/verifier-sdk';
export const SDK_VERSION = '1.0.0';
export const MIN_API_VERSION = '1.0.0';

export interface CompatibilityResult {
  compatible: boolean;
  warning?: string;
}

/**
 * Check whether this SDK version is compatible with the given API version.
 * Uses major version matching — minor/patch differences produce warnings only.
 */
export function checkVersionCompatibility(apiVersion: string): CompatibilityResult {
  const [sdkMajor, sdkMinor] = SDK_VERSION.split('.').map(Number);
  const [apiMajor, apiMinor] = apiVersion.split('.').map(Number);

  if (Number.isNaN(apiMajor)) {
    return { compatible: false, warning: `Cannot parse API version: ${apiVersion}` };
  }

  if (apiMajor < sdkMajor) {
    return {
      compatible: false,
      warning: `API major version ${apiMajor} is behind SDK ${sdkMajor}. Upgrade the API.`,
    };
  }

  if (apiMajor > sdkMajor) {
    return {
      compatible: true,
      warning: `API major version ${apiMajor} is ahead of SDK ${sdkMajor}. Consider upgrading the SDK.`,
    };
  }

  if ((apiMinor ?? 0) < (sdkMinor ?? 0)) {
    return {
      compatible: true,
      warning: `API minor version ${apiMinor} is behind SDK ${sdkMinor}. Some features may be unavailable.`,
    };
  }

  return { compatible: true };
}
