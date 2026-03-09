/**
 * Ask VitalCV Service — Wave 185
 *
 * Natural-language answer planning over source-backed search results.
 * All answerable responses require surviving citations after ACL filtering.
 */

import { SearchObjectType } from '@prisma/client';
import { getOpportunity } from '../matcha/opportunityRegistry';
import { emitAnalyticsEvent, emitAuditEvent, createTraceId } from '../audit/auditService';
import { getEmployerBySlug } from '../employers/employerService';
import { log } from '../../obs/logger';
import { withToolSpan } from '../../tools/tracing';
import { sha256Hex } from '../../utils/deterministic';
import {
  querySearch,
  type SearchFreshnessStatus,
  type SearchQuery,
  type SearchResult,
} from './searchIndex';
import type { SearchRequestContext } from './requestContext';

export type IntentClass =
  | 'eligibility_check'
  | 'opportunity_search'
  | 'gap_analysis'
  | 'employer_lookup'
  | 'credential_info'
  | 'general_search';

export type AskAnswerStatus = 'ANSWERED' | 'NO_RESULTS' | 'GUARDRAIL_BLOCKED';

export interface AskContextInput {
  employerSlug?: string;
  employerName?: string;
  opportunityId?: string;
}

export interface AskFilters {
  employer?: string;
  type?: string;
  state?: string;
  hiringType?: string;
}

export interface SourceCitation {
  sourceKey: string;
  type: SearchObjectType;
  label: string;
  color: string;
  title: string;
  snippet: string;
  url?: string;
  referenceId?: string;
  freshAt?: string;
  freshnessStatus: SearchFreshnessStatus;
  provenance: string;
}

export interface SuggestedAction {
  label: string;
  href: string;
  reason: string;
}

export interface AskProvenanceSummary {
  generatedAt: string;
  sourceCount: number;
  sourceTypes: string[];
  freshestAt: string | null;
  citations: Array<{
    referenceId?: string;
    provenance: string;
    freshAt?: string;
    freshnessStatus: SearchFreshnessStatus;
  }>;
}

export interface AskResponse {
  query: string;
  intent: IntentClass;
  status: AskAnswerStatus;
  answer: string;
  sources: SourceCitation[];
  suggestedActions: SuggestedAction[];
  provenance: AskProvenanceSummary;
  traceId: string;
  noResults: boolean;
  guardrailTriggered: boolean;
  durationMs: number;
}

export interface AskInput {
  q: string;
  requestContext: SearchRequestContext;
  context?: AskContextInput;
  filters?: AskFilters;
}

const INTENT_PATTERNS: Array<[RegExp, IntentClass]> = [
  [/\b(cleared|clear to start|eligible|can i (start|work)|am i (ready|qualified))\b/i, 'eligibility_check'],
  [/\b(show|find|list|employers?|hiring|jobs?|roles?|positions?|opportunities)\b/i, 'opportunity_search'],
  [/\b(missing|gap|what (do i|else|is|are)|need(ed)?|require(d|ments)?)\b/i, 'gap_analysis'],
  [/\b(kaiser|hospital|clinic|org|require(s)?|what does .* (need|require|want)|employer)\b/i, 'employer_lookup'],
  [/\b(dea|license|board cert|npi|credential|certif|how (do|to)|steps?)\b/i, 'credential_info'],
];

const SOURCE_CONFIG: Record<SearchObjectType, { label: string; color: string; sourceKey: string }> = {
  PUBLIC_PAGE: { label: 'VitalCV Site', color: 'text-vt-neutral-200', sourceKey: 'public-page' },
  EMPLOYER_PROFILE: { label: 'Employer Page', color: 'text-vt-info', sourceKey: 'employer-profile' },
  OPPORTUNITY: { label: 'Opportunity', color: 'text-vt-success', sourceKey: 'opportunity' },
  ISSUER_PROFILE: { label: 'Issuer Registry', color: 'text-vt-warning', sourceKey: 'issuer-profile' },
  TRUST_STATE_SUMMARY: { label: 'Trust State', color: 'text-vt-success', sourceKey: 'trust-state' },
  AUDIT_EVENT_SUMMARY: { label: 'Audit Record', color: 'text-vt-danger', sourceKey: 'audit-summary' },
  FAQ_DOC: { label: 'Help Docs', color: 'text-vt-neutral-200', sourceKey: 'faq-doc' },
  CONNECTED_RECORD: { label: 'Connected Source', color: 'text-vt-brand-primary', sourceKey: 'connected-record' },
};

