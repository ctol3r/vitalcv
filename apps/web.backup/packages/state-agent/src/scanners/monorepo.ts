/**
 * Monorepo introspection scanner
 * Scans package.json workspaces, package structure, and dependencies
 */

import * as fs from 'fs';
import * as path from 'path';
import type { MonorepoMetadata, PackageMetadata } from '../types';

const MONOREPO_ROOT = path.resolve(__dirname, '../../../..');

export async function scanMonorepo(): Promise<MonorepoMetadata> {
  const workspaceFile = path.join(MONOREPO_ROOT, 'pnpm-workspace.yaml');
  const rootPackageJson = path.join(MONOREPO_ROOT, 'package.json');

  let workspaces: string[] = [];
  let rootPackage = { name: 'unknown', version: '0.0.0' };

  // Read workspace configuration
  if (fs.existsSync(workspaceFile)) {
    const content = fs.readFileSync(workspaceFile, 'utf-8');
    const lines = content.split('\n');
    for (const line of lines) {
      if (line.trim().startsWith('-')) {
        const workspace = line.trim().substring(1).trim();
        if (workspace.includes('*')) {
          // Expand glob patterns
          if (workspace.includes('packages')) {
            const packagesDir = path.join(MONOREPO_ROOT, 'packages');
            if (fs.existsSync(packagesDir)) {
              const dirs = fs.readdirSync(packagesDir, { withFileTypes: true });
              workspaces.push(...dirs.filter(d => d.isDirectory()).map(d => `packages/${d.name}`));
            }
          }
          if (workspace.includes('apps')) {
            const appsDir = path.join(MONOREPO_ROOT, 'apps');
            if (fs.existsSync(appsDir)) {
              const dirs = fs.readdirSync(appsDir, { withFileTypes: true });
              workspaces.push(...dirs.filter(d => d.isDirectory()).map(d => `apps/${d.name}`));
            }
          }
        } else {
          workspaces.push(workspace);
        }
      }
    }
  }

  // Read root package.json
  if (fs.existsSync(rootPackageJson)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(rootPackageJson, 'utf-8'));
      rootPackage = {
        name: pkg.name || 'unknown',
        version: pkg.version || '0.0.0',
      };
    } catch (e) {
      console.warn('[state-agent] Failed to parse root package.json:', e);
    }
  }

  // Count packages and apps
  const packagesDir = path.join(MONOREPO_ROOT, 'packages');
  const appsDir = path.join(MONOREPO_ROOT, 'apps');

  let totalPackages = 0;
  let totalApps = 0;

  if (fs.existsSync(packagesDir)) {
    totalPackages = fs.readdirSync(packagesDir, { withFileTypes: true })
      .filter(d => d.isDirectory()).length;
  }

  if (fs.existsSync(appsDir)) {
    totalApps = fs.readdirSync(appsDir, { withFileTypes: true })
      .filter(d => d.isDirectory()).length;
  }

  return {
    workspaces: [...new Set(workspaces)],
    rootPackage,
    totalPackages,
    totalApps,
  };
}

export async function scanPackages(): Promise<PackageMetadata[]> {
  const packages: PackageMetadata[] = [];
  const packagesDir = path.join(MONOREPO_ROOT, 'packages');

  if (!fs.existsSync(packagesDir)) {
    return packages;
  }

  const dirs = fs.readdirSync(packagesDir, { withFileTypes: true })
    .filter(d => d.isDirectory());

  for (const dir of dirs) {
    const pkgPath = path.join(packagesDir, dir.name, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        packages.push({
          name: pkg.name || dir.name,
          version: pkg.version || '0.0.0',
          path: `packages/${dir.name}`,
          dependencies: Object.keys(pkg.dependencies || {}),
        });
      } catch (e) {
        console.warn(`[state-agent] Failed to parse package.json for ${dir.name}:`, e);
      }
    }
  }

  return packages;
}

