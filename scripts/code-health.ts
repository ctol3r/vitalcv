#!/usr/bin/env tsx
/**
 * STUB: Code health checks (orphan files, unused exports, circular deps).
 * TODO: Expand coverage once baselines are established.
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

type ExportMap = Map<string, Set<string>>;
type UsageMap = Map<string, Set<string>>;

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const DEFAULT_SCOPES = ['apps/web/lib/demo-flow.ts', 'apps/web/lib/runtime-config.ts'];
const DEFAULT_SCAN_DIRS = ['apps/web'];

const ALIAS_PREFIXES: Array<{ prefix: string; base: string }> = [
  { prefix: '@/', base: 'apps/web' },
];

const FIX_FLAG = process.argv.includes('--fix');

function getArgValue(flag: string): string | undefined {
  const index = process.argv.findIndex((arg) => arg === flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const scopeArg = getArgValue('--scope');
const entryArg = getArgValue('--entry');
const scanArg = getArgValue('--scan');

const scopes = scopeArg
  ? scopeArg.split(',').map((entry) => entry.trim()).filter(Boolean)
  : DEFAULT_SCOPES;
const entryDirs = entryArg
  ? entryArg.split(',').map((entry) => entry.trim()).filter(Boolean)
  : ['apps/web/app', 'apps/web/__tests__'];
const scanDirs = scanArg
  ? scanArg.split(',').map((entry) => entry.trim()).filter(Boolean)
  : DEFAULT_SCAN_DIRS;

const rootDir = process.cwd();

function exists(filePath: string): boolean {
  try {
    statSync(filePath);
    return true;
  } catch {
    return false;
  }
}

function isSourceFile(filePath: string): boolean {
  if (filePath.endsWith('.d.ts')) return false;
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

function collectSourceFiles(target: string): string[] {
  if (!exists(target)) return [];
  const stats = statSync(target);
  if (stats.isFile()) {
    return isSourceFile(target) ? [target] : [];
  }
  const results: string[] = [];
  const entries = readdirSync(target);
  for (const entry of entries) {
    const fullPath = join(target, entry);
    const childStats = statSync(fullPath);
    if (childStats.isDirectory()) {
      if (isIgnoredDir(entry)) continue;
      results.push(...collectSourceFiles(fullPath));
    } else if (childStats.isFile() && isSourceFile(fullPath)) {
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

function resolveCandidate(base: string): string | null {
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

function resolveImport(fromFile: string, specifier: string): string | null {
  for (const alias of ALIAS_PREFIXES) {
    if (specifier.startsWith(alias.prefix)) {
      const aliasPath = specifier.slice(alias.prefix.length);
      const base = resolve(rootDir, alias.base, aliasPath);
      const resolved = resolveCandidate(base);
      if (resolved) return resolved;
    }
  }

  const base = resolve(fromFile, '..', specifier);
  return resolveCandidate(base);
}

function isResolvableSpecifier(specifier: string): boolean {
  if (specifier.startsWith('.')) return true;
  return ALIAS_PREFIXES.some((alias) => specifier.startsWith(alias.prefix));
}

function buildImportGraph(files: string[]): Map<string, Set<string>> {
  const fileSet = new Set(files);
  const graph = new Map<string, Set<string>>();
  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    const imports = extractImports(content)
      .filter((specifier) => isResolvableSpecifier(specifier))
      .map((specifier) => resolveImport(file, specifier))
      .filter((target): target is string => Boolean(target) && fileSet.has(target));
    graph.set(file, new Set(imports));
  }
  return graph;
}

function detectCycles(graph: Map<string, Set<string>>): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const stack = new Set<string>();

  const visit = (node: string, path: string[]) => {
    if (stack.has(node)) {
      const start = path.indexOf(node);
      if (start >= 0) cycles.push([...path.slice(start), node]);
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

function collectReachable(graph: Map<string, Set<string>>, roots: Set<string>): Set<string> {
  const reachable = new Set<string>();
  const stack = [...roots];
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

function extractExportedNames(content: string): Set<string> {
  const names = new Set<string>();
  const exportRegex = /export\s+(?:const|let|var|function|class|interface|type|enum)\s+([A-Za-z0-9_]+)/g;
  const namedExportRegex = /export\s+\{([^}]+)\}(?:\s+from\s+['"][^'"]+['"])?/g;
  const defaultRegex = /export\s+default\s+/g;

  let match: RegExpExecArray | null;
  while ((match = exportRegex.exec(content)) !== null) {
    names.add(match[1]);
  }

  while ((match = namedExportRegex.exec(content)) !== null) {
    const entries = match[1].split(',').map((entry) => entry.trim());
    for (const entry of entries) {
      if (!entry) continue;
      const [name] = entry.split(/\s+as\s+/i).map((part) => part.trim());
      if (name) names.add(name);
    }
  }

  if (defaultRegex.test(content)) {
    names.add('default');
  }

  return names;
}

function extractImportBindings(content: string): Array<{ names: string[]; specifier: string }> {
  const results: Array<{ names: string[]; specifier: string }> = [];
  const importRegex = /import\s+([^;]+?)\s+from\s+['"]([^'"]+)['"]/g;
  const dynamicRegex = /import\(['"]([^'"]+)['"]\)/g;

  let match: RegExpExecArray | null;
  while ((match = importRegex.exec(content)) !== null) {
    let raw = match[1].trim();
    if (raw.startsWith('type ')) {
      raw = raw.slice(5).trim();
    }
    const specifier = match[2];
    const names: string[] = [];

    if (raw.startsWith('{')) {
      const list = raw.replace(/[{}]/g, '').split(',').map((item) => item.trim());
      for (const item of list) {
        if (!item) continue;
        const [name] = item.split(/\s+as\s+/i).map((part) => part.trim());
        if (name) names.push(name);
      }
    } else if (raw.startsWith('*')) {
      names.push('*');
    } else if (raw.length > 0) {
      names.push('default');
    }

    results.push({ names, specifier });
  }

  while ((match = dynamicRegex.exec(content)) !== null) {
    results.push({ names: ['*'], specifier: match[1] });
  }

  return results;
}

function buildUsageMap(scopeFiles: string[], scanFiles: string[]): UsageMap {
  const scopeSet = new Set(scopeFiles);
  const usage: UsageMap = new Map();

  const allFiles = [...scopeFiles, ...scanFiles];
  for (const file of allFiles) {
    const content = readFileSync(file, 'utf8');
    for (const { names, specifier } of extractImportBindings(content)) {
      if (!isResolvableSpecifier(specifier)) continue;
      const resolved = resolveImport(file, specifier);
      if (!resolved || !scopeSet.has(resolved)) continue;
      const current = usage.get(resolved) ?? new Set<string>();
      if (names.includes('*')) {
        current.add('*');
      } else {
        names.forEach((name) => current.add(name));
      }
      usage.set(resolved, current);
    }
  }

  return usage;
}

function isBarrelFile(content: string): boolean {
  const stripped = content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .trim();
  if (!stripped) return false;
  return stripped.split('\n').every((line) => line.trim().startsWith('export'));
}

function pruneUnusedExports(filePath: string, unused: Set<string>): boolean {
  const content = readFileSync(filePath, 'utf8');
  if (!isBarrelFile(content) || unused.size === 0) {
    return false;
  }

  const lines = content.split('\n');
  const updatedLines = lines.map((line) => {
    const match = line.match(/export\s+\{([^}]+)\}(.*)/);
    if (!match) return line;
    const entries = match[1]
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .filter((item) => {
        const [name] = item.split(/\s+as\s+/i).map((part) => part.trim());
        return name && !unused.has(name);
      });
    if (entries.length === 0) return '';
    return `export { ${entries.join(', ')} }${match[2] || ''}`.trimEnd();
  });

  writeFileSync(filePath, `${updatedLines.filter(Boolean).join('\n')}\n`);
  return true;
}

function run(): void {
  console.log(`Code health scopes: ${scopes.join(', ')}`);
  console.log(`Entry directories: ${entryDirs.join(', ')}`);
  console.log(`Scan directories: ${scanDirs.join(', ')}`);

  const scopeFiles = scopes.flatMap((scope) => collectSourceFiles(resolve(rootDir, scope)));
  const scanFilesAll = scanDirs.flatMap((entry) => collectSourceFiles(resolve(rootDir, entry)));
  const scopeSet = new Set(scopeFiles);
  const scanFiles = scanFilesAll.filter((file) => !scopeSet.has(file));

  const graph = buildImportGraph(scopeFiles);
  const cycles = detectCycles(graph);

  const usageMap = buildUsageMap(scopeFiles, scanFiles);
  const reachable = collectReachable(graph, new Set(usageMap.keys()));
  const orphanFiles = scopeFiles.filter((file) => !reachable.has(file));

  const exportMap: ExportMap = new Map();
  for (const file of scopeFiles) {
    exportMap.set(file, extractExportedNames(readFileSync(file, 'utf8')));
  }

  const unusedExports: Array<{ file: string; names: string[] }> = [];
  for (const [file, exports] of exportMap.entries()) {
    if (exports.size === 0) continue;
    const used = usageMap.get(file);
    if (used?.has('*')) continue;
    const unused = Array.from(exports).filter((name) => !used?.has(name));
    if (unused.length > 0) {
      unusedExports.push({ file, names: unused });
      if (FIX_FLAG) {
        pruneUnusedExports(file, new Set(unused));
      }
    }
  }

  if (cycles.length > 0) {
    console.error('\nCircular dependencies detected:');
    for (const cycle of cycles) {
      console.error(`  - ${cycle.map((file) => relative(rootDir, file)).join(' -> ')}`);
    }
  }

  if (orphanFiles.length > 0) {
    console.error('\nOrphan files detected:');
    for (const file of orphanFiles) {
      console.error(`  - ${relative(rootDir, file)}`);
    }
  }

  if (unusedExports.length > 0) {
    console.error('\nUnused exports detected:');
    for (const item of unusedExports) {
      console.error(`  - ${relative(rootDir, item.file)}: ${item.names.join(', ')}`);
    }
  }

  const hasIssues = cycles.length > 0 || orphanFiles.length > 0 || unusedExports.length > 0;
  if (hasIssues) {
    console.error('\nCode health checks failed. Resolve issues before continuing.');
    process.exit(1);
  }

  console.log('✅ Code health checks passed.');
}

run();
