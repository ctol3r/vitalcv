import type { Express } from 'express';

export interface RuntimeRoute {
  method: string;
  path: string;
}

type ExpressLayer = {
  handle?: {
    stack?: ExpressLayer[];
  };
  name?: string;
  path?: string;
  regexp?: {
    fast_slash?: boolean;
    source?: string;
  };
  route?: {
    path: string | string[];
    methods: Record<string, boolean>;
    stack?: ExpressLayer[];
  };
};

function normalizePath(path: string): string {
  return path.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
}

function extractPrefix(layer: ExpressLayer): string {
  if (typeof layer.path === 'string') {
    return layer.path;
  }

  const source = layer.regexp?.source;
  if (!source || layer.regexp?.fast_slash) {
    return '';
  }

  return normalizePath(
    source
      .replace(/\\\//g, '/')
      .replace(/^\^/, '')
      .replace(/\(\?:\(\[\^\\\/]\+\?\)\)/g, ':param')
      .replace(/\(\?=\/\|\$\)/g, '')
      .replace(/\\\/\?\$$/, '')
      .replace(/\$$/, '')
      .replace(/^\//, '/'),
  );
}

function joinPaths(left: string, right: string): string {
  return normalizePath(`${left}/${right}`);
}

function walkLayers(layers: readonly ExpressLayer[], prefix: string, routes: RuntimeRoute[]): void {
  for (const layer of layers) {
    if (layer.route) {
      const routePaths = Array.isArray(layer.route.path) ? layer.route.path : [layer.route.path];
      for (const routePath of routePaths) {
        for (const [method, enabled] of Object.entries(layer.route.methods)) {
          if (!enabled) {
            continue;
          }
          routes.push({
            method: method.toUpperCase(),
            path: joinPaths(prefix, routePath),
          });
        }
      }
      continue;
    }

    if (layer.handle?.stack && layer.handle.stack.length > 0) {
      const childPrefix = extractPrefix(layer);
      walkLayers(layer.handle.stack, joinPaths(prefix, childPrefix), routes);
    }
  }
}

export function extractExpressRoutes(app: Express): RuntimeRoute[] {
  const router = app as unknown as { _router?: { stack?: ExpressLayer[] } };
  const routes: RuntimeRoute[] = [];
  const layers = router._router?.stack ?? [];
  walkLayers(layers, '', routes);

  const deduped = new Map<string, RuntimeRoute>();
  for (const route of routes) {
    const normalized = {
      method: route.method,
      path: normalizePath(route.path),
    };
    deduped.set(`${normalized.method} ${normalized.path}`, normalized);
  }

  return [...deduped.values()].sort((left, right) =>
    `${left.method} ${left.path}`.localeCompare(`${right.method} ${right.path}`),
  );
}

export function looksLikeApiRoute(path: string): boolean {
  return (
    path !== '/'
    && !path.startsWith('/api-docs')
    && !path.startsWith('/_next')
    && (
      path.startsWith('/api')
      || path.startsWith('/health')
      || path.startsWith('/readyz')
      || path.startsWith('/.well-known')
      || path.startsWith('/psv')
      || path.startsWith('/bundle')
      || path.startsWith('/metrics')
      || path.startsWith('/internal')
      || path.startsWith('/demo')
    )
  );
}

