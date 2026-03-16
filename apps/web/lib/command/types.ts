import type { ParsedCopilotQuery } from '../../../../core/copilot/copilotEngine';

export type VCommandMode = 'search' | 'copilot' | 'command';
export type VCommandResultKind = 'provider' | 'copilot' | 'command' | 'saved-query';

export interface VCommandParseSummary {
  rawQuery: string;
  providers: string[];
  specialty: string | null;
  state: string | null;
  signal: 'payments' | 'trials' | 'risk' | null;
  threshold: string | null;
  paymentSignal: ParsedCopilotQuery['structuredFilters']['payments'] | null;
  trialSignal: string | null;
  riskSignals: string[];
  intent: ParsedCopilotQuery['intent'] | null;
}

export interface VCommandInput {
  raw: string;
  normalized: string;
  mode: VCommandMode;
  searchText: string;
  commandText: string;
  parsedQuery: ParsedCopilotQuery | null;
  parseSummary: VCommandParseSummary | null;
}

export interface VCommandNavigationContext {
  query: string;
  npi: string | null;
  mode: VCommandMode;
}

export interface VCommandActionDefinition {
  id: string;
  label: string;
  description: string;
  group: 'Commands' | 'Navigation' | 'Reports';
  aliases: string[];
  keywords: string[];
  requiresProvider?: boolean;
  buildHref: (context: VCommandNavigationContext) => string;
  buildGraphHref?: (context: VCommandNavigationContext) => string | null;
}

export interface VCommandResultItem {
  id: string;
  kind: VCommandResultKind;
  title: string;
  subtitle: string;
  summary: string;
  badges: string[];
  href: string | null;
  graphHref: string | null;
  npi: string | null;
  rank?: number;
  trustScore?: number | null;
  commandId?: string;
  query?: string;
  mode?: VCommandMode;
  explanation?: string | null;
  sourceCoverage?: string[];
}

export interface VSavedQuery {
  id: string;
  query: string;
  mode: Exclude<VCommandMode, 'command'>;
  createdAt: string;
}
