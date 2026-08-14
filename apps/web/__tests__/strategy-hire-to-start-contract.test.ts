import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(process.cwd(), '../..');

function readRepoFile(path: string): string {
  return readFileSync(resolve(repoRoot, path), 'utf8');
}

const operatingBrief = readRepoFile('docs/strategy/vitalcv-strategy-operating-brief.md');
const categoryStrategy = readRepoFile('docs/strategy/vitalcv-category-strategy.md');
const beachhead = readRepoFile('docs/strategy/beachhead-decision.md');
const executionPlan = readRepoFile('docs/strategy/90-day-category-execution-plan.md');
const employersPage = readRepoFile('apps/web/app/employers/page.tsx');
const pilotPage = readRepoFile('apps/web/app/pilot/page.tsx');

describe('2026-08-14 clinician hire-to-start strategy contract', () => {
  it('keeps the dual-audience category exact across canonical strategy and buyer surfaces', () => {
    for (const source of [operatingBrief, categoryStrategy, executionPlan, employersPage, pilotPage]) {
      expect(source.replaceAll('**', '')).toContain(
        'VitalCV is the Clinician Hire-to-Start Platform',
      );
    }

    expect(categoryStrategy).toContain(
      'portable professional identity and employment\nnetwork for clinicians',
    );
  });

  it('records the broader physician and APP market as a founder supersession', () => {
    expect(beachhead).toContain('SUPERSEDED — see founder decision below');
    expect(beachhead).toContain('employed physicians and advanced practice providers');
    expect(beachhead).toContain('provider recruitment leadership');
    expect(executionPlan).toContain('no more than two service lines');
  });

  it('makes actual first day the outcome and keeps first-billable secondary', () => {
    expect(operatingBrief).toContain('employer-confirmed actual first day');
    expect(executionPlan).toContain('Employer-confirmed clinician starts enabled by a VitalCV profile');
    expect(executionPlan).toContain('First-billable is optional secondary data');
    expect(executionPlan).toContain('at least 12 complete, valid start');
  });

  it('keeps credentialing and final institutional authority outside VitalCV', () => {
    for (const source of [operatingBrief, categoryStrategy, executionPlan]) {
      expect(source).toMatch(/credentialing (?:platforms|service|systems)/i);
      expect(source).toMatch(/institution/i);
    }

    expect(employersPage).toContain('VitalCV is not a credentialing service');
    expect(employersPage).toContain('institution retains final credentialing');
    expect(pilotPage).toContain('does not replace your credentialing committee');
  });

  it('keeps billing disabled until signed entitlement and duplicate protections exist', () => {
    expect(operatingBrief).toContain('No start-triggered billing without active signed commercial entitlement');
    expect(executionPlan).toContain('may create at most one\nbillable event');
    expect(executionPlan).toContain('active signed commercial\nentitlement');
  });
});
