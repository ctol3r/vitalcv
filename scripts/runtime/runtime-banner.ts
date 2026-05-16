#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';

export interface RuntimeContext {
  pid: number;
  cwd: string;
  repoRoot: string;
  worktree: string;
  gitSha: string;
  branch: string;
  runtimeRole: string;
  deploymentMode: string;
  envLabel: string;
  port: number;
  doctrineVersion: string;
  deploymentId: string | null;
  lockFile: string;
}

function runGit(args: string[], cwd: string): string {
  return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();
}

function readDoctrineVersion(repoRoot: string): string {
  const candidateFiles = ['DOCTRINE.md', 'AGENTS.md'];
  for (const relativePath of candidateFiles) {
    try {
      const contents = readFileSync(path.join(repoRoot, relativePath), 'utf8');
      const match = contents.match(/Version:\s*([^\r\n]+)/m);
      if (match?.[1]?.trim()) {
        return match[1].trim();
      }
    } catch {
      // try next file
    }
  }

  return 'unknown';
}

function resolveRepoRoot(cwd: string): string {
  return runGit(['rev-parse', '--show-toplevel'], cwd);
}

function resolveDeploymentMode(): string {
  return (
    process.env.VITALCV_DEPLOYMENT_MODE?.trim() ||
    process.env.VERCEL_ENV?.trim() ||
    process.env.NODE_ENV?.trim() ||
    'local'
  );
}

function resolveEnvLabel(): string {
  return process.env.VITALCV_ENV_LABEL?.trim() || process.env.VERCEL_ENV?.trim() || process.env.NODE_ENV?.trim() || 'local';
}

function resolveRuntimeRole(): string {
  return process.env.VITALCV_RUNTIME_ROLE?.trim() || 'web';
}

function resolvePort(): number {
  const raw = process.env.VITALCV_CANONICAL_PORT?.trim() || process.env.PORT?.trim() || '3030';
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 3030;
}

function resolveDeploymentId(): string | null {
  const raw =
    process.env.VERCEL_DEPLOYMENT_ID?.trim() ||
    process.env.VITALCV_DEPLOYMENT_ID?.trim() ||
    process.env.DEPLOYMENT_ID?.trim() ||
    '';
  return raw.length > 0 ? raw : null;
}

export function getRuntimeContext(cwd = process.cwd()): RuntimeContext {
  const repoRoot = resolveRepoRoot(cwd);
  const worktree = repoRoot;
  const gitSha = runGit(['rev-parse', 'HEAD'], repoRoot);
  const branch = runGit(['branch', '--show-current'], repoRoot) || '(detached HEAD)';
  const port = resolvePort();
  const runtimeRole = resolveRuntimeRole();
  const deploymentMode = resolveDeploymentMode();
  const envLabel = resolveEnvLabel();
  const doctrineVersion = readDoctrineVersion(repoRoot);
  const deploymentId = resolveDeploymentId();
  const lockFile = process.env.VITALCV_RUNTIME_LOCK_FILE?.trim() ||
    path.join(os.tmpdir(), 'vitalcv', 'runtime', 'canonical-runtime.lock');

  return {
    pid: process.pid,
    cwd,
    repoRoot,
    worktree,
    gitSha,
    branch,
    runtimeRole,
    deploymentMode,
    envLabel,
    port,
    doctrineVersion,
    deploymentId,
    lockFile,
  };
}

export function buildRuntimeBanner(context: RuntimeContext): string {
  const lines = [
    '=== VitalCV Canonical Runtime ===',
    `git SHA: ${context.gitSha}`,
    `branch: ${context.branch}`,
    `worktree: ${context.worktree}`,
    `runtime role: ${context.runtimeRole}`,
    `deployment mode: ${context.deploymentMode}`,
    `env label: ${context.envLabel}`,
    `port: ${context.port}`,
    `doctrine version: ${context.doctrineVersion}`,
  ];

  if (context.deploymentId) {
    lines.push(`deployment id: ${context.deploymentId}`);
  }

  return lines.join('\n');
}

export function printRuntimeBanner(context = getRuntimeContext()): string {
  const banner = buildRuntimeBanner(context);
  process.stdout.write(`${banner}\n`);
  return banner;
}

function main(): void {
  printRuntimeBanner();
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('/runtime-banner.ts')) {
  main();
}
