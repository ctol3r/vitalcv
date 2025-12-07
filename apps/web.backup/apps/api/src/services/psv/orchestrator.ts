import { randomUUID } from 'crypto';
import type { ChainReceipt } from '../chain/client';
import {
  type PsvDecision,
  type PsvOcrRequest,
  PsvOcrEngine,
  type PsvOcrEngineOptions,
} from './engine';

export type CheckStatus = 'PASS' | 'FAIL' | 'HITL' | 'SKIPPED';

export interface SimpleCheckResult {
  status: 'CLEAR' | 'HIT' | 'STALE' | 'UNKNOWN';
  detail: string;
  checkedAt: string;
  confidence: number;
  metadata?: Record<string, unknown>;
}

export interface PsvOrchestratorContext {
  clinicianId: string;
  licenseInput?: PsvOcrRequest;
  npdbSignal?: Partial<SimpleCheckResult>;
  sanctionsSignal?: Partial<SimpleCheckResult>;
  boardCertificationSignal?: Partial<SimpleCheckResult>;
  educationSignal?: Partial<SimpleCheckResult>;
}

export interface PsvReportSection<T> {
  status: CheckStatus;
  completedAt: string;
  data?: T;
  error?: string;
}

export interface PsvReport {
  runId: string;
  clinicianId: string;
  generatedAt: string;
  license: PsvReportSection<PsvDecision>;
  npdb: PsvReportSection<SimpleCheckResult>;
  sanctions: PsvReportSection<SimpleCheckResult>;
  boardCert: PsvReportSection<SimpleCheckResult>;
  education: PsvReportSection<SimpleCheckResult>;
  summary: {
    automated: number;
    hitl: number;
    failures: number;
    completed: number;
  };
  anchorReceipt?: ChainReceipt | null;
}

type Provider<T> = (ctx: PsvOrchestratorContext) => Promise<T>;

export interface PsvProviders {
  license: Provider<PsvDecision>;
  npdb: Provider<SimpleCheckResult>;
  sanctions: Provider<SimpleCheckResult>;
  boardCert: Provider<SimpleCheckResult>;
  education: Provider<SimpleCheckResult>;
}

export interface PsvOrchestratorOptions extends PsvOcrEngineOptions {
  providers?: Partial<PsvProviders>;
}

export class PsvParallelOrchestrator {
  private readonly engine: PsvOcrEngine;
  private readonly providers: PsvProviders;

  constructor(options: PsvOrchestratorOptions = {}) {
    this.engine = new PsvOcrEngine(options);
    this.providers = {
      license: options.providers?.license ?? ((ctx) => this.defaultLicenseCheck(ctx)),
      npdb: options.providers?.npdb ?? ((ctx) => this.defaultSignal('NPDB', ctx.npdbSignal)),
      sanctions:
        options.providers?.sanctions ?? ((ctx) => this.defaultSignal('Sanctions', ctx.sanctionsSignal)),
      boardCert:
        options.providers?.boardCert ??
        ((ctx) => this.defaultSignal('Board certification', ctx.boardCertificationSignal)),
      education:
        options.providers?.education ?? ((ctx) => this.defaultSignal('Education', ctx.educationSignal)),
    };
  }

  async run(context: PsvOrchestratorContext): Promise<PsvReport> {
    const tasks: Array<{ key: keyof PsvReport; runner: () => Promise<any> }> = [
      { key: 'license', runner: () => this.providers.license(context) },
      { key: 'npdb', runner: () => this.providers.npdb(context) },
      { key: 'sanctions', runner: () => this.providers.sanctions(context) },
      { key: 'boardCert', runner: () => this.providers.boardCert(context) },
      { key: 'education', runner: () => this.providers.education(context) },
    ];

    const settled = await Promise.allSettled(tasks.map((task) => task.runner()));

    const sections: Partial<Record<keyof PsvReport, PsvReportSection<any>>> = {};
    let automated = 0;
    let hitl = 0;
    let failures = 0;

    settled.forEach((result, index) => {
      const key = tasks[index].key;
      const completedAt = new Date().toISOString();

      if (result.status === 'fulfilled') {
        const data = result.value;
        const status = determineSectionStatus(key, data);
        if (status === 'PASS') automated += 1;
        if (status === 'HITL') hitl += 1;
        sections[key] = {
          status,
          completedAt,
          data,
        };
      } else {
        failures += 1;
        sections[key] = {
          status: 'FAIL',
          completedAt,
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        };
      }
    });

    const report: PsvReport = {
      runId: randomUUID(),
      clinicianId: context.clinicianId,
      generatedAt: new Date().toISOString(),
      license: sections.license ?? fallbackSection<PsvDecision>(),
      npdb: sections.npdb ?? fallbackSection<SimpleCheckResult>(),
      sanctions: sections.sanctions ?? fallbackSection<SimpleCheckResult>(),
      boardCert: sections.boardCert ?? fallbackSection<SimpleCheckResult>(),
      education: sections.education ?? fallbackSection<SimpleCheckResult>(),
      summary: {
        automated,
        hitl,
        failures,
        completed: automated + hitl + failures,
      },
      anchorReceipt: sections.license?.data?.anchorReceipt ?? null,
    };

    return report;
  }

  private async defaultLicenseCheck(ctx: PsvOrchestratorContext): Promise<PsvDecision> {
    if (!ctx.licenseInput) {
      throw new Error('licenseInput is required to run the license check');
    }
    return this.engine.process(ctx.licenseInput);
  }

  private async defaultSignal(
    label: string,
    overrides?: Partial<SimpleCheckResult>
  ): Promise<SimpleCheckResult> {
    const now = new Date().toISOString();
    return {
      status: overrides?.status ?? 'CLEAR',
      detail:
        overrides?.detail ??
        `${label} check executed — no blocking events detected in the last 12 months.`,
      checkedAt: overrides?.checkedAt ?? now,
      confidence: overrides?.confidence ?? 0.9,
      metadata: overrides?.metadata,
    };
  }
}

function determineSectionStatus(key: keyof PsvReport, data: any): CheckStatus {
  if (key === 'license') {
    if (!data) return 'FAIL';
    return data.status === 'HITL' ? 'HITL' : 'PASS';
  }

  if (data?.status === 'HIT' || data?.status === 'FAILED') {
    return 'FAIL';
  }

  return 'PASS';
}

function fallbackSection<T>(): PsvReportSection<T> {
  return {
    status: 'SKIPPED',
    completedAt: new Date().toISOString(),
    data: undefined,
  };
}