const GUARDRAIL_PATTERNS = [
  /\b(patient|phi|health record|diagnosis|prescription|medication|ssn|social security)\b/i,
  /\b(guaranteed|definitely|certain|always|never)\b/i,
];

function classifyIntent(q: string, context?: AskContextInput): IntentClass {
  if (context?.employerSlug || context?.employerName) {
    return 'employer_lookup';
  }

  for (const [pattern, intent] of INTENT_PATTERNS) {
    if (pattern.test(q)) {
      return intent;
    }
  }

  return 'general_search';
}

function planRetrieval(intent: IntentClass, context?: AskContextInput): SearchObjectType[] {
  const plannedTypes = new Set<SearchObjectType>();

  switch (intent) {
    case 'eligibility_check':
      plannedTypes.add('TRUST_STATE_SUMMARY');
      plannedTypes.add('OPPORTUNITY');
      plannedTypes.add('EMPLOYER_PROFILE');
      break;
    case 'opportunity_search':
      plannedTypes.add('OPPORTUNITY');
      plannedTypes.add('EMPLOYER_PROFILE');
      break;
    case 'gap_analysis':
      plannedTypes.add('TRUST_STATE_SUMMARY');
      plannedTypes.add('FAQ_DOC');
      plannedTypes.add('EMPLOYER_PROFILE');
      break;
    case 'employer_lookup':
      plannedTypes.add('EMPLOYER_PROFILE');
      plannedTypes.add('OPPORTUNITY');
      plannedTypes.add('TRUST_STATE_SUMMARY');
      plannedTypes.add('CONNECTED_RECORD');
      break;
    case 'credential_info':
      plannedTypes.add('FAQ_DOC');
      plannedTypes.add('ISSUER_PROFILE');
      plannedTypes.add('PUBLIC_PAGE');
      plannedTypes.add('CONNECTED_RECORD');
      break;
    default:
      plannedTypes.add('PUBLIC_PAGE');
      plannedTypes.add('FAQ_DOC');
      plannedTypes.add('OPPORTUNITY');
      plannedTypes.add('EMPLOYER_PROFILE');
  }

  if (context?.employerSlug) {
    plannedTypes.add('EMPLOYER_PROFILE');
    plannedTypes.add('TRUST_STATE_SUMMARY');
  }

  if (context?.opportunityId) {
    plannedTypes.add('OPPORTUNITY');
    plannedTypes.add('TRUST_STATE_SUMMARY');
  }

  return [...plannedTypes];
}

function buildSourceCitations(results: SearchResult[]): SourceCitation[] {
  return results.map((result) => ({
    sourceKey: SOURCE_CONFIG[result.type].sourceKey,
    type: result.type,
    label: SOURCE_CONFIG[result.type].label,
    color: SOURCE_CONFIG[result.type].color,
    title: result.title,
    snippet: result.snippet,
    url: result.sourceUrl,
    referenceId: result.referenceId,
    freshAt: result.freshAt,
    freshnessStatus: result.freshnessStatus,
    provenance: result.provenance,
  }));
}

function buildProvenanceSummary(citations: SourceCitation[]): AskProvenanceSummary {
  return {
    generatedAt: new Date().toISOString(),
    sourceCount: citations.length,
    sourceTypes: [...new Set(citations.map((citation) => citation.type))],
    freshestAt: citations
      .map((citation) => citation.freshAt)
      .filter((value): value is string => Boolean(value))
      .sort((left, right) => right.localeCompare(left))[0] ?? null,
    citations: citations.map((citation) => ({
      referenceId: citation.referenceId,
      provenance: citation.provenance,
      freshAt: citation.freshAt,
      freshnessStatus: citation.freshnessStatus,
    })),
  };
}

