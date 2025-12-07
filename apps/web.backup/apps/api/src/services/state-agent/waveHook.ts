/**
 * Wave Completion Hook
 * Triggers state report generation when a wave completes
 */

import { PrismaClient } from '@prisma/client';
import { generateStateReport, formatAsMarkdown, formatAsJson } from '../../../../../packages/state-agent/src/index';
import type { StateReportOptions } from '../../../../../packages/state-agent/src/types';
import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';

const prisma = new PrismaClient();

const SNAPSHOTS_DIR = path.resolve(__dirname, '../../../../state-snapshots');

// Ensure snapshots directory exists
if (!fs.existsSync(SNAPSHOTS_DIR)) {
  fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
}

export interface WaveCompletionEvent {
  waveNumber: number;
  timestamp: string;
  triggeredBy?: string;
  commitHash?: string;
}

/**
 * Handle wave completion event
 * Generates state report and saves snapshot
 */
export async function handleWaveCompletion(event: WaveCompletionEvent): Promise<{
  success: boolean;
  snapshotPath?: string;
  reportId?: string;
  error?: string;
}> {
  try {
    // Get commit hash if not provided
    let commitHash = event.commitHash;
    if (!commitHash) {
      try {
        commitHash = child_process.execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
      } catch (e) {
        // Not in git repo
      }
    }

    const options: StateReportOptions = {
      includeNarrative: true,
      complianceLevel: 'standard',
      pouRole: 'Introspection',
      waveNumber: event.waveNumber,
      commitHash,
    };

    // Generate state report
    const report = await generateStateReport(prisma, options);

    // Generate timestamp for filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `wave-${event.waveNumber}-${timestamp}`;

    // Save markdown snapshot
    const markdownPath = path.join(SNAPSHOTS_DIR, `${filename}.md`);
    const markdown = formatAsMarkdown(report);
    fs.writeFileSync(markdownPath, markdown, 'utf-8');

    // Save JSON snapshot
    const jsonPath = path.join(SNAPSHOTS_DIR, `${filename}.json`);
    const json = formatAsJson(report);
    fs.writeFileSync(jsonPath, json, 'utf-8');

    // Save to database if StateSnapshot table exists
    try {
      await prisma.$executeRaw`
        INSERT INTO "StateSnapshot" ("waveNumber", "timestamp", "commitHash", "reportJson", "reportMarkdown", "createdAt")
        VALUES (${event.waveNumber}, ${event.timestamp}, ${commitHash || null}, ${json}, ${markdown}, NOW())
      `.catch(() => {
        // Table might not exist, that's okay
        console.warn('[state-agent] StateSnapshot table not found, skipping DB save');
      });
    } catch (e) {
      // Ignore DB errors
    }

    console.log(`[state-agent] Wave ${event.waveNumber} snapshot saved to ${filename}`);

    return {
      success: true,
      snapshotPath: markdownPath,
      reportId: filename,
    };
  } catch (error) {
    console.error('[state-agent] Failed to handle wave completion:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Manual trigger for wave completion
 * Can be called from API or coordinator agent
 */
export async function triggerWaveCompletion(
  waveNumber: number,
  triggeredBy?: string
): Promise<ReturnType<typeof handleWaveCompletion>> {
  const event: WaveCompletionEvent = {
    waveNumber,
    timestamp: new Date().toISOString(),
    triggeredBy,
  };

  return handleWaveCompletion(event);
}

