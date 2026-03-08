/**
 * Ask VitalCV Service — Wave 185: Natural Language Search & Answer Engine
 *
 * Pipeline:
 *   1. Intent classification  → what kind of question is this?
 *   2. Retrieval plan         → which SearchObject types to query?
 *   3. Search execution       → query the index with ACL
 *   4. Answer composition     → synthesize answer from results
 *   5. Source citation        → format provenance badges
 *   6. Action suggestions     → workspace-aware next steps
 *
 * Guardrails:
 *   - No answer without sources (returns NO_RESULTS state)
 *   - No unauthorized record disclosure (ACL enforced before retrieval)
 *   - No black-box advice (every claim must cite a source)
 *   - PHI: clinician NPI / personal data never included in answers
 *
 * Analytics events: ask_query, ask_success, ask_no_results, ask_guardrail_triggered
 */

import { SearchAclLevel, SearchObjectType } from '@prisma/client';
import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import { querySearch, type SearchResult } from './searchIndex';

// ── Types ─────────────────────────────────────────────────────────────────────

export type IntentClass =
  | 'eligibility_check'    // "Am I cleared for X?"
  | 'opportunity_search'   // "Show employers hiring Y"
  | 'gap_analysis'         // "What's missing before I can..."
  | 'employer_lookup'      // "What does Kaiser require?"
  | 'credential_info'      // "How do I get a DEA number?"
  | 'general_search';      // fallback

export interface SourceBadge {
  type:     SearchObjectType;
  label:    string;
  color:    string;
  url?:     string;
}

export interface SuggestedAction {
  label:  string;
  href:   string;
  reason: string;
}

export interface AskResponse {
  query:           string;
  intent:          IntentClass;
  answer:          string;
  sources:         SourceBadge[];
  suggestedActions: SuggestedAction[];
  noResults:       boolean;
  guardrailTriggered: boolean;
  durationMs:      number;
}

// ── Intent classification ─────────────────────────────────────────────────────

const INTENT_PATTERNS: Array<[RegExp, IntentClass]> = [
  [/\b(cleared|clear to start|eligible|can i (start|work)|am i (ready|qualified))\b/i, 'eligibility_check'],
  [/\b(show|find|list|employers?|hiring|jobs?|roles?|positions?|opportunities)\b/i,    'opportunity_search'],
  [/\b(missing|gap|what (do i|else|is|are)|need(ed)?|require(d|ments)?)\b/i,          'gap_analysis'],
  [/\b(kaiser|hospital|clinic|org|require(s)?|what does .* (need|require|want))\b/i,  'employer_lookup'],
  [/\b(dea|license|board cert|npi|credential|certif|how (do|to)|steps?)\b/i,          'credential_info'],
];

function classifyIntent(q: string): IntentClass {
  for (const [pattern, intent] of INTENT_PATTERNS) {
    if (pattern.test(q)) return intent;
  }
  return 'general_search';
}

// ── Retrieval plan ────────────────────────────────────────────────────────────

function planRetrieval(intent: IntentClass): SearchObjectType[] {
  switch (intent) {
    case 'eligibility_check':  return ['TRUST_STATE_SUMMARY', 'OPPORTUNITY', 'EMPLOYER_PROFILE'];
    case 'opportunity_search': return ['OPPORTUNITY', 'EMPLOYER_PROFILE'];
    case 'gap_analysis':       return ['TRUST_STATE_SUMMARY', 'FAQ_DOC', 'EMPLOYER_PROFILE'];
    case 'employer_lookup':    return ['EMPLOYER_PROFILE', 'OPPORTUNITY', 'FAQ_DOC'];
    case 'credential_info':    return ['FAQ_DOC', 'ISSUER_PROFILE', 'PUBLIC_PAGE'];
    default:                   return ['PUBLIC_PAGE', 'FAQ_DOC', 'OPPORTUNITY', 'EMPLOYER_PROFILE'];
  }
}

// ── Source badge builder ──────────────────────────────────────────────────────

const SOURCE_CONFIG: Record<SearchObjectType, { label: string; color: string }> = {
  PUBLIC_PAGE:          { label: 'VitalCV Site',     color: 'text-vt-neutral-200' },
  EMPLOYER_PROFILE:     { label: 'Employer Page',    color: 'text-vt-info' },
  OPPORTUNITY:          { label: 'Opportunity',      color: 'text-vt-success' },
  ISSUER_PROFILE:       { label: 'Issuer Registry',  color: 'text-vt-warning' },
  TRUST_STATE_SUMMARY:  { label: 'Trust State',      color: 'text-vt-success' },
  AUDIT_EVENT_SUMMARY:  { label: 'Audit Record',     color: 'text-vt-danger' },
  FAQ_DOC:              { label: 'Help Docs',        color: 'text-vt-neutral-200' },
  CONNECTED_RECORD:     { label: 'Connected Data',   color: 'text-vt-brand-primary' },
};

function buildSourceBadges(results: SearchResult[]): SourceBadge[] {
  const seen = new Set<string>();
  return results
    .filter((r) => { if (seen.has(r.type)) return false; seen.add(r.type); return true; })
    .map((r) => ({
      type:  r.type,
      label: SOURCE_CONFIG[r.type].label,
      color: SOURCE_CONFIG[r.type].color,
      url:   r.sourceUrl,
    }));
}

// ── Answer composer ───────────────────────────────────────────────────────────

