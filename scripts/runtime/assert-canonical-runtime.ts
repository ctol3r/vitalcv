#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { buildRuntimeBanner, getRuntimeContext, printRuntimeBanner, type RuntimeContext } from './runtime-banner.ts';

type RuntimeProcess = {
  pid: number;
  ppid: number;
  command: string;
  cwd: string | null;
  ports: number[];
};

type LockState = {
  schema: 'vitalcv.runtime.lock.v1';
  pid: number;
  childPid: number | null;
  port: number;
  cwd: string;
  repoRoot: string;
  worktree: string;
  gitSha: string;
  branch: string;
  runtimeRole: string;
  deploymentMode: string;
  envLabel: string;
  doctrineVersion: string;
  deploymentId: string | null;
  command: string[] | null;
  state: 'booting' | 'running';
  startedAt: string;
  updatedAt: string;
};

function parseArgs(argv: string[]): {
  killShadows: boolean;
  reportOnly: boolean;
  overridePort: number | null;
  overrideRole: string | null;
  overrideDeploymentMode: string | null;
  overrideEnvLabel: string | null;
  lockFile: string | null;
  command: string[];
} {
  const flags: string[] = [];
  const commandSeparator = argv.indexOf('--');
  const before = commandSeparator >= 0 ? argv.slice(0, commandSeparator) : argv;
  const command = commandSeparator >= 0 ? argv.slice(commandSeparator + 1) : [];

  let overridePort: number | null = null;
  let overrideRole: string | null = null;
  let overrideDeploymentMode: string | null = null;
  let overrideEnvLabel: string | null = null;
  let lockFile: string | null = null;
  let killShadows = false;
  let reportOnly = false;

  for (let i = 0; i < before.length; i += 1) {
    const token = before[i];
    switch (token) {
      case '--kill-shadows':
        killShadows = true;
        break;
      case '--report-only':
        reportOnly = true;
        break;
      case '--port':
        overridePort = Number(before[++i] ?? '');
        break;
      case '--role':
        overrideRole = before[++i] ?? null;
        break;
      case '--deployment-mode':
        overrideDeploymentMode = before[++i] ?? null;
        break;
      case '--env-label':
        overrideEnvLabel = before[++i] ?? null;
        break;
      case '--lock-file':
        lockFile = before[++i] ?? null;
        break;
      default:
        flags.push(token);
        break;
    }
  }

  if (flags.length > 0) {
    process.stderr.write(`[canonical-runtime] unknown flags: ${flags.join(' ')}\n`);
  }

  return {
    killShadows,
    reportOnly,
    overridePort: Number.isFinite(overridePort) ? (overridePort as number) : null,
    overrideRole,
    overrideDeploymentMode,
    overrideEnvLabel,
    lockFile,
    command,
  };
}

function resolveContext(overrides: {
  port: number | null;
  role: string | null;
  deploymentMode: string | null;
  envLabel: string | null;
  lockFile: string | null;
}): RuntimeContext {
  const context = getRuntimeContext();
  return {
    ...context,
    port: overrides.port ?? context.port,
    runtimeRole: overrides.role ?? context.runtimeRole,
    deploymentMode: overrides.deploymentMode ?? context.deploymentMode,
    envLabel: overrides.envLabel ?? context.envLabel,
    lockFile:
      overrides.lockFile ??
      context.lockFile ??
      path.join(os.tmpdir(), 'vitalcv', 'runtime', 'canonical-runtime.lock'),
  };
}

function ensureLockDirectory(lockFile: string): void {
  mkdirSync(path.dirname(lockFile), { recursive: true });
}

function readLockState(lockFile: string): LockState | null {
  try {
    const raw = readFileSync(lockFile, 'utf8');
    return JSON.parse(raw) as LockState;
  } catch {
    return null;
  }
}

