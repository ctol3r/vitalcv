/**
 * workbenchContextService.ts — Investigation Workbench Context Service
 *
 * Produces a unified, linked-context payload for the investigation workbench.
 * Given any combination of anchors (NPI, findingId, storylineId), resolves
 * the full investigation context:
 *
 *   Finding selected
 *     → provider context (trust + freshness + active findings)
 *     → storyline context (lifecycle, recommendations, evidence)
 *     → related findings (same provider)
 *     → graph navigation link
 *     → Copilot investigation link
 *
 * This is a read-only composition layer. It does not modify any state.
 * It reuses existing services and does not introduce new data models.
 */

import prisma from '../../graphql/prisma_client';
import {
  getFeedStats,
  getFindingById,
  queryFindings,
} from '../investigators/framework';
import { getStorylineDetail } from '../storylines/storylineService';
import { computeTrustScoreV1 } from '../trust/trustScoreV1';
import { log } from '../../obs/logger';
import {
  getInvestigatorFinding,
  listInvestigatorFindings,
} from '../investigators/investigatorEngineService';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface WorkbenchAnchor {
  npi?: string;
  findingId?: string;
  storylineId?: string;
}

export interface WorkbenchProviderContext {
  npi: string;
  label: string | null;
  specialty: string | null;
  state: string | null;
  trustScore: number;
  trustBand: string;
  trustConfidence: number;
  activeFindings: number;
  feedStats: {
    total: number;
    active: number;
  };
}

export interface WorkbenchEvidenceItem {
  source: string;
  claim: string;
  confidence: number;
  observedAt?: string | null;
}

export interface WorkbenchFindingContext {
  id: string;
  findingType: string;
  title: string;
  severity: string;
  status: string;
  summary: string;
  explanation: string;
  confidence: number;
  priorityScore: number;
  evidence: WorkbenchEvidenceItem[];
  actions: Array<{ id: string; label: string; type: string }>;
  relatedFindingIds: string[];
  storylineId: string | null;
  storylineTitle: string | null;
  npis: string[];
  createdAt: string;
}

export interface WorkbenchStorylineContext {
  id: string;
  title: string;
  storylineType: string;
  severity: string;
  status: string;
  narrative: string;
  whyItMatters: string;
  findingCount: number;
  entityCount: number;
  confidence: number;
  progressionScore: number;
  recommendedActions: string[];
  lastActivityAt: string;
  evidence: WorkbenchEvidenceItem[];
}

export interface WorkbenchRelatedFinding {
  id: string;
  findingType: string;
  title: string;
  severity: string;
  summary: string;
  priorityScore: number;
  href: string;
}

export interface WorkbenchGraphContext {
  graphHref: string;
  copilotHref: string;
  investigationHref: string;
}

