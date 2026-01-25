#!/usr/bin/env tsx
/**
 * STUB: Workspace hygiene checks (unused deps, circular deps, dead code).
 * TODO: Expand scopes once full-repo baselines are defined.
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve, extname, relative } from 'node:path';

type PackageReport = {
  name: string;
  dir: string;
  unusedDependencies: string[];
  cycles: string[][];
  deadCode: string[];
};

const DEFAULT_SCOPES = ['packages/infra-config'];
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const FIX_FLAG = process.argv.includes('--fix');

const scopeArgIndex = process.argv.findIndex((arg) => arg === '--scope');
const scopeArg = scopeArgIndex >= 0 ? process.argv[scopeArgIndex + 1] : undefined;
const scopes = scopeArg ? scopeArg.split(',').map((entry) => entry.trim()).filter(Boolean) : DEFAULT_SCOPES;

const rootDir = process.cwd();

function isSourceFile(filePath: string): boolean {
  if (filePath.endsWith('.d.ts')) {
    return false;
  }
  return SOURCE_EXTENSIONS.has(extname(filePath));
}

function isIgnoredDir(name: string): boolean {
  return [
    'node_modules',
    '.git',
    'dist',
    'build',
    '.next',
    '.turbo',
    'coverage',
    'storybook-static',
  ].includes(name);
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, 'utf8')) as T;
}

function collectPackageDirs(scope: string): string[] {
  const absolute = resolve(rootDir, scope);
  if (!exists(absolute) || !statSync(absolute).isDirectory()) {
    return [];
  }

  const packageJson = join(absolute, 'package.json');
  if (statSync(absolute).isDirectory() && exists(packageJson)) {
    return [absolute];
  }

  const subdirs = readdirSync(absolute).map((entry) => join(absolute, entry));
  return subdirs.filter((dir) => {
    try {
      return statSync(dir).isDirectory() && exists(join(dir, 'package.json'));
    } catch {
      return false;
    }
  });
}

function exists(filePath: string): boolean {
  try {
    statSync(filePath);
    return true;
  } catch {
    return false;
  }
}

function collectSourceFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      if (isIgnoredDir(entry)) continue;
      results.push(...collectSourceFiles(fullPath));
    } else if (stats.isFile() && isSourceFile(fullPath)) {
      results.push(fullPath);
    }
  }
  return results;
}

function extractImports(content: string): string[] {
  const modules: string[] = [];
  const importPattern = /import\s+(?:[^'";]+\s+from\s+)?['"]([^'"]+)['"]/g;
  const requirePattern = /require\(['"]([^'"]+)['"]\)/g;
  const dynamicPattern = /import\(['"]([^'"]+)['"]\)/g;

  for (const pattern of [importPattern, requirePattern, dynamicPattern]) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      modules.push(match[1]);
    }
  }
  return modules;
}

function buildImportGraph(files: string[], packageDir: string): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();
  const fileSet = new Set(files);

  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    const imports = extractImports(content)
      .filter((specifier) => specifier.startsWith('.'))
      .map((specifier) => resolveImport(file, specifier));
    const resolved = imports.filter((target) => target && fileSet.has(target)) as string[];
    graph.set(file, new Set(resolved));
  }

  return graph;
}

function resolveImport(fromFile: string, specifier: string): string | null {
  const base = resolve(fromFile, '..', specifier);
  const candidates = [
    base,
    ...Array.from(SOURCE_EXTENSIONS).map((ext) => `${base}${ext}`),
    ...Array.from(SOURCE_EXTENSIONS).map((ext) => join(base, `index${ext}`)),
  ];

  for (const candidate of candidates) {
    if (exists(candidate) && statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

function detectCycles(graph: Map<string, Set<string>>): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const stack = new Set<string>();

  const visit = (node: string, path: string[]) => {
    if (stack.has(node)) {
      const cycleStart = path.indexOf(node);
      if (cycleStart >= 0) {
        cycles.push([...path.slice(cycleStart), node]);
      }
      return;
    }
    if (visited.has(node)) return;
    visited.add(node);
    stack.add(node);

    const neighbors = graph.get(node) ?? new Set();
    for (const neighbor of neighbors) {
      visit(neighbor, [...path, neighbor]);
    }
    stack.delete(node);
  };

  for (const node of graph.keys()) {
    visit(node, [node]);
  }

  return cycles;
}

function collectEntryPoints(packageDir: string): string[] {
  const entries: string[] = [];
  const rootIndex = join(packageDir, 'index.ts');
  const srcIndex = join(packageDir, 'src', 'index.ts');
  const srcIndexTsx = join(packageDir, 'src', 'index.tsx');
  if (exists(rootIndex)) entries.push(rootIndex);
  if (exists(srcIndex)) entries.push(srcIndex);
  if (exists(srcIndexTsx)) entries.push(srcIndexTsx);

  const appDir = join(packageDir, 'app');
  if (exists(appDir)) {
    entries.push(...collectSourceFiles(appDir));
  }
  const pagesDir = join(packageDir, 'pages');
  if (exists(pagesDir)) {
    entries.push(...collectSourceFiles(pagesDir));
  }

  return entries;
}

function collectReachable(graph: Map<string, Set<string>>, entryPoints: string[]): Set<string> {
  const reachable = new Set<string>();
  const stack = [...entryPoints];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || reachable.has(current)) continue;
    reachable.add(current);
    const neighbors = graph.get(current);
    if (!neighbors) continue;
    for (const neighbor of neighbors) {
      if (!reachable.has(neighbor)) stack.push(neighbor);
    }
  }
  return reachable;
}

function isDeadCodeCandidate(filePath: string, content: string): boolean {
  const stripped = content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').trim();
  return stripped.length === 0;
}

function pruneUnusedDependencies(pkgDir: string, usedModules: Set<string>): string[] {
  const pkgPath = join(pkgDir, 'package.json');
  const pkg = readJson<{ dependencies?: Record<string, string> }>(pkgPath);
  const dependencies = pkg.dependencies ?? {};
  const unused = Object.keys(dependencies).filter((dep) => !usedModules.has(dep));

  if (FIX_FLAG && unused.length > 0) {
    const updated = { ...dependencies };
    for (const dep of unused) {
      delete updated[dep];
    }
    pkg.dependencies = Object.keys(updated).length > 0 ? updated : undefined;
    writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  }

  return unused;
}

function runForPackage(pkgDir: string): PackageReport {
  const pkgJson = readJson<{ name?: string }>(join(pkgDir, 'package.json'));
  const files = collectSourceFiles(pkgDir);
  const usedModules = new Set<string>();
  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    for (const specifier of extractImports(content)) {
      if (specifier.startsWith('.')) continue;
      const root = specifier.split('/')[0];
      if (root.startsWith('@')) {
        const scoped = specifier.split('/').slice(0, 2).join('/');
        usedModules.add(scoped);
      } else {
        usedModules.add(root);
      }
    }
  }

  const graph = buildImportGraph(files, pkgDir);
  const cycles = detectCycles(graph);
  const entryPoints = collectEntryPoints(pkgDir);
  const reachable = collectReachable(graph, entryPoints);
  const deadCode: string[] = [];

  for (const file of files) {
    if (reachable.has(file)) continue;
    const content = readFileSync(file, 'utf8');
    if (!isDeadCodeCandidate(file, content)) continue;
    deadCode.push(file);
    if (FIX_FLAG) {
      writeFileSync(file, '\n');
    }
  }

  const unusedDependencies = pruneUnusedDependencies(pkgDir, usedModules);

  return {
    name: pkgJson.name ?? pkgDir,
    dir: pkgDir,
    unusedDependencies,
    cycles,
    deadCode,
  };
}

function run(): void {
  const packageDirs = scopes.flatMap(collectPackageDirs);
  const reports = packageDirs.map(runForPackage);

  const unusedDeps = reports.flatMap((report) =>
    report.unusedDependencies.map((dep) => `${report.name}: ${dep}`),
  );
  const cycles = reports.flatMap((report) => report.cycles.map((cycle) => ({ report, cycle })));
  const deadCode = reports.flatMap((report) =>
    report.deadCode.map((file) => `${report.name}: ${relative(rootDir, file)}`),
  );

  if (unusedDeps.length > 0) {
    console.error('\nUnused dependencies:');
    for (const item of unusedDeps) {
      console.error(`  - ${item}`);
    }
  }

  if (cycles.length > 0) {
    console.error('\nCircular dependencies:');
    for (const entry of cycles) {
      const cyclePath = entry.cycle.map((file) => relative(rootDir, file)).join(' -> ');
      console.error(`  - ${entry.report.name}: ${cyclePath}`);
    }
  }

  if (deadCode.length > 0) {
    console.error('\nDead code candidates (empty files only):');
    for (const item of deadCode) {
      console.error(`  - ${item}`);
    }
  }

  const hasIssues = unusedDeps.length > 0 || cycles.length > 0 || deadCode.length > 0;
  if (hasIssues) {
    console.error('\nHygiene checks failed. Resolve issues or extend scope as needed.');
    process.exit(1);
  }

  console.log('✅ Hygiene checks passed.');
}

run();