function composeAnswer(intent: IntentClass, results: SearchResult[], q: string): string {
  if (results.length === 0) {
    return `No results found for "${q}". Try rephrasing or browsing the Explore page.`;
  }

  const topResult = results[0]!;

  switch (intent) {
    case 'eligibility_check':
      return `Based on indexed trust-state and opportunity data: ${topResult.snippet}. ` +
             `Check your current credential readiness to confirm eligibility for specific roles.`;

    case 'opportunity_search':
      return `Found ${results.length} relevant opportunit${results.length === 1 ? 'y' : 'ies'}. ` +
             `Top result: "${topResult.title}" — ${topResult.snippet}.`;

    case 'gap_analysis':
      return `To complete your profile for this goal: ${topResult.snippet}. ` +
             `Review your readiness dashboard for a full gap breakdown.`;

    case 'employer_lookup':
      return `Based on employer profile data: ${topResult.snippet}. ` +
             `Visit the employer page for full requirement details.`;

    case 'credential_info':
      return topResult.snippet;

    default:
      return `Here's what I found for "${q}": ${topResult.snippet}.`;
  }
}

// ── Action suggestions ────────────────────────────────────────────────────────

function buildActions(intent: IntentClass, results: SearchResult[]): SuggestedAction[] {
  const actions: SuggestedAction[] = [];

  switch (intent) {
    case 'eligibility_check':
      actions.push({ label: 'View Readiness', href: '/holder/readiness', reason: 'Check your current trust state' });
      actions.push({ label: 'Explore Roles',  href: '/explore',          reason: 'Browse matching opportunities' });
      break;
    case 'opportunity_search':
      actions.push({ label: 'Explore Opportunities', href: '/explore',    reason: 'Full opportunity board with filters' });
      actions.push({ label: 'Get Prequalified',       href: '/get-ready', reason: 'Unlock instant offers' });
      break;
    case 'gap_analysis':
      actions.push({ label: 'Complete Profile', href: '/get-ready',         reason: 'Fill credential gaps' });
      actions.push({ label: 'View Employers',   href: '/employers',          reason: 'See what each employer requires' });
      break;
    case 'employer_lookup':
      if (results[0]?.sourceUrl) {
        actions.push({ label: 'View Employer Profile', href: results[0].sourceUrl, reason: 'See full requirements' });
      }
      actions.push({ label: 'Explore Their Roles', href: '/explore', reason: 'Browse open positions' });
      break;
    default:
      actions.push({ label: 'Search More',    href: '/search',    reason: 'Refine your search' });
      actions.push({ label: 'Ask a Question', href: '/ask',        reason: 'AI-powered answers' });
  }

  return actions;
}

// ── Guardrail check ───────────────────────────────────────────────────────────

const GUARDRAIL_PATTERNS = [
  /\b(patient|PHI|health record|diagnosis|prescription|medication|ssn|social security)\b/i,
  /\b(guaranteed|definitely|certain|always|never)\b/i,  // overconfident advice
];

function checkGuardrails(q: string): boolean {
  return GUARDRAIL_PATTERNS.some((p) => p.test(q));
}

// ── Analytics ─────────────────────────────────────────────────────────────────

async function trackAsk(event: string, q: string, meta: Record<string, unknown>): Promise<void> {
  try {
    const payload = { q, ...meta };
    await prisma.auditEvent.create({
      data: {
        type:        event,
        hash:        Buffer.from(`${event}:${q}:${Date.now()}`).toString('base64').slice(0, 32),
        referenceId: 'ask:anonymous',
        metadata:    JSON.parse(JSON.stringify(payload)),
      },
    });
  } catch {
    // Non-fatal — analytics must never block answers
  }
}

// ── Main entrypoint ───────────────────────────────────────────────────────────

export async function ask(
  q:         string,
  aclLevel:  SearchAclLevel = 'PUBLIC',
): Promise<AskResponse> {
  const start = Date.now();

  // Guardrail check
  if (checkGuardrails(q)) {
    await trackAsk('ask_guardrail_triggered', q, { aclLevel });
    log('warn', 'ask.guardrail', { q });
    return {
      query: q,
      intent: 'general_search',
      answer: "I can't answer that query directly. VitalCV answers are limited to labor-market credentialing and opportunity information. No patient data, personal health records, or regulated service referrals.",
      sources: [],
      suggestedActions: [
        { label: 'Explore Opportunities', href: '/explore', reason: 'Browse verified roles' },
        { label: 'Get Prequalified',       href: '/get-ready', reason: 'Start your trust profile' },
      ],
      noResults:          false,
      guardrailTriggered: true,
      durationMs: Date.now() - start,
    };
  }

  const intent  = classifyIntent(q);
  const types   = planRetrieval(intent);

  await trackAsk('ask_query', q, { intent, aclLevel });

  // Execute search
  const searchResponse = await querySearch({ q, types, aclLevel, limit: 5 });
  const results = searchResponse.results;

  if (results.length === 0) {
    await trackAsk('ask_no_results', q, { intent });
    return {
      query:  q,
      intent,
      answer: `No sources found for "${q}". VitalCV only answers from indexed, source-backed data. Try browsing /explore or /employers.`,
      sources:          [],
      suggestedActions: buildActions(intent, []),
      noResults:          true,
      guardrailTriggered: false,
      durationMs: Date.now() - start,
    };
  }

  const answer  = composeAnswer(intent, results, q);
  const sources = buildSourceBadges(results);
  const actions = buildActions(intent, results);

  await trackAsk('ask_success', q, { intent, resultCount: results.length });
  log('info', 'ask.success', { q, intent, resultCount: results.length });

  return {
    query:  q,
    intent,
    answer,
    sources,
    suggestedActions: actions,
    noResults:          false,
    guardrailTriggered: false,
    durationMs: Date.now() - start,
  };
}
