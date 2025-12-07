#!/usr/bin/env tsx
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const repoRoot = process.cwd();
const bannedPatterns: Array<{ id: string; regex: RegExp; description: string }> = [
  { id: 'aws-access-key', regex: /AKIA[0-9A-Z]{16}/g, description: 'AWS access key' },
  { id: 'slack-token', regex: /xox[a-zA-Z]-[0-9a-zA-Z-]{10,48}/g, description: 'Slack token' },
  { id: 'openai-key', regex: /sk-[a-zA-Z0-9]{20,48}/g, description: 'OpenAI key' },
  { id: 'private-key-block', regex: /-----BEGIN (?:RSA|EC|DSA|PRIVATE) KEY-----[\s\S]+?-----END (?:RSA|EC|DSA|PRIVATE) KEY-----/g, description: 'PEM private key' },
  { id: 'vault-dev-token', regex: /s\..{30,}/g, description: 'Vault token' },
];

const allowList = new Set(
  (process.env.SECRET_SCAN_ALLOWLIST || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
);

interface Finding {
  file: string;
  id: string;
  description: string;
  line: number;
  snippet: string;
}

function isBinary(buffer: Buffer) {
  return buffer.includes(0);
}

function shouldSkip(file: string) {
  if (!file) return true;
  if (allowList.has(file)) return true;
  return file.includes('node_modules/') || file.includes('dist/') || file.includes('.git/');
}

function scanFile(file: string): Finding[] {
  const absolute = path.join(repoRoot, file);
  if (!fs.existsSync(absolute)) {
    return [];
  }

  const buffer = fs.readFileSync(absolute);
  if (isBinary(buffer)) {
    return [];
  }

  const content = buffer.toString('utf-8');
  const findings: Finding[] = [];

  bannedPatterns.forEach(pattern => {
    let match: RegExpExecArray | null;
    while ((match = pattern.regex.exec(content)) !== null) {
      const before = content.slice(0, match.index);
      const line = before.split('\n').length;
      const snippet = match[0].split('\n')[0];
      findings.push({
        file,
        id: pattern.id,
        description: pattern.description,
        line,
        snippet,
      });
    }
    pattern.regex.lastIndex = 0;
  });

  return findings;
}

function run() {
  const trackedFiles = execSync('git ls-files', { encoding: 'utf-8' })
    .split('\n')
    .map(file => file.trim())
    .filter(Boolean);

  const findings: Finding[] = [];

  trackedFiles.forEach(file => {
    if (shouldSkip(file)) return;
    findings.push(...scanFile(file));
  });

  if (!findings.length) {
    console.log('✅ Secret scan clean');
    return;
  }

  console.error('❌ Secret scan detected high-risk patterns:');
  findings.forEach(finding => {
    console.error(
      `  - [${finding.id}] ${finding.description} in ${finding.file}:${finding.line} :: ${finding.snippet}`
    );
  });
  process.exitCode = 1;
}

run();

