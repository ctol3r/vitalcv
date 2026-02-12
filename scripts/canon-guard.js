#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const violations = [];

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  '.turbo',
  'dist',
  'build',
  'coverage',
]);

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function exists(filePath) {
  return fs.existsSync(filePath);
}

function listFiles(dir, predicate, out = []) {
  if (!exists(dir)) return out;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      listFiles(fullPath, predicate, out);
      continue;
    }

    if (predicate(fullPath)) {
      out.push(fullPath);
    }
  }

  return out;
}

function relative(filePath) {
  return path.relative(root, filePath).replace(/\\/g, '/');
}

function fail(message) {
  violations.push(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function scanAppImports() {
  const files = [
    ...listFiles(path.join(root, 'apps/api'), (file) => /\.(ts|tsx)$/.test(file)),
    ...listFiles(path.join(root, 'apps/web'), (file) => /\.(ts|tsx)$/.test(file)),
  ];

  const forbiddenImport =
    /from\s+['"][^'"]*(packages\/domain-events|packages\/domain-core|packages\/domain\/events|packages\/domain-common|@vitalcv\/domain-events|@vitalcv\/domain-core)[^'"]*['"]/;

  const redefinedCanonicalType =
    /\b(type|interface|class)\s+(RecognitionEvent|EmployerAcceptance|StartAttestation|VerificationReceipt|CredentialReadinessScore|CredentialCandidate|LicenseCandidate|EducationCandidate)\b/;

  for (const file of files) {
    const source = read(file);
    if (forbiddenImport.test(source)) {
      fail(`forbidden canonical import in ${relative(file)}; use @vitalcv/shared`);
    }

    if (redefinedCanonicalType.test(source)) {
      fail(`canonical type redefinition detected in ${relative(file)}; use @vitalcv/shared types`);
    }
  }
}

function scanRecognitionGuard() {
  const file = path.join(root, 'packages/domain-events/RecognitionEvent.ts');
  if (!exists(file)) {
    fail('missing canonical RecognitionEvent implementation');
    return;
  }

  const source = read(file);
  assert(source.includes('validateReceiptSet'), 'RecognitionEvent must validate receipt set');
  assert(
    source.includes('MISSING_PSV_RECEIPTS'),
    'RecognitionEvent must fail closed when PSV receipts are missing',
  );
}

function scanCrsDeterminism() {
  const file = path.join(root, 'packages/crs/CrsEngine.ts');
  if (!exists(file)) {
    fail('missing CRS engine implementation');
    return;
  }

  const source = read(file);
  assert(source.includes('validateReceiptSet'), 'CRS must derive from receipt validation');
  assert(!/Math\.random\(/.test(source), 'CRS must be deterministic (Math.random forbidden)');
  assert(!/\bcache\b/i.test(source), 'CRS must not use cache state');
}

function scanTrustStateGuard() {
  const file = path.join(root, 'packages/trust-state/TrustStateResolver.ts');
  if (!exists(file)) {
    fail('missing TrustStateResolver implementation');
    return;
  }

  const source = read(file);
  assert(
    source.includes('this.deps.crs.computeForClinician'),
    'TrustStateResolver must call CRS for trust decisions',
  );
  assert(
    source.includes("resolveReceiptStatus"),
    'TrustStateResolver must validate receipt decay/revocation',
  );
}

function scanSharedSdk() {
  const file = path.join(root, 'packages/shared/index.ts');
  if (!exists(file)) {
    fail('missing @vitalcv/shared canonical SDK');
    return;
  }

  const source = read(file);
  assert(source.includes("export * from './recognition'"), 'shared SDK must export recognition module');
  assert(source.includes("export * from './receipts'"), 'shared SDK must export receipts module');
  assert(source.includes("export * from './crs'"), 'shared SDK must export crs module');
}

function main() {
  scanAppImports();
  scanRecognitionGuard();
  scanCrsDeterminism();
  scanTrustStateGuard();
  scanSharedSdk();

  if (violations.length > 0) {
    console.error('Canon guard failed:');
    for (const violation of violations) {
      console.error(`- ${violation}`);
    }
    process.exit(1);
  }

  console.log('Canon guard passed');
}

main();