export interface WorkbenchContext {
  anchor: WorkbenchAnchor;
  provider: WorkbenchProviderContext | null;
  finding: WorkbenchFindingContext | null;
  storyline: WorkbenchStorylineContext | null;
  relatedFindings: WorkbenchRelatedFinding[];
  navigation: WorkbenchGraphContext | null;
  feedBusStats: ReturnType<typeof getFeedStats>;
  generatedAt: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

// ── Workbench Resolution ───────────────────────────────────────────────────────

export async function getWorkbenchContext(
  anchor: WorkbenchAnchor,
): Promise<WorkbenchContext> {
  const result: WorkbenchContext = {
    anchor,
    provider: null,
    finding: null,
    storyline: null,
    relatedFindings: [],
    navigation: null,
    feedBusStats: getFeedStats(),
    generatedAt: new Date().toISOString(),
  };

  let resolvedNpi: string | null = anchor.npi ?? null;
  let resolvedStorylineId: string | null = anchor.storylineId ?? null;

  // ── 1. Resolve finding ─────────────────────────────────────────────────────
  if (anchor.findingId) {
    try {
      // Try persistent finding first (DB-backed)
      const persistentFinding = await getInvestigatorFinding(anchor.findingId);
      if (persistentFinding) {
        result.finding = {
          id: persistentFinding.findingId,
          findingType: persistentFinding.findingType,
          title: persistentFinding.title,
          severity: persistentFinding.severity,
          status: persistentFinding.status,
          summary: persistentFinding.summary,
          explanation: persistentFinding.explanation,
          confidence: persistentFinding.confidence,
          priorityScore: persistentFinding.priorityScore,
          evidence: persistentFinding.supportingEvidence.slice(0, 5).map(e => ({
            source: e.sourceId ?? e.evidenceType,
            claim: e.snippet ?? e.evidenceType,
            confidence: 0.8,
            observedAt: e.observedAt,
          })),
          actions: [],
          relatedFindingIds: [],
          storylineId: persistentFinding.storylineKey ?? null,
          storylineTitle: null,
          npis: persistentFinding.entityIds.filter(id => /^\d{10}$/.test(id)),
          createdAt: persistentFinding.createdAt,
        };

        // Infer NPI from entity IDs
        if (!resolvedNpi) {
          resolvedNpi = persistentFinding.entityIds.find(id => /^\d{10}$/.test(id)) ?? null;
        }
        if (!resolvedStorylineId && persistentFinding.storylineKey) {
          // storylineKey is not a DB ID, it's a fingerprint — skip auto-resolve
        }
      } else {
        // Fall back to in-memory FeedStore
        const memFinding = getFindingById(anchor.findingId);
        if (memFinding) {
          result.finding = {
            id: memFinding.id,
            findingType: memFinding.category,
            title: memFinding.title,
            severity: memFinding.severity,
            status: memFinding.status,
            summary: memFinding.summary,
            explanation: memFinding.explanation,
            confidence: memFinding.evidence.length > 0
              ? memFinding.evidence.reduce((s, e) => s + e.confidence, 0) / memFinding.evidence.length
              : 0.7,
            priorityScore: memFinding.score,
            evidence: memFinding.evidence.slice(0, 5).map(e => ({
              source: e.source,
              claim: e.claim,
              confidence: e.confidence,
              observedAt: e.timestamp,
            })),
            actions: memFinding.actions.map(a => ({ id: a.id, label: a.label, type: a.type })),
            relatedFindingIds: memFinding.relatedFindings,
            storylineId: null,
            storylineTitle: null,
            npis: memFinding.npis,
            createdAt: memFinding.createdAt,
          };

          if (!resolvedNpi && memFinding.npis.length > 0) {
            resolvedNpi = memFinding.npis[0] ?? null;
          }
        }
      }
    } catch (err) {
      log('warn', `[Workbench] Finding resolution failed: ${(err as Error)?.message}`);
    }
  }

  // ── 2. Resolve storyline ───────────────────────────────────────────────────
  if (resolvedStorylineId) {
    try {
      const detail = await getStorylineDetail(resolvedStorylineId, { sync: false });
      if (detail) {
        const s = detail.storyline;
        result.storyline = {
          id: s.storylineId,
          title: s.title,
          storylineType: s.storylineType,
          severity: s.severity,
          status: s.status,
          narrative: s.summary,
          whyItMatters: s.whyItMatters,
          findingCount: detail.findingLinks.length,
          entityCount: detail.entityLinks.length,
          confidence: s.confidence,
          progressionScore: s.progressionScore,
          recommendedActions: s.recommendedActions,
          lastActivityAt: s.lastActivityAt,
          evidence: s.supportingEvidence.slice(0, 5).map(e => ({
            source: e.source,
            claim: e.bullet,
            confidence: e.confidence,
            observedAt: e.observedAt,
          })),
        };

        // Infer NPI from entity links
        if (!resolvedNpi) {
          const providerEntity = detail.entityLinks.find(
            e => e.entityType === 'provider' && /^\d{10}$/.test(e.entityKey),
          );
          if (providerEntity) resolvedNpi = providerEntity.entityKey;
        }

        // Link storyline title back to finding context
        if (result.finding && !result.finding.storylineTitle) {
          result.finding.storylineTitle = s.title;
          result.finding.storylineId = s.storylineId;
        }
      }
    } catch (err) {
      log('warn', `[Workbench] Storyline resolution failed: ${(err as Error)?.message}`);
    }
  }

  // ── 3. Resolve provider context ────────────────────────────────────────────
  if (resolvedNpi) {
    try {
      const [profile, trustScore] = await Promise.all([
        prisma.personProfile.findFirst({
          where: { npi: resolvedNpi },
          select: {
            firstName: true,
            lastName: true,
            specialty: true,
            stateOfPractice: true,
          },
        }),
        computeTrustScoreV1(resolvedNpi),
      ]);

      const label = profile
        ? normalizeText([profile.firstName ?? '', profile.lastName ?? ''].join(' ')).trim() || null
        : null;

      const activeMemFindings = queryFindings({ npis: [resolvedNpi], status: ['ACTIVE'] }).length;

      result.provider = {
        npi: resolvedNpi,
        label,
        specialty: profile?.specialty ?? null,
        state: profile?.stateOfPractice ?? null,
        trustScore: trustScore.score,
        trustBand: trustScore.band,
        trustConfidence: trustScore.confidence,
        activeFindings: activeMemFindings,
        feedStats: {
          total: activeMemFindings,
          active: activeMemFindings,
        },
      };

      result.navigation = {
        graphHref: `/graph?npi=${resolvedNpi}`,
        copilotHref: `/intelligence?q=investigate+${resolvedNpi}`,
        investigationHref: `/investigations?npi=${resolvedNpi}`,
      };
    } catch (err) {
      log('warn', `[Workbench] Provider context failed: ${(err as Error)?.message}`);
    }
  }

  // ── 4. Related findings ────────────────────────────────────────────────────
  if (resolvedNpi) {
    try {
      const { findings } = await listInvestigatorFindings({
        provider: resolvedNpi,
        limit: 6,
        status: ['new', 'acknowledged', 'investigating'],
      });

      result.relatedFindings = findings
        .filter(f => f.findingId !== anchor.findingId)
        .slice(0, 5)
        .map(f => ({
          id: f.findingId,
          findingType: f.findingType,
          title: f.title,
          severity: f.severity,
          summary: f.summary,
          priorityScore: f.priorityScore,
          href: `/findings/${f.findingId}`,
        }));
    } catch (err) {
      log('warn', `[Workbench] Related findings failed: ${(err as Error)?.message}`);
      // Fallback: in-memory feed
      const memRelated = queryFindings({
        npis: resolvedNpi ? [resolvedNpi] : undefined,
        status: ['ACTIVE'],
        limit: 6,
      }).filter(f => f.id !== anchor.findingId);

      result.relatedFindings = memRelated.slice(0, 5).map(f => ({
        id: f.id,
        findingType: f.category,
        title: f.title,
        severity: f.severity,
        summary: f.summary,
        priorityScore: f.score,
        href: `/findings/${f.id}`,
      }));
    }
  }

  return result;
}
