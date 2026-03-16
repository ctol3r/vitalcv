import { interpretCopilotQuery } from '../../../../core/copilot/queryInterpreter';
import type { VCommandInput, VCommandParseSummary } from './types';

const COMMAND_PREFIX = '>';
const EXACT_NPI_RE = /^\d{10}$/;
const NPI_LOOKUP_RE = /^npi\s+(\d{10})$/i;
const NAME_LIKE_RE = /^(dr\.?\s+)?[a-z][a-z'.-]*(?:\s+[a-z][a-z'.-]*){0,3}$/i;

function cleanInput(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function tokenCount(value: string): number {
  return value.split(/\s+/).filter(Boolean).length;
}

function extractProviderMentions(rawQuery: string, searchText: string): string[] {
  const matches = new Set<string>();
  const exactNpi = searchText.match(EXACT_NPI_RE)?.[0];
  if (exactNpi) {
    matches.add(exactNpi);
  }

  const prefixedNpi = searchText.match(NPI_LOOKUP_RE)?.[1];
  if (prefixedNpi) {
    matches.add(prefixedNpi);
  }

  for (const match of rawQuery.matchAll(/\bDr\.?\s+[A-Z][a-z.'-]+(?:\s+[A-Z][a-z.'-]+){0,2}\b/g)) {
    if (match[0]) {
      matches.add(match[0].trim());
    }
  }

  if (matches.size === 0 && NAME_LIKE_RE.test(searchText)) {
    matches.add(searchText);
  }

  return [...matches];
}

function inferThreshold(rawQuery: string, searchText: string): string | null {
  const normalized = `${rawQuery} ${searchText}`.toLowerCase();

  if (/\bhigh\b/.test(normalized)) {
    return 'high';
  }

  if (/\blow\b/.test(normalized)) {
    return 'low';
  }

  const above = normalized.match(/\b(?:above|over|greater than|>=|at least|min(?:imum)?)\s*(\d{1,3})\b/);
  if (above?.[1]) {
    return `>=${above[1]}`;
  }

  const below = normalized.match(/\b(?:below|under|less than|<=|at most|max(?:imum)?)\s*(\d{1,3})\b/);
  if (below?.[1]) {
    return `<=${below[1]}`;
  }

  return null;
}

function buildParseSummary(rawQuery: string, searchText: string): VCommandParseSummary {
  const parsedQuery = interpretCopilotQuery(rawQuery);
  const paymentSignal = parsedQuery.structuredFilters.payments ?? null;
  const trialSignal = parsedQuery.graphTraversal.includes('TRIAL_INVESTIGATORS')
    ? 'trial-investigators'
    : parsedQuery.structuredFilters.researchTopics.length > 0
      ? parsedQuery.structuredFilters.researchTopics[0] ?? null
      : null;
  const riskSignals = [
    ...(parsedQuery.structuredFilters.trustScore ? ['trust-score'] : []),
    ...(parsedQuery.structuredFilters.licenseStatuses.length > 0 ? ['license-status'] : []),
    ...(parsedQuery.structuredFilters.boardCertified !== undefined ? ['board-certification'] : []),
  ];
  const signal = paymentSignal
    ? 'payments'
    : trialSignal
      ? 'trials'
      : riskSignals.length > 0
        ? 'risk'
        : null;

  return {
    rawQuery,
    providers: extractProviderMentions(rawQuery, searchText),
    specialty: parsedQuery.structuredFilters.specialties[0] ?? null,
    state: parsedQuery.structuredFilters.states[0] ?? null,
    signal,
    threshold: inferThreshold(rawQuery, searchText),
    paymentSignal,
    trialSignal,
    riskSignals,
    intent: parsedQuery.intent,
  };
}

function stripSearchPrefix(value: string): string {
  const exactNpi = value.match(NPI_LOOKUP_RE)?.[1];
  if (exactNpi) {
    return exactNpi;
  }

  return value;
}

function hasCopilotSignals(rawQuery: string): boolean {
  const parsedQuery = interpretCopilotQuery(rawQuery);

  return (
    parsedQuery.graphTraversal.length > 0 ||
    parsedQuery.structuredFilters.specialties.length > 0 ||
    parsedQuery.structuredFilters.states.length > 0 ||
    parsedQuery.structuredFilters.institutions.length > 0 ||
    parsedQuery.structuredFilters.affiliations.length > 0 ||
    parsedQuery.structuredFilters.licenseStatuses.length > 0 ||
    parsedQuery.structuredFilters.boardCertified !== undefined ||
    parsedQuery.structuredFilters.payments !== undefined ||
    parsedQuery.structuredFilters.researchTopics.length > 0 ||
    parsedQuery.structuredFilters.trustScore !== undefined ||
    parsedQuery.intent !== 'DISCOVERY'
  );
}

function isLikelySearch(searchText: string): boolean {
  if (EXACT_NPI_RE.test(searchText) || NPI_LOOKUP_RE.test(searchText)) {
    return true;
  }

  if (NAME_LIKE_RE.test(searchText)) {
    return true;
  }

  return tokenCount(searchText) <= 3;
}

export function resolveCommandInput(rawValue: string): VCommandInput {
  const raw = rawValue;
  const normalized = cleanInput(rawValue);

  if (normalized.startsWith(COMMAND_PREFIX)) {
    const commandText = cleanInput(normalized.slice(1));

    return {
      raw,
      normalized,
      mode: 'command',
      searchText: '',
      commandText,
      parsedQuery: null,
      parseSummary: null,
    };
  }

  if (!normalized) {
    return {
      raw,
      normalized,
      mode: 'search',
      searchText: '',
      commandText: '',
      parsedQuery: null,
      parseSummary: null,
    };
  }

  const searchText = stripSearchPrefix(normalized);
  const parsedQuery = interpretCopilotQuery(normalized);
  const mode = isLikelySearch(searchText) && !hasCopilotSignals(normalized) ? 'search' : 'copilot';

  return {
    raw,
    normalized,
    mode,
    searchText,
    commandText: '',
    parsedQuery: mode === 'copilot' ? parsedQuery : null,
    parseSummary: buildParseSummary(normalized, searchText),
  };
}

export function buildParsePreview(summary: VCommandParseSummary | null): Record<string, string> | null {
  if (!summary) {
    return null;
  }

  const preview: Record<string, string> = {};

  if (summary.specialty) {
    preview.specialty = summary.specialty;
  }

  if (summary.state) {
    preview.state = summary.state;
  }

  if (summary.signal) {
    preview.signal = summary.signal;
  }

  if (summary.threshold) {
    preview.threshold = summary.threshold;
  }

  if (summary.providers.length > 0) {
    preview.providers = summary.providers.join(', ');
  }

  return Object.keys(preview).length > 0 ? preview : null;
}

export function extractNpiFromValue(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const match = value.match(/\b(\d{10})\b/);
  return match?.[1] ?? null;
}
