import path from 'node:path';
import fg from 'fast-glob';
import { defineConfig, type Options } from 'tsup';

type ServiceBundleOptions = {
  entryGlobs?: string[];
  ignoreGlobs?: string[];
} & Omit<Partial<Options>, 'entry'>;

const DEFAULT_ENTRY_GLOBS = ['**/*.ts'];
const DEFAULT_IGNORE_GLOBS = [
  '**/*.test.ts',
  '**/*.spec.ts',
  '**/__tests__/**',
  '**/*.d.ts',
];

const normalizeEntryName = (filePath: string) =>
  filePath.replace(/\.ts$/, '').replace(/\\/g, '/');

const resolveEntries = (serviceDir: string, globs: string[], ignore: string[]) => {
  const files = fg.sync(globs, {
    cwd: serviceDir,
    ignore,
    dot: false,
  });

  if (files.length === 0) {
    throw new Error(
      `tsup: No entry files found for service at ${serviceDir}. Update entryGlobs to include at least one .ts file.`,
    );
  }

  return files.reduce<Record<string, string>>((acc, relativePath) => {
    acc[normalizeEntryName(relativePath)] = path.resolve(serviceDir, relativePath);
    return acc;
  }, {});
};

export const defineServiceBundle = (
  serviceDir: string,
  options: ServiceBundleOptions = {},
) => {
  const entryGlobs = options.entryGlobs ?? DEFAULT_ENTRY_GLOBS;
  const ignoreGlobs = [...DEFAULT_IGNORE_GLOBS, ...(options.ignoreGlobs ?? [])];

  return defineConfig({
    entry: resolveEntries(serviceDir, entryGlobs, ignoreGlobs),
    bundle: false,
    clean: true,
    dts: false,
    format: ['esm', 'cjs'],
    minify: false,
    skipNodeModulesBundle: true,
    sourcemap: true,
    splitting: false,
    target: 'node18',
    tsconfig: path.resolve(__dirname, 'tsconfig.json'),
    outDir: path.resolve(serviceDir, 'dist'),
    loader: {
      '.json': 'copy',
    },
    ...options,
  });
};