function dedupeActions(actions: SuggestedAction[]): SuggestedAction[] {
  const seen = new Set<string>();
  return actions.filter((action) => {
    const key = `${action.label}:${action.href}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function buildActions(
  intent: IntentClass,
  requestContext: SearchRequestContext,
  context: AskContextInput | undefined,
  citations: SourceCitation[],
): SuggestedAction[] {
  const actions: SuggestedAction[] = [];

  if (context?.employerSlug) {
    actions.push({
      label: 'View Employer Profile',
      href: `/employers/${context.employerSlug}`,
      reason: 'Review the employer overview and requirements.',
    });
  }

  if (context?.opportunityId) {
    actions.push({
      label: 'Review Opportunity Match',
      href: `/explore?opportunity=${context.opportunityId}`,
      reason: 'See the linked role and employer context.',
    });
  }

  switch (intent) {
    case 'eligibility_check':
      if (requestContext.aclLevel === 'HOLDER') {
        actions.push({
          label: 'View Readiness',
          href: '/holder/readiness',
          reason: 'Check your current trust-state and gaps.',
        });
      } else {
        actions.push({
          label: 'Get Prequalified',
          href: '/get-ready',
          reason: 'Build a source-backed readiness profile.',
        });
      }
      actions.push({
        label: 'Explore Opportunities',
        href: '/explore',
        reason: 'Review matching roles and start thresholds.',
      });
      break;
    case 'opportunity_search':
      actions.push({
        label: 'Explore Opportunities',
        href: '/explore',
        reason: 'Browse the full opportunity board with filters.',
      });
      if (requestContext.aclLevel === 'HOLDER') {
        actions.push({
          label: 'Complete Profile',
          href: '/get-ready',
          reason: 'Improve your clear-to-start eligibility.',
        });
      }
      break;
    case 'gap_analysis':
      actions.push({
        label: requestContext.aclLevel === 'HOLDER' ? 'Complete Profile' : 'Get Prequalified',
        href: '/get-ready',
        reason: 'Close credential gaps before applying.',
      });
      break;
    case 'employer_lookup':
      actions.push({
        label: 'Compare Employers',
        href: '/employers',
        reason: 'Compare requirements, trust indicators, and onboarding speed.',
      });
      break;
    default:
      actions.push({
        label: 'Search More',
        href: '/search',
        reason: 'Refine your query with filters.',
      });
      break;
  }

  if (citations.some((citation) => citation.type === 'CONNECTED_RECORD')) {
    actions.push({
      label: 'View Trust Network',
      href: '/network',
      reason: 'Inspect connected verification sources and provenance.',
    });
  }

  return dedupeActions(actions);
}

function checkGuardrails(q: string): boolean {
  return GUARDRAIL_PATTERNS.some((pattern) => pattern.test(q));
}

function composeAnswer(params: {
  q: string;
  intent: IntentClass;
  citations: SourceCitation[];
  employerName?: string;
  opportunityTitle?: string;
}): string {
  const topCitation = params.citations[0];
  if (!topCitation) {
    return `No source-backed answer is available for "${params.q}".`;
  }

  if (params.employerName) {
    const trustCitation = params.citations.find((citation) => citation.type === 'TRUST_STATE_SUMMARY');
    const opportunityCitation = params.citations.find((citation) => citation.type === 'OPPORTUNITY');
    const connectedCitation = params.citations.find((citation) => citation.type === 'CONNECTED_RECORD');
    const parts = [
      `${params.employerName}: ${topCitation.snippet}`,
      trustCitation ? `Trust-state context: ${trustCitation.snippet}` : null,
      opportunityCitation ? `Relevant opportunity context: ${opportunityCitation.snippet}` : null,
      connectedCitation ? `Connected sources: ${connectedCitation.title}.` : null,
    ].filter((part): part is string => Boolean(part));
    return parts.join(' ');
  }

  if (params.opportunityTitle) {
    return `${params.opportunityTitle}: ${topCitation.snippet}`;
  }

  switch (params.intent) {
    case 'eligibility_check':
      return `Source-backed readiness context: ${topCitation.snippet}`;
    case 'opportunity_search':
      return `Found ${params.citations.filter((citation) => citation.type === 'OPPORTUNITY').length || 1} relevant opportunity-backed sources. Top match: ${topCitation.snippet}`;
    case 'gap_analysis':
      return `Credential gap summary: ${topCitation.snippet}`;
    case 'credential_info':
      return topCitation.snippet;
    default:
      return `Here is the top source-backed result: ${topCitation.snippet}`;
  }
}

function mergeSearchFilters(context: AskContextInput | undefined, filters: AskFilters | undefined): SearchQuery['filters'] {
  const scopedOpportunity = context?.opportunityId ? getOpportunity(context.opportunityId) : undefined;

  return {
    ...filters,
    ...(context?.employerSlug ? { employer: context.employerSlug } : {}),
    ...(!context?.employerSlug && scopedOpportunity?.employerSlug ? { employer: scopedOpportunity.employerSlug } : {}),
    ...(context?.opportunityId ? { opportunityId: context.opportunityId } : {}),
  };
}

async function buildSearchResults(input: AskInput, intent: IntentClass): Promise<SearchResult[]> {
  const types = planRetrieval(intent, input.context);
  const filters = mergeSearchFilters(input.context, input.filters);

  const searchResponse = await querySearch({
    q: input.q,
    types,
    aclLevel: input.requestContext.aclLevel,
    orgId: input.requestContext.organizationId,
    roles: input.requestContext.membershipRoles,
    filters,
    limit: 6,
  });

  let results = [...searchResponse.results];

  if (input.context?.opportunityId) {
    const scopedOpportunity = getOpportunity(input.context.opportunityId);
    if (scopedOpportunity && !results.some((result) => result.referenceId === scopedOpportunity.id)) {
      results.unshift({
        id: `opportunity:${scopedOpportunity.id}`,
        type: 'OPPORTUNITY',
        title: scopedOpportunity.title,
        snippet: `${scopedOpportunity.facility} in ${scopedOpportunity.location}. ${scopedOpportunity.payRange ?? 'Pay range not disclosed.'}`,
        sourceUrl: scopedOpportunity.employerSlug ? `/employers/${scopedOpportunity.employerSlug}` : '/explore',
        referenceId: scopedOpportunity.id,
        metadata: {
          employerSlug: scopedOpportunity.employerSlug,
          employerName: scopedOpportunity.facility,
          state: scopedOpportunity.state,
          hiringType: scopedOpportunity.hiringType,
        },
        score: 100,
        freshAt: scopedOpportunity.postedAt,
        freshnessStatus: 'FRESH',
        provenance: 'opportunity_registry',
      });
    }
  }

  return results.slice(0, 6);
}

export async function ask(input: AskInput): Promise<AskResponse> {
  const start = Date.now();
  const query = input.q.trim();
  const queryHash = input.requestContext.queryHash ?? sha256Hex(query.toLowerCase());
  const traceId = createTraceId();
  const intent = classifyIntent(query, input.context);
  const actor = input.requestContext.clerkUserId ?? 'anonymous';

  return withToolSpan(
    {
      toolName: 'ask.vitalcv',
      input: {
        queryHash,
        aclLevel: input.requestContext.aclLevel,
        organizationId: input.requestContext.organizationId ?? null,
        employerSlug: input.context?.employerSlug ?? null,
        opportunityId: input.context?.opportunityId ?? null,
        intent,
      },
      attributes: {
        'vitalcv.ask.query_sha256': queryHash,
        'vitalcv.ask.intent': intent,
        'vitalcv.ask.acl': input.requestContext.aclLevel,
        ...(input.requestContext.organizationId
          ? { 'vitalcv.ask.organization_id': input.requestContext.organizationId }
          : {}),
      },
    },
    async () => {
      await emitAnalyticsEvent({
        type: 'ask_query_submitted',
        referenceId: queryHash,
        organizationId: input.requestContext.organizationId,
        metadata: {
          traceId,
          queryHash,
          intent,
          aclLevel: input.requestContext.aclLevel,
          context: {
            employerSlug: input.context?.employerSlug ?? null,
            opportunityId: input.context?.opportunityId ?? null,
          },
        },
      });

      if (checkGuardrails(query)) {
        const provenance = buildProvenanceSummary([]);
        emitAuditEvent({
          traceId,
          category: 'DECISION',
          actor,
          resource: `ask:${queryHash}`,
          requestFields: {
            queryHash,
            aclLevel: input.requestContext.aclLevel,
            employerSlug: input.context?.employerSlug ?? null,
            opportunityId: input.context?.opportunityId ?? null,
          },
          resultFields: {
            status: 'GUARDRAIL_BLOCKED',
            sourceCount: 0,
          },
        });

        await emitAnalyticsEvent({
          type: 'ask_answer_returned',
          referenceId: queryHash,
          organizationId: input.requestContext.organizationId,
          metadata: {
            traceId,
            status: 'GUARDRAIL_BLOCKED',
            sourceCount: 0,
          },
        });

        return {
          query,
          intent,
          status: 'GUARDRAIL_BLOCKED',
          answer: 'VitalCV only answers source-backed questions about trust-state, employers, opportunities, and credentialing requirements.',
          sources: [],
          suggestedActions: buildActions(intent, input.requestContext, input.context, []),
          provenance,
          traceId,
          noResults: false,
          guardrailTriggered: true,
          durationMs: Date.now() - start,
        };
      }

      const [contextualEmployer, results] = await Promise.all([
        input.context?.employerSlug ? getEmployerBySlug(input.context.employerSlug) : Promise.resolve(null),
        buildSearchResults(input, intent),
      ]);

      const citations = buildSourceCitations(results);
      const provenance = buildProvenanceSummary(citations);
      const contextualOpportunity = input.context?.opportunityId
        ? getOpportunity(input.context.opportunityId)
        : undefined;

      if (citations.length === 0) {
        emitAuditEvent({
          traceId,
          category: 'DECISION',
          actor,
          resource: `ask:${queryHash}`,
          requestFields: {
            queryHash,
            aclLevel: input.requestContext.aclLevel,
            employerSlug: input.context?.employerSlug ?? null,
            opportunityId: input.context?.opportunityId ?? null,
          },
          resultFields: {
            status: 'NO_RESULTS',
            sourceCount: 0,
          },
        });

        if (input.context?.employerSlug) {
          emitAuditEvent({
            traceId,
            category: 'DECISION',
            actor,
            resource: `ask:employer:${input.context.employerSlug}`,
            requestFields: {
              queryHash,
              employerSlug: input.context.employerSlug,
            },
            resultFields: {
              status: 'NO_RESULTS',
              sourceCount: 0,
            },
          });
        }

        await emitAnalyticsEvent({
          type: 'ask_answer_returned',
          referenceId: queryHash,
          organizationId: input.requestContext.organizationId,
          metadata: {
            traceId,
            status: 'NO_RESULTS',
            sourceCount: 0,
          },
        });

        return {
          query,
          intent,
          status: 'NO_RESULTS',
          answer: `No source-backed results were found for "${query}". Try a narrower employer, opportunity, or credential question.`,
          sources: [],
          suggestedActions: buildActions(intent, input.requestContext, input.context, []),
          provenance,
          traceId,
          noResults: true,
          guardrailTriggered: false,
          durationMs: Date.now() - start,
        };
      }

      const answer = composeAnswer({
        q: query,
        intent,
        citations,
        employerName: contextualEmployer?.name ?? input.context?.employerName,
        opportunityTitle: contextualOpportunity?.title,
      });
      const suggestedActions = buildActions(intent, input.requestContext, input.context, citations);

      emitAuditEvent({
        traceId,
        category: 'DECISION',
        actor,
        resource: `ask:${queryHash}`,
        requestFields: {
          queryHash,
          aclLevel: input.requestContext.aclLevel,
          organizationId: input.requestContext.organizationId ?? null,
          employerSlug: input.context?.employerSlug ?? null,
          opportunityId: input.context?.opportunityId ?? null,
        },
        resultFields: {
          status: 'ANSWERED',
          sourceCount: citations.length,
          sources: citations.map((citation) => citation.referenceId ?? citation.title),
        },
      });

      if (input.context?.employerSlug) {
        emitAuditEvent({
          traceId,
          category: 'DECISION',
          actor,
          resource: `ask:employer:${input.context.employerSlug}`,
          requestFields: {
            queryHash,
            employerSlug: input.context.employerSlug,
          },
          resultFields: {
            status: 'ANSWERED',
            sourceCount: citations.length,
          },
        });
      }

      await emitAnalyticsEvent({
        type: 'ask_answer_returned',
        referenceId: queryHash,
        organizationId: input.requestContext.organizationId,
        metadata: {
          traceId,
          status: 'ANSWERED',
          sourceCount: citations.length,
          employerSlug: input.context?.employerSlug ?? null,
          opportunityId: input.context?.opportunityId ?? null,
        },
      });

      log('info', 'ask.success', {
        queryHash,
        intent,
        traceId,
        sourceCount: citations.length,
        aclLevel: input.requestContext.aclLevel,
      });

      return {
        query,
        intent,
        status: 'ANSWERED',
        answer,
        sources: citations,
        suggestedActions,
        provenance,
        traceId,
        noResults: false,
        guardrailTriggered: false,
        durationMs: Date.now() - start,
      };
    },
  );
}
