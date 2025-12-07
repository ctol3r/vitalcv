#!/usr/bin/env tsx
/**
 * Script to scan for broken imports in the monorepo
 *
 * Usage: pnpm tsx scripts/scan-imports.ts
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

interface ImportIssue {
  file: string;
  import: string;
  line: number;
  issue: 'broken' | 'relative' | 'workspace';
}

const issues: ImportIssue[] = [];
const workspaceRoot = join(__dirname, '..');

// Patterns to check
const importPattern = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
const requirePattern = /require\(['"]([^'"]+)['"]\)/g;

function scanFile(filePath: string, root: string): void {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const relativePath = relative(root, filePath);

    // Check imports
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Match import statements
      let match;
      while ((match = importPattern.exec(line)) !== null) {
        const importPath = match[1];
        checkImport(filePath, importPath, lineNum, relativePath);
      }

      // Reset regex
      importPattern.lastIndex = 0;

      // Match require statements
      while ((match = requirePattern.exec(line)) !== null) {
        const importPath = match[1];
        checkImport(filePath, importPath, lineNum, relativePath);
      }

      requirePattern.lastIndex = 0;
    }
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error);
  }
}

function checkImport(filePath: string, importPath: string, lineNum: number, relativePath: string): void {
  // Skip node_modules, type imports, and external packages
  if (
    importPath.startsWith('node_modules') ||
    importPath.startsWith('@types/') ||
    importPath.startsWith('http://') ||
    importPath.startsWith('https://') ||
    !importPath.startsWith('.') && !importPath.startsWith('@')
  ) {
    return;
  }

  // Check for workspace imports (should use @vitalcv/*)
  if (importPath.startsWith('@') && !importPath.startsWith('@vitalcv/')) {
    issues.push({
      file: relativePath,
      import: importPath,
      line: lineNum,
      issue: 'workspace',
    });
    return;
  }

  // Check for deep relative imports (../../../../)
  if (importPath.startsWith('.')) {
    const depth = (importPath.match(/\.\.\//g) || []).length;
    if (depth > 3) {
      issues.push({
        file: relativePath,
        import: importPath,
        line: lineNum,
        issue: 'relative',
      });
    }

    // Try to resolve the import
    const dir = filePath.substring(0, filePath.lastIndexOf('/'));
    const resolved = join(dir, importPath);

    // Check if file exists
    try {
      statSync(resolved);
    } catch {
      // Try with .ts, .tsx extensions
      const extensions = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx'];
      let found = false;

      for (const ext of extensions) {
        try {
          statSync(resolved + ext);
          found = true;
          break;
        } catch {
          // Continue
        }
      }

      if (!found) {
        issues.push({
          file: relativePath,
          import: importPath,
          line: lineNum,
          issue: 'broken',
        });
      }
    }
  }
}

function scanDirectory(dir: string, root: string): void {
  try {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        // Skip node_modules, .git, dist, build, etc.
        if (
          entry === 'node_modules' ||
          entry === '.git' ||
          entry === 'dist' ||
          entry === 'build' ||
          entry === '.next' ||
          entry === '.turbo' ||
          entry.startsWith('.')
        ) {
          continue;
        }
        scanDirectory(fullPath, root);
      } else if (stat.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry)) {
        scanFile(fullPath, root);
      }
    }
  } catch (error) {
    console.error(`Error scanning ${dir}:`, error);
  }
}

// Main execution
console.log('Scanning monorepo for import issues...\n');

scanDirectory(join(workspaceRoot, 'apps'), workspaceRoot);
scanDirectory(join(workspaceRoot, 'packages'), workspaceRoot);

// Report issues
if (issues.length === 0) {
  console.log('✅ No import issues found!');
  process.exit(0);
}

console.log(`\n⚠️  Found ${issues.length} import issue(s):\n`);

const broken = issues.filter(i => i.issue === 'broken');
const relative = issues.filter(i => i.issue === 'relative');
const workspace = issues.filter(i => i.issue === 'workspace');

if (broken.length > 0) {
  console.log(`\n🔴 Broken imports (${broken.length}):`);
  broken.forEach(issue => {
    console.log(`  ${issue.file}:${issue.line} - ${issue.import}`);
  });
}

if (relative.length > 0) {
  console.log(`\n🟡 Deep relative imports (${relative.length}):`);
  relative.slice(0, 10).forEach(issue => {
    console.log(`  ${issue.file}:${issue.line} - ${issue.import}`);
  });
  if (relative.length > 10) {
    console.log(`  ... and ${relative.length - 10} more`);
  }
}

if (workspace.length > 0) {
  console.log(`\n🟠 Non-workspace imports (${workspace.length}):`);
  workspace.slice(0, 10).forEach(issue => {
    console.log(`  ${issue.file}:${issue.line} - ${issue.import}`);
  });
  if (workspace.length > 10) {
    console.log(`  ... and ${workspace.length - 10} more`);
  }
}

console.log('\n💡 Consider using workspace aliases (@vitalcv/*) for cross-package imports');
process.exit(issues.filter(i => i.issue === 'broken').length > 0 ? 1 : 0);

