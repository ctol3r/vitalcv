/**
 * API routes scanner
 * Scans /apps/api/src/routes to discover all API endpoints
 */

import * as fs from 'fs';
import * as path from 'path';
import type { RouteMetadata, ApiMetadata } from '../types';

const MONOREPO_ROOT = path.resolve(__dirname, '../../../..');
const API_ROUTES_DIR = path.join(MONOREPO_ROOT, 'apps/api/src/routes');

export async function scanApiRoutes(): Promise<ApiMetadata> {
  const routes: RouteMetadata[] = [];
  const middleware: string[] = [];
  const services: string[] = [];

  // Scan routes directory
  if (fs.existsSync(API_ROUTES_DIR)) {
    await scanRoutesDirectory(API_ROUTES_DIR, routes, '');
  }

  // Scan middleware directory
  const middlewareDir = path.join(MONOREPO_ROOT, 'apps/api/src/middleware');
  if (fs.existsSync(middlewareDir)) {
    const files = fs.readdirSync(middlewareDir, { withFileTypes: true });
    middleware.push(...files
      .filter(f => f.isFile() && f.name.endsWith('.ts') && !f.name.startsWith('__'))
      .map(f => f.name.replace('.ts', ''))
    );
  }

  // Scan services directory
  const servicesDir = path.join(MONOREPO_ROOT, 'apps/api/src/services');
  if (fs.existsSync(servicesDir)) {
    const files = fs.readdirSync(servicesDir, { withFileTypes: true, recursive: true });
    services.push(...files
      .filter(f => f.isFile() && f.name.endsWith('.ts') && !f.name.startsWith('__'))
      .map(f => path.relative(servicesDir, path.join(f.path, f.name)).replace('.ts', ''))
    );
  }

  return {
    routes,
    totalRoutes: routes.length,
    middleware,
    services: [...new Set(services)].slice(0, 100), // Limit to first 100
  };
}

async function scanRoutesDirectory(
  dir: string,
  routes: RouteMetadata[],
  basePath: string
): Promise<void> {
  if (!fs.existsSync(dir)) {
    return;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory() && !entry.name.startsWith('__')) {
      const newBasePath = basePath ? `${basePath}/${entry.name}` : entry.name;
      await scanRoutesDirectory(fullPath, routes, newBasePath);
    } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.startsWith('__')) {
      // Try to extract route information from file
      const routePath = basePath || entry.name.replace('.ts', '');
      const content = fs.readFileSync(fullPath, 'utf-8');

      // Extract route patterns (basic regex matching)
      const routeMatches = content.match(/(?:router\.(get|post|put|delete|patch|use))\(['"`]([^'"`]+)['"`]/g);
      if (routeMatches) {
        for (const match of routeMatches) {
          const methodMatch = match.match(/(get|post|put|delete|patch|use)/);
          const pathMatch = match.match(/['"`]([^'"`]+)['"`]/);

          if (methodMatch && pathMatch) {
            const method = methodMatch[1].toUpperCase();
            const routePath = pathMatch[1];

            routes.push({
              path: routePath.startsWith('/') ? routePath : `/${routePath}`,
              method,
              handler: entry.name,
            });
          }
        }
      } else {
        // Fallback: add a generic route entry
        routes.push({
          path: `/${routePath}`,
          method: 'GET',
          handler: entry.name,
        });
      }
    }
  }
}

