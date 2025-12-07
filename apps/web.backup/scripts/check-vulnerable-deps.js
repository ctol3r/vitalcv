#!/usr/bin/env node

/**
 * Security check script to prevent vulnerable React/Next.js versions
 *
 * This script validates package-lock.json against known vulnerable versions
 * of React, ReactDOM, and Next.js that are affected by React2Shell (CVE-2025-55182).
 *
 * Usage: node scripts/check-vulnerable-deps.js
 */

const fs = require('fs');
const path = require('path');

// Known vulnerable versions (React2Shell CVE-2025-55182)
const VULNERABLE_VERSIONS = {
  react: [
    '19.0.0',
    '19.1.0',
    '19.1.1',
    '19.2.0',
  ],
  'react-dom': [
    '19.0.0',
    '19.1.0',
    '19.1.1',
    '19.2.0',
  ],
  next: [
    // 15.0.x vulnerable
    ...Array.from({ length: 5 }, (_, i) => `15.0.${i}`),
    // 15.1.x vulnerable (0-8)
    ...Array.from({ length: 9 }, (_, i) => `15.1.${i}`),
    // 15.2.x vulnerable (0-5)
    ...Array.from({ length: 6 }, (_, i) => `15.2.${i}`),
    // 15.3.x vulnerable (0-5)
    ...Array.from({ length: 6 }, (_, i) => `15.3.${i}`),
    // 15.4.x vulnerable (0-7)
    ...Array.from({ length: 8 }, (_, i) => `15.4.${i}`),
    // 15.5.x vulnerable (0-6)
    ...Array.from({ length: 7 }, (_, i) => `15.5.${i}`),
    // 16.0.x vulnerable (0-6)
    ...Array.from({ length: 7 }, (_, i) => `16.0.${i}`),
  ],
};

// Minimum safe versions
const MIN_SAFE_VERSIONS = {
  react: '19.0.1',
  'react-dom': '19.0.1',
  next: '15.0.5',
};

function parseVersion(versionString) {
  // Remove prefixes like ^, ~, >=, etc.
  return versionString.replace(/^[\^~>=<]+/, '');
}

function isVulnerable(packageName, version) {
  const cleanVersion = parseVersion(version);
  const vulnerable = VULNERABLE_VERSIONS[packageName] || [];
  return vulnerable.includes(cleanVersion);
}

function checkLockFile(lockFilePath) {
  if (!fs.existsSync(lockFilePath)) {
    console.error(`❌ Lock file not found: ${lockFilePath}`);
    console.error('   Run "npm install" or "pnpm install" first.');
    process.exit(1);
  }

  const lockFileContent = fs.readFileSync(lockFilePath, 'utf8');
  const lockFile = JSON.parse(lockFileContent);

  const issues = [];
  const packages = lockFile.packages || lockFile.dependencies || {};

  // Check all packages (including nested dependencies)
  for (const [packagePath, packageData] of Object.entries(packages)) {
    const packageName = packagePath.split('node_modules/').pop() || packagePath;
    const version = packageData.version;

    if (!version) continue;

    // Check if this is a package we care about
    const baseName = packageName.split('/').pop();
    if (VULNERABLE_VERSIONS[baseName] && isVulnerable(baseName, version)) {
      issues.push({
        package: baseName,
        version: version,
        path: packagePath,
      });
    }
  }

  // Also check the root dependencies
  const rootDeps = {
    ...(lockFile.dependencies || {}),
    ...(lockFile.devDependencies || {}),
  };

  for (const [packageName, versionSpec] of Object.entries(rootDeps)) {
    if (VULNERABLE_VERSIONS[packageName]) {
      const version = typeof versionSpec === 'string'
        ? parseVersion(versionSpec)
        : versionSpec?.version || parseVersion(versionSpec);

      if (isVulnerable(packageName, version)) {
        issues.push({
          package: packageName,
          version: version,
          path: 'root',
        });
      }
    }
  }

  return issues;
}

function checkPackageJson(packageJsonPath) {
  if (!fs.existsSync(packageJsonPath)) {
    console.error(`❌ package.json not found: ${packageJsonPath}`);
    process.exit(1);
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const allDeps = {
    ...(packageJson.dependencies || {}),
    ...(packageJson.devDependencies || {}),
  };

  const issues = [];
  const warnings = [];

  for (const [packageName, versionSpec] of Object.entries(allDeps)) {
    if (VULNERABLE_VERSIONS[packageName]) {
      const version = parseVersion(versionSpec);

      // Check for vulnerable versions
      if (isVulnerable(packageName, version)) {
        issues.push({
          package: packageName,
          version: version,
          spec: versionSpec,
        });
      }

      // Warn about version ranges (^, ~)
      if (versionSpec.startsWith('^') || versionSpec.startsWith('~')) {
        warnings.push({
          package: packageName,
          spec: versionSpec,
          message: `Version range detected. Pin to exact version for security.`,
        });
      }
    }
  }

  return { issues, warnings };
}

function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const packageJsonPath = path.join(projectRoot, 'package.json');
  const lockFilePath = path.join(projectRoot, 'package-lock.json');
  const pnpmLockPath = path.join(projectRoot, 'pnpm-lock.yaml');

  console.log('🔍 Checking for vulnerable React/Next.js versions...\n');

  // Check package.json
  const { issues: pkgIssues, warnings: pkgWarnings } = checkPackageJson(packageJsonPath);

  // Check lock file (prefer npm, fallback to pnpm)
  let lockIssues = [];
  if (fs.existsSync(lockFilePath)) {
    lockIssues = checkLockFile(lockFilePath);
  } else if (fs.existsSync(pnpmLockPath)) {
    console.log('⚠️  pnpm-lock.yaml detected. Full pnpm support coming soon.');
    console.log('   Checking package.json only for now.\n');
  }

  // Combine issues
  const allIssues = [...pkgIssues, ...lockIssues];
  const uniqueIssues = Array.from(
    new Map(allIssues.map(issue => [`${issue.package}@${issue.version}`, issue])).values()
  );

  // Report warnings
  if (pkgWarnings.length > 0) {
    console.log('⚠️  Warnings:\n');
    pkgWarnings.forEach(({ package: pkg, spec, message }) => {
      console.log(`   ${pkg}: ${spec}`);
      console.log(`   ${message}\n`);
    });
  }

  // Report issues
  if (uniqueIssues.length > 0) {
    console.error('❌ VULNERABLE VERSIONS DETECTED:\n');
    uniqueIssues.forEach(({ package: pkg, version, path: pkgPath }) => {
      console.error(`   ${pkg}@${version} (React2Shell CVE-2025-55182)`);
      if (pkgPath !== 'root') {
        console.error(`   Found at: ${pkgPath}`);
      }
      console.error(`   Minimum safe version: ${MIN_SAFE_VERSIONS[pkg] || 'See docs/security/frontend-deps.md'}\n`);
    });

    console.error('📚 See docs/security/frontend-deps.md for upgrade instructions.');
    console.error('\n❌ Build failed due to security check.');
    process.exit(1);
  }

  if (pkgWarnings.length === 0) {
    console.log('✅ No vulnerable versions detected.');
    console.log('✅ All React/Next.js dependencies are pinned to safe versions.\n');
  } else {
    console.log('✅ No vulnerable versions detected.');
    console.log('⚠️  Consider pinning versions to exact numbers (remove ^ and ~) for better security.\n');
  }

  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = { checkPackageJson, checkLockFile, isVulnerable, VULNERABLE_VERSIONS };

