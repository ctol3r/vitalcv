/**
 * ESM resolve hook: let `node --experimental-strip-types` load the release
 * monitor's TypeScript libs, which use bundler-style EXTENSIONLESS relative
 * imports (`./holderRoutes`) — the idiomatic style everywhere in apps/web.
 *
 * Node's ESM resolver requires explicit extensions for relative specifiers, so
 * without this hook the runner would ERR_MODULE_NOT_FOUND on the first
 * extensionless import. The hook rewrites a bare relative specifier to its `.ts`
 * (or `/index.ts`) file when one exists, and otherwise defers to Node. This
 * confines the "resolve like a bundler" glue to the standalone script runner and
 * keeps the shared libs untouched. Registered via `register-ts-resolver.mjs`.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && !/\.[mc]?[jt]s$/.test(specifier)) {
    const parent = context.parentURL ? fileURLToPath(context.parentURL) : process.cwd();
    const baseDir = dirname(parent);
    for (const candidate of [`${specifier}.ts`, `${specifier}/index.ts`]) {
      const abs = resolvePath(baseDir, candidate);
      if (existsSync(abs)) {
        return nextResolve(pathToFileURL(abs).href, context);
      }
    }
  }
  return nextResolve(specifier, context);
}
