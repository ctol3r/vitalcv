#!/usr/bin/env tsx
/**
 * Script to scan for compliance-sensitive files and potential PHI/PII leaks
 *
 * Usage: pnpm tsx scripts/scan-compliance.ts
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

interface ComplianceIssue {
  file: string;
  line: number;
  type: 'phi' | 'pii' | 'secret' | 'sensitive';
  pattern: string;
  context: string;
}

const issues: ComplianceIssue[] = [];
const workspaceRoot = join(__dirname, '..');

// Patterns to detect
const patterns = {
  phi: [
    /ssn|social\s*security/i,
    /medical\s*record|patient\s*data|phi|protected\s*health/i,
    /diagnosis|treatment|prescription/i,
    /date\s*of\s*birth|dob|birthdate/i,
  ],
  pii: [
    /credit\s*card|card\s*number|ccn/i,
    /passport|driver\s*license|dl\s*number/i,
    /email.*password|password.*email/i,
    /full\s*name.*address|address.*full\s*name/i,
  ],
  secret: [
    /api[_-]?key\s*[:=]\s*['"][^'"]+['"]/i,
    /secret\s*[:=]\s*['"][^'"]+['"]/i,
    /password\s*[:=]\s*['"][^'"]+['"]/i,
    /token\s*[:=]\s*['"][^'"]+['"]/i,
    /private[_-]?key/i,
  ],
  sensitive: [
    /\.env[^.]|process\.env\./,
    /hardcoded.*password|password.*hardcoded/i,
    /TODO.*secret|FIXME.*key/i,
  ],
};

const excludePatterns = [
  /node_modules/,
  /\.git/,
  /dist/,
  /build/,
  /\.next/,
  /coverage/,
  /\.turbo/,
  /package-lock\.json/,
  /pnpm-lock\.yaml/,
  /\.log$/,
  /\.md$/,
  /\.lock$/,
];

function shouldExclude(filePath: string): boolean {
  return excludePatterns.some(pattern => pattern.test(filePath));
}

function scanFile(filePath: string, root: string): void {
  if (shouldExclude(filePath)) return;

  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const relativePath = relative(root, filePath);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Check each pattern category
      for (const [category, categoryPatterns] of Object.entries(patterns)) {
        for (const pattern of categoryPatterns) {
          if (pattern.test(line)) {
            // Extract context (surrounding lines)
            const start = Math.max(0, i - 2);
            const end = Math.min(lines.length - 1, i + 2);
            const context = lines.slice(start, end + 1).join('\n');

            issues.push({
              file: relativePath,
              line: lineNum,
              type: category as ComplianceIssue['type'],
              pattern: pattern.toString(),
              context: context.substring(0, 200), // Limit context length
            });
            break; // Only report once per line
          }
        }
      }
    }
  } catch (error) {
    // Skip binary files or files we can't read
    if (error instanceof Error && !error.message.includes('ENOENT')) {
      // Silently skip
    }
  }
}

function scanDirectory(dir: string, root: string): void {
  try {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);

      if (shouldExclude(fullPath)) continue;

      try {
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
          scanDirectory(fullPath, root);
        } else if (stat.isFile()) {
          // Only scan text files
          const ext = entry.split('.').pop()?.toLowerCase();
          const textExtensions = [
            'ts', 'tsx', 'js', 'jsx', 'json', 'yaml', 'yml',
            'md', 'txt', 'env', 'sh', 'sql', 'prisma',
          ];

          if (ext && textExtensions.includes(ext)) {
            scanFile(fullPath, root);
          }
        }
      } catch {
        // Skip files we can't access
        continue;
      }
    }
  } catch (error) {
    // Skip directories we can't access
  }
}

// Main execution
console.log('🔍 Scanning monorepo for compliance-sensitive content...\n');

scanDirectory(join(workspaceRoot, 'apps'), workspaceRoot);
scanDirectory(join(workspaceRoot, 'packages'), workspaceRoot);
scanDirectory(join(workspaceRoot, 'services'), workspaceRoot);

// Filter out false positives (common patterns in code/comments)
const filteredIssues = issues.filter(issue => {
  const context = issue.context.toLowerCase();

  // Filter out common false positives
  const falsePositives = [
    'example.com',
    'example@',
    'placeholder',
    'xxx-xxx-xxxx',
    '1234567890',
    'test@test.com',
    '// todo',
    '// fixme',
    'example',
    'sample',
  ];

  return !falsePositives.some(fp => context.includes(fp));
});

// Report issues
if (filteredIssues.length === 0) {
  console.log('✅ No compliance issues found!');
  process.exit(0);
}

console.log(`\n⚠️  Found ${filteredIssues.length} potential compliance issue(s):\n`);

const byType = {
  phi: filteredIssues.filter(i => i.type === 'phi'),
  pii: filteredIssues.filter(i => i.type === 'pii'),
  secret: filteredIssues.filter(i => i.type === 'secret'),
  sensitive: filteredIssues.filter(i => i.type === 'sensitive'),
};

if (byType.phi.length > 0) {
  console.log(`\n🔴 Potential PHI (Protected Health Information) - ${byType.phi.length}:`);
  byType.phi.slice(0, 5).forEach(issue => {
    console.log(`  ${issue.file}:${issue.line}`);
    console.log(`    Pattern: ${issue.pattern.substring(0, 50)}...`);
  });
  if (byType.phi.length > 5) {
    console.log(`  ... and ${byType.phi.length - 5} more`);
  }
}

if (byType.pii.length > 0) {
  console.log(`\n🟠 Potential PII (Personally Identifiable Information) - ${byType.pii.length}:`);
  byType.pii.slice(0, 5).forEach(issue => {
    console.log(`  ${issue.file}:${issue.line}`);
  });
  if (byType.pii.length > 5) {
    console.log(`  ... and ${byType.pii.length - 5} more`);
  }
}

if (byType.secret.length > 0) {
  console.log(`\n🔴 Potential Secrets/API Keys - ${byType.secret.length}:`);
  byType.secret.slice(0, 5).forEach(issue => {
    console.log(`  ${issue.file}:${issue.line}`);
    console.log(`    ⚠️  Review this file immediately!`);
  });
  if (byType.secret.length > 5) {
    console.log(`  ... and ${byType.secret.length - 5} more`);
  }
}

if (byType.sensitive.length > 0) {
  console.log(`\n🟡 Sensitive Patterns - ${byType.sensitive.length}:`);
  byType.sensitive.slice(0, 5).forEach(issue => {
    console.log(`  ${issue.file}:${issue.line}`);
  });
  if (byType.sensitive.length > 5) {
    console.log(`  ... and ${byType.sensitive.length - 5} more`);
  }
}

console.log('\n💡 Recommendations:');
console.log('  - Review flagged files for actual PHI/PII exposure');
console.log('  - Ensure secrets are in environment variables, not code');
console.log('  - Use .env.example files for configuration templates');
console.log('  - Implement proper data redaction for logs');

process.exit(byType.secret.length > 0 ? 1 : 0);

