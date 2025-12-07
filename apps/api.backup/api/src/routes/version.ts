/**
 * B143D-REL-004: Version endpoint
 *
 * GET /version - Returns API version information
 * GET /api/v1/version - Returns detailed version information
 *
 * Returns version, commit SHA, and build time information.
 * Used for debugging and version discovery.
 */

import { Request, Response } from 'express';
import { readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

/**
 * Read version from VERSION file
 */
function getVersion(): string {
  try {
    const versionPath = join(__dirname, '../../../../VERSION');
    const version = readFileSync(versionPath, 'utf-8').trim();
    return version;
  } catch (error) {
    // Fallback to package.json if VERSION file not found
    try {
      const packageJson = require('../../../../package.json');
      return packageJson.version || 'unknown';
    } catch {
      return 'unknown';
    }
  }
}

/**
 * Get git commit SHA
 */
function getCommitSha(): string {
  try {
    const sha = execSync('git rev-parse HEAD', { encoding: 'utf-8', cwd: join(__dirname, '../../../../') }).trim();
    return sha.substring(0, 7); // Short SHA
  } catch (error) {
    return process.env.COMMIT_SHA?.substring(0, 7) || 'unknown';
  }
}

/**
 * Get build time (from environment or current time)
 */
function getBuildTime(): string {
  return process.env.BUILD_TIME || new Date().toISOString();
}

/**
 * Get release version for telemetry tagging
 */
export function getReleaseVersion(): string {
  return getVersion();
}

// Export release version for use in metrics and logs
export const RELEASE_VERSION = getReleaseVersion();

// Set global release version for telemetry
if (typeof global !== 'undefined') {
  (global as any).RELEASE_VERSION = RELEASE_VERSION;
}

/**
 * GET /version
 * Returns basic version information
 */
export function getVersionHandler(req: Request, res: Response): void {
  const version = getVersion();

  res.json({
    version,
    service: 'api',
  });
}

/**
 * GET /api/v1/version
 * Returns detailed version information
 */
export function getVersionDetailedHandler(req: Request, res: Response): void {
  const version = getVersion();
  const commitSha = getCommitSha();
  const buildTime = getBuildTime();

  res.json({
    version,
    commitSha,
    buildTime,
    service: 'api',
    environment: process.env.NODE_ENV || 'development',
    apiVersion: 'v1',
  });
}