function writeLockState(lockFile: string, state: LockState): void {
  ensureLockDirectory(lockFile);
  writeFileSync(lockFile, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

function removeLockFile(lockFile: string): void {
  try {
    rmSync(lockFile);
  } catch {
    // ignore
  }
}

function isProcessAlive(pid: number): boolean {
  if (!Number.isFinite(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function execText(command: string, args: string[]): string {
  return execFileSync(command, args, { encoding: 'utf8' });
}

function discoverRuntimeProcesses(): RuntimeProcess[] {
  const ps = spawnSync('ps', ['-axo', 'pid=,ppid=,command='], { encoding: 'utf8' });
  if (ps.error || ps.status !== 0 || !ps.stdout) {
    return [];
  }

  const candidates: RuntimeProcess[] = [];
  for (const line of ps.stdout.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(/^(\d+)\s+(\d+)\s+(.*)$/);
    if (!match) continue;
    const pid = Number(match[1]);
    const ppid = Number(match[2]);
    const command = match[3].trim();
    if (!isNextServerCommand(command)) continue;
    candidates.push({
      pid,
      ppid,
      command,
      cwd: readProcessCwd(pid),
      ports: readProcessPorts(pid),
    });
  }

  return candidates;
}

function isNextServerCommand(command: string): boolean {
  return (
    /next-server/.test(command) ||
    /next\/dist\/bin\/next/.test(command) ||
    /next\s+(?:dev|start)\b/.test(command)
  );
}

function readProcessCwd(pid: number): string | null {
  try {
    const output = execText('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn']);
    const match = output.split('\n').find((line) => line.startsWith('n'));
    return match ? match.slice(1).trim() : null;
  } catch {
    return null;
  }
}

function readProcessPorts(pid: number): number[] {
  try {
    const output = execText('lsof', ['-nP', '-a', '-p', String(pid), '-iTCP', '-sTCP:LISTEN']);
    const ports = new Set<number>();
    for (const line of output.split('\n')) {
      const match = line.match(/:(\d+)\s+\(LISTEN\)/);
      if (match) {
        ports.add(Number(match[1]));
      }
    }
    return [...ports].sort((a, b) => a - b);
  } catch {
    return [];
  }
}

function formatRuntimeProcess(processInfo: RuntimeProcess): string {
  const portText = processInfo.ports.length > 0 ? processInfo.ports.join(',') : 'unknown';
  return `pid=${processInfo.pid} port=${portText} cwd=${processInfo.cwd ?? 'unknown'} cmd=${processInfo.command}`;
}

function fail(message: string): never {
  process.stderr.write(`[canonical-runtime] ${message}\n`);
  process.exit(1);
}

function assertNoShadowRuntimes(): RuntimeProcess[] {
  const active = discoverRuntimeProcesses().filter((proc) => proc.pid !== process.pid);
  if (active.length === 0) {
    return [];
  }

  const summary = active.map(formatRuntimeProcess).join('\n');
  fail(`shadow runtime(s) detected; aborting boot:\n${summary}`);
}

function assertCanonicalContext(context: RuntimeContext): void {
  const expectedPort = Number(process.env.VITALCV_CANONICAL_PORT ?? '3030');
  if (context.port !== expectedPort) {
    fail(`canonical port mismatch: expected ${expectedPort}, got ${context.port}`);
  }

  if (!context.worktree.endsWith('/vitalcv')) {
    fail(`canonical worktree mismatch: expected /Users/christoler/vitalcv, got ${context.worktree}`);
  }
}

function readLockOwner(lockFile: string): LockState | null {
  if (!existsSync(lockFile)) {
    return null;
  }

  const state = readLockState(lockFile);
  if (!state) {
    return null;
  }

  if (state.childPid && isProcessAlive(state.childPid)) {
    return state;
  }

  if (state.pid && isProcessAlive(state.pid)) {
    return state;
  }

  return null;
}

function ensureExclusiveLock(context: RuntimeContext): void {
  ensureLockDirectory(context.lockFile);

  const lockOwner = readLockOwner(context.lockFile);
  if (lockOwner) {
    fail(
      `canonical runtime lock already held by pid=${lockOwner.pid} childPid=${lockOwner.childPid ?? 'n/a'} port=${lockOwner.port}`,
    );
  }

  const lockState: LockState = {
    schema: 'vitalcv.runtime.lock.v1',
    pid: process.pid,
    childPid: null,
    port: context.port,
    cwd: context.cwd,
    repoRoot: context.repoRoot,
    worktree: context.worktree,
    gitSha: context.gitSha,
    branch: context.branch,
    runtimeRole: context.runtimeRole,
    deploymentMode: context.deploymentMode,
    envLabel: context.envLabel,
    doctrineVersion: context.doctrineVersion,
    deploymentId: context.deploymentId,
    command: null,
    state: 'booting',
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  writeLockState(context.lockFile, lockState);
}

function updateLock(context: RuntimeContext, patch: Partial<LockState>): void {
  const current = readLockState(context.lockFile);
  if (!current) {
    return;
  }

  const next: LockState = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  writeLockState(context.lockFile, next);
}

function cleanupLock(context: RuntimeContext): void {
  const state = readLockState(context.lockFile);
  if (!state) {
    return;
  }

  if (state.pid === process.pid) {
    removeLockFile(context.lockFile);
  }
}

function runKillShadows(context: RuntimeContext): void {
  const active = discoverRuntimeProcesses().filter((proc) => proc.pid !== process.pid);
  const lockOwner = readLockOwner(context.lockFile);
  const canonicalProcess =
    active.find((proc) => proc.ports.includes(context.port) && proc.cwd === path.join(context.repoRoot, 'apps/web')) ??
    active.find((proc) => proc.ports.includes(context.port)) ??
    null;
  const canonicalPid = lockOwner?.childPid ?? lockOwner?.pid ?? canonicalProcess?.pid ?? null;
  const victims = active.filter((proc) => proc.pid !== canonicalPid);

  if (victims.length === 0) {
    process.stdout.write('[canonical-runtime] no shadow runtimes found\n');
    return;
  }

  for (const victim of victims) {
    try {
      process.stdout.write(`[canonical-runtime] killing shadow runtime pid=${victim.pid} port=${victim.ports.join(',') || 'unknown'}\n`);
      process.kill(victim.pid, 'SIGTERM');
    } catch (error) {
      process.stderr.write(
        `[canonical-runtime] unable to terminate pid=${victim.pid}: ${
          error instanceof Error ? error.message : 'unknown error'
        }\n`,
      );
    }
  }
}

function spawnNextCommand(context: RuntimeContext, command: string[]): number {
  if (command.length === 0) {
    fail('no command supplied after --; boot wrapper cannot launch');
  }

  assertNoShadowRuntimes();
  ensureExclusiveLock(context);
  printRuntimeBanner(context);

  const child = spawn(command[0]!, command.slice(1), {
    cwd: context.cwd,
    env: {
      ...process.env,
      PORT: String(context.port),
      VITALCV_RUNTIME_LOCK_FILE: context.lockFile,
      VITALCV_RUNTIME_ROLE: context.runtimeRole,
      VITALCV_DEPLOYMENT_MODE: context.deploymentMode,
      VITALCV_ENV_LABEL: context.envLabel,
      VITALCV_CANONICAL_PORT: String(context.port),
      VITALCV_DOCTRINE_VERSION: context.doctrineVersion,
    },
    stdio: 'inherit',
  });

  updateLock(context, {
    childPid: child.pid ?? null,
    command,
    state: 'running',
  });

  const cleanup = (signal?: NodeJS.Signals) => {
    if (signal && child.pid) {
      try {
        process.kill(child.pid, signal);
      } catch {
        // ignore
      }
    }
    cleanupLock(context);
  };

  process.on('SIGINT', () => cleanup('SIGINT'));
  process.on('SIGTERM', () => cleanup('SIGTERM'));

  child.on('exit', (code, signal) => {
    cleanupLock(context);
    if (signal) {
      process.exitCode = 1;
      process.stderr.write(`[canonical-runtime] child exited via ${signal}\n`);
      return;
    }
    process.exitCode = code ?? 0;
  });

  child.on('error', (error) => {
    cleanupLock(context);
    fail(error.message);
  });

  return child.pid ?? 0;
}

function emitRuntimeMap(context: RuntimeContext): void {
  const active = discoverRuntimeProcesses();
  process.stdout.write(`${buildRuntimeBanner(context)}\n`);
  process.stdout.write('\n[canonical-runtime] active next-server processes\n');
  if (active.length === 0) {
    process.stdout.write('[canonical-runtime]   none found\n');
    return;
  }
  for (const entry of active) {
    process.stdout.write(`[canonical-runtime]   ${formatRuntimeProcess(entry)}\n`);
  }
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const context = resolveContext({
    port: args.overridePort,
    role: args.overrideRole,
    deploymentMode: args.overrideDeploymentMode,
    envLabel: args.overrideEnvLabel,
    lockFile: args.lockFile,
  });

  assertCanonicalContext(context);

  if (args.killShadows) {
    runKillShadows(context);
    return;
  }

  if (args.reportOnly || args.command.length === 0) {
    emitRuntimeMap(context);
    return;
  }

  spawnNextCommand(context, args.command);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('/assert-canonical-runtime.ts')) {
  main();
}
