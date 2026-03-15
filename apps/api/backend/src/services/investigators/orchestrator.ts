/**
 * orchestrator.ts — Investigator Orchestrator
 *
 * Wires all investigators into the Intelligence Engine event bus
 * and manages periodic scan schedules. This is the bootstrap file —
 * call initInvestigators() once at app startup.
 *
 * Architecture:
 *   1. Register all investigators with the framework
 *   2. Subscribe to event bus triggers → route to evaluate()
 *   3. Schedule periodic scans → route to scan()
 *   4. Store findings in FeedStore
 */

import { log } from '../../obs/logger';
import { onIntelligenceEvent, type IntelligenceEvent } from '../intelligence/intelligenceEngine';
import {
  registerInvestigator,
  storeFinding,
  getSuppressionScore,
  getRegisteredInvestigators,
  getFeedStats,
  type Investigator,
  type InvestigatorResult,
} from './framework';
import { trustDeclineInvestigator } from './trustDeclineInvestigator';
import { divergenceInvestigator } from './divergenceInvestigator';
import { networkEmergenceInvestigator } from './networkEmergenceInvestigator';
import { freshnessInvestigator } from './freshnessInvestigator';

// ── Timeout wrapper ────────────────────────────────────────────────────────────

const INVESTIGATOR_TIMEOUT_MS = 30_000;

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      log('warn', `[Orchestrator] ${label} timed out after ${timeoutMs}ms`);
      resolve(null);
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeout]);
    clearTimeout(timer!);
    return result;
  } catch (err) {
    clearTimeout(timer!);
    log('error', `[Orchestrator] ${label} failed: ${(err as Error)?.message}`);
    return null;
  }
}

// ── Process findings ───────────────────────────────────────────────────────────

function processFindings(result: InvestigatorResult): number {
  let stored = 0;
  for (const finding of result.findings) {
    // Apply suppression from user feedback
    const suppression = getSuppressionScore(finding.investigator, finding.category);
    if (suppression >= 50) {
      log('debug', `[Orchestrator] Suppressed finding from ${finding.investigator} (suppression=${suppression})`);
      continue;
    }

    storeFinding(finding);
    stored++;
  }
  return stored;
}

// ── Event routing ──────────────────────────────────────────────────────────────

async function routeEvent(event: IntelligenceEvent): Promise<void> {
  const investigators = getRegisteredInvestigators();
  const matching = investigators.filter(
    inv => inv.config.enabled && inv.config.triggers.includes(event.type),
  );

  if (matching.length === 0) return;

  log('debug', `[Orchestrator] Routing ${event.type} to ${matching.length} investigator(s)`);

  // Run matching investigators in parallel, each with its own timeout
  const results = await Promise.all(
    matching.map(inv =>
      withTimeout(
        inv.evaluate(event),
        INVESTIGATOR_TIMEOUT_MS,
        `${inv.config.id}.evaluate(${event.type})`,
      ),
    ),
  );

  let totalFindings = 0;
  for (const result of results) {
    if (result) {
      totalFindings += processFindings(result);
    }
  }

  if (totalFindings > 0) {
    log('info', `[Orchestrator] ${event.type} produced ${totalFindings} finding(s)`);
  }
}

// ── Scan scheduling ────────────────────────────────────────────────────────────

const scanTimers = new Map<string, ReturnType<typeof setInterval>>();

function startScanSchedule(investigator: Investigator): void {
  if (investigator.config.scanIntervalMs <= 0) return;
  if (scanTimers.has(investigator.config.id)) return;

  const timer = setInterval(async () => {
    if (!investigator.config.enabled) return;

    log('info', `[Orchestrator] Running scheduled scan: ${investigator.config.id}`);
    const result = await withTimeout(
      investigator.scan(),
      INVESTIGATOR_TIMEOUT_MS * 2, // Scans get more time
      `${investigator.config.id}.scan()`,
    );

    if (result) {
      const stored = processFindings(result);
      log('info', `[Orchestrator] Scan ${investigator.config.id}: scanned ${result.scannedNpis} NPIs, ${stored} finding(s) stored, ${result.durationMs}ms`);
    }
  }, investigator.config.scanIntervalMs);

  scanTimers.set(investigator.config.id, timer);
}

function stopAllScans(): void {
  for (const [id, timer] of scanTimers) {
    clearInterval(timer);
    log('info', `[Orchestrator] Stopped scan schedule: ${id}`);
  }
  scanTimers.clear();
}

// ── Manual scan trigger ────────────────────────────────────────────────────────

export async function runAllScans(): Promise<{
  investigators: { id: string; findings: number; scannedNpis: number; durationMs: number }[];
  totalFindings: number;
  feedStats: ReturnType<typeof getFeedStats>;
}> {
  const investigators = getRegisteredInvestigators().filter(i => i.config.enabled);
  const results: { id: string; findings: number; scannedNpis: number; durationMs: number }[] = [];
  let totalFindings = 0;

  for (const inv of investigators) {
    const result = await withTimeout(
      inv.scan(),
      INVESTIGATOR_TIMEOUT_MS * 2,
      `${inv.config.id}.scan()`,
    );

    if (result) {
      const stored = processFindings(result);
      totalFindings += stored;
      results.push({
        id: inv.config.id,
        findings: stored,
        scannedNpis: result.scannedNpis,
        durationMs: result.durationMs,
      });
    } else {
      results.push({ id: inv.config.id, findings: 0, scannedNpis: 0, durationMs: 0 });
    }
  }

  return { investigators: results, totalFindings, feedStats: getFeedStats() };
}

// ── Bootstrap ──────────────────────────────────────────────────────────────────

let initialized = false;

export function initInvestigators(): void {
  if (initialized) return;
  initialized = true;

  log('info', '[Orchestrator] Initializing autonomous investigators...');

  // Register investigators
  const investigators: Investigator[] = [
    trustDeclineInvestigator,
    divergenceInvestigator,
    networkEmergenceInvestigator,
    freshnessInvestigator,
  ];

  for (const inv of investigators) {
    registerInvestigator(inv);
  }

  // Wire event bus
  const allTriggers = new Set<string>();
  for (const inv of investigators) {
    for (const trigger of inv.config.triggers) {
      allTriggers.add(trigger);
    }
  }

  for (const trigger of allTriggers) {
    onIntelligenceEvent(trigger as any, (event: IntelligenceEvent) => {
      // Fire and forget — don't block the event bus
      routeEvent(event).catch(err => {
        log('error', `[Orchestrator] Event routing failed: ${(err as Error)?.message}`);
      });
    });
  }

  // Start scan schedules
  for (const inv of investigators) {
    startScanSchedule(inv);
  }

  log('info', `[Orchestrator] ${investigators.length} investigators initialized, ${allTriggers.size} event triggers wired`);
}

export function shutdownInvestigators(): void {
  stopAllScans();
  initialized = false;
  log('info', '[Orchestrator] Investigators shut down');
}
