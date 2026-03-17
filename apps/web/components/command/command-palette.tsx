'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  Command,
  GitBranch,
  LayoutDashboard,
  Loader2,
  Network,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Workflow,
} from 'lucide-react';
import type {
  FindingsResponse,
  IntelligenceFinding,
  IntelligenceProvider,
  IntelligenceStoryline,
  StorylinesResponse,
} from '@/lib/intelligence/contracts';
import { formatRelativeTime } from '@/lib/intelligence/time';

type PaletteGroup = 'Navigate' | 'Providers' | 'Findings' | 'Storylines' | 'Actions';
type PaletteKind = 'navigation' | 'provider' | 'finding' | 'storyline' | 'action' | 'copilot';

interface PaletteResult {
  id: string;
  group: PaletteGroup;
  kind: PaletteKind;
  title: string;
  subtitle: string;
  detail: string;
  icon: typeof Search;
  href?: string;
  action?: 'refresh-intelligence';
}

interface ProvidersResponse {
  providers?: IntelligenceProvider[];
}

const NAVIGATION_RESULTS: Array<{
  id: string;
  title: string;
  subtitle: string;
  detail: string;
  href: string;
  keywords: string[];
  icon: typeof Search;
}> = [
  {
    id: 'nav-dashboard',
    title: 'Open dashboard',
    subtitle: 'Intelligence console',
    detail: 'Launch overview with provider readiness, health posture, and pressure.',
    href: '/intelligence?view=dashboard',
    keywords: ['dashboard', 'overview', 'home', 'console'],
    icon: LayoutDashboard,
  },
  {
    id: 'nav-provider-profile',
    title: 'Open provider profile',
    subtitle: 'Intelligence console',
    detail: 'Focused provider posture with direct storylines and action context.',
    href: '/intelligence?view=provider-profile',
    keywords: ['provider', 'profile', 'focus'],
    icon: ShieldCheck,
  },
  {
    id: 'nav-investigation',
    title: 'Open investigation workspace',
    subtitle: 'Intelligence console',
    detail: 'Findings, storyline pressure, and recommended actions in one view.',
    href: '/intelligence?view=investigation-workspace',
    keywords: ['investigation', 'findings', 'workbench', 'triage'],
    icon: Workflow,
  },
  {
    id: 'nav-comparison',
    title: 'Open comparison view',
    subtitle: 'Intelligence console',
    detail: 'Side-by-side provider comparison for operator routing decisions.',
    href: '/intelligence?view=comparison-view',
    keywords: ['comparison', 'compare', 'side by side'],
    icon: Network,
  },
  {
    id: 'nav-workbench',
    title: 'Open full investigation workbench',
    subtitle: 'Operator route',
    detail: 'Deep four-panel workbench for anchored finding and storyline review.',
    href: '/investigations',
    keywords: ['investigations', 'workbench', 'anchor'],
    icon: Workflow,
  },
  {
    id: 'nav-system-health',
    title: 'Open system health',
    subtitle: 'Operator route',
    detail: 'Connector health, incidents, and integrity signal monitoring.',
    href: '/system-health',
    keywords: ['health', 'incidents', 'integrity', 'system'],
    icon: RefreshCw,
  },
];

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function scoreText(query: string, values: string[]): number {
  const trimmedQuery = normalizeText(query);
  if (!trimmedQuery) {
    return 1;
  }

  let score = 0;

  for (const value of values) {
    const candidate = normalizeText(value);
    if (!candidate) {
      continue;
    }

    if (candidate === trimmedQuery) {
      score = Math.max(score, 120);
      continue;
    }

    if (candidate.startsWith(trimmedQuery)) {
      score = Math.max(score, 80);
      continue;
    }

    if (candidate.includes(trimmedQuery)) {
      score = Math.max(score, 46);
    }
  }

  return score;
}

function findingWeight(finding: IntelligenceFinding): number {
  const severityBoost = finding.severity === 'critical'
    ? 120
    : finding.severity === 'high'
      ? 90
      : finding.severity === 'medium'
        ? 70
        : 40;
  return severityBoost + Math.round(finding.priorityScore);
}

function storylineWeight(storyline: IntelligenceStoryline): number {
  const severityBoost = storyline.severity === 'critical'
    ? 120
    : storyline.severity === 'high'
      ? 90
      : storyline.severity === 'medium'
        ? 70
        : 40;
  return severityBoost + Math.round(storyline.progressionScore * 100);
}

function providerSubtitle(provider: IntelligenceProvider): string {
  const specialty = provider.specialties[0] ?? 'Provider';
  return `${provider.npi} • trust ${provider.trustScore} • ${specialty}`;
}

async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T | null> {
  const response = await fetch(input, init);
  if (!response.ok) {
    return null;
  }

  return response.json() as Promise<T>;
}

export function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [providers, setProviders] = useState<IntelligenceProvider[]>([]);
  const [findings, setFindings] = useState<IntelligenceFinding[]>([]);
  const [storylines, setStorylines] = useState<IntelligenceStoryline[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const effectiveQuery = query.trim().startsWith('>')
    ? query.trim().slice(1).trim()
    : query.trim();
  const commandMode = query.trim().startsWith('>');

  const fetchProviders = useCallback(async (searchValue: string, signal: AbortSignal) => {
    setLoadingProviders(true);

    try {
      const params = new URLSearchParams();
      if (searchValue.trim()) {
        params.set('q', searchValue.trim());
      }
      params.set('limit', '8');
      params.set('pageSize', '8');

      const payload = await fetchJson<ProvidersResponse>(`/api/intelligence/providers?${params.toString()}`, { signal });
      if (!signal.aborted) {
        setProviders(payload?.providers ?? []);
      }
    } catch (error) {
      if (!signal.aborted) {
        console.error('Provider palette search failed', error);
      }
    } finally {
      if (!signal.aborted) {
        setLoadingProviders(false);
      }
    }
  }, []);

  const fetchFeedPools = useCallback(async (signal: AbortSignal) => {
    setLoadingFeed(true);

    try {
      const [findingsPayload, storylinesPayload] = await Promise.all([
        fetchJson<FindingsResponse>('/api/intelligence/findings?pageSize=18', { signal }),
        fetchJson<StorylinesResponse>('/api/intelligence/storylines?pageSize=16', { signal }),
      ]);

      if (!signal.aborted) {
        setFindings(findingsPayload?.findings ?? []);
        setStorylines(storylinesPayload?.storylines ?? []);
      }
    } catch (error) {
      if (!signal.aborted) {
        console.error('Palette feed bootstrap failed', error);
      }
    } finally {
      if (!signal.aborted) {
        setLoadingFeed(false);
      }
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((current) => !current);
      }

      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    const onProgrammaticOpen = () => setOpen(true);

    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('vital:open-command-palette', onProgrammaticOpen);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('vital:open-command-palette', onProgrammaticOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    window.setTimeout(() => inputRef.current?.focus(), 0);
    setQuery('');
    setSelectedIndex(0);

    const controller = new AbortController();
    void fetchFeedPools(controller.signal);
    void fetchProviders('', controller.signal);
    return () => controller.abort();
  }, [fetchFeedPools, fetchProviders, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void fetchProviders(effectiveQuery, controller.signal);
    }, 130);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [effectiveQuery, fetchProviders, open]);

  const resultGroups = useMemo(() => {
    const groups = new Map<PaletteGroup, PaletteResult[]>();
    const push = (result: PaletteResult) => {
      const existing = groups.get(result.group) ?? [];
      existing.push(result);
      groups.set(result.group, existing);
    };

    const navResults = NAVIGATION_RESULTS
      .map((item) => ({
        item,
        score: scoreText(effectiveQuery, [item.title, item.subtitle, item.detail, ...item.keywords]),
      }))
      .filter(({ score }) => score > 0)
      .sort((left, right) => right.score - left.score);

    if (!effectiveQuery || commandMode) {
      for (const { item } of navResults.slice(0, 6)) {
        push({
          id: item.id,
          group: 'Navigate',
          kind: 'navigation',
          title: item.title,
          subtitle: item.subtitle,
          detail: item.detail,
          icon: item.icon,
          href: item.href,
        });
      }

      push({
        id: 'refresh-intelligence',
        group: 'Actions',
        kind: 'action',
        title: 'Refresh intelligence surfaces',
        subtitle: 'Operator action',
        detail: pathname === '/intelligence'
          ? 'Refresh providers, findings, storylines, graph, and health in place.'
          : 'Open the console and refresh operator data.',
        icon: RefreshCw,
        action: 'refresh-intelligence',
      });
    } else {
      for (const { item } of navResults.slice(0, 4)) {
        push({
          id: item.id,
          group: 'Navigate',
          kind: 'navigation',
          title: item.title,
          subtitle: item.subtitle,
          detail: item.detail,
          icon: item.icon,
          href: item.href,
        });
      }
    }

    if (!commandMode) {
      const providerResults = providers
        .map((provider) => ({
          provider,
          score: scoreText(effectiveQuery, [
            provider.name,
            provider.npi,
            provider.summary,
            provider.primaryIssuer ?? '',
            provider.specialties.join(' '),
          ]) + provider.trustScore,
        }))
        .filter(({ score }) => score > 0)
        .sort((left, right) => right.score - left.score)
        .slice(0, effectiveQuery ? 5 : 4);

      for (const { provider } of providerResults) {
        push({
          id: `provider:${provider.npi}`,
          group: 'Providers',
          kind: 'provider',
          title: provider.name,
          subtitle: providerSubtitle(provider),
          detail: provider.summary || 'Open scoped provider profile in the intelligence console.',
          icon: ShieldCheck,
          href: `/intelligence?view=provider-profile&npi=${provider.npi}`,
        });
      }

      const filteredFindings = findings
        .map((finding) => ({
          finding,
          score: scoreText(effectiveQuery, [
            finding.title,
            finding.summary,
            finding.explanation,
            finding.investigatorId,
            finding.providerLabel ?? '',
            finding.providerNpi ?? '',
            finding.storylineTitle ?? '',
          ]) + findingWeight(finding),
        }))
        .filter(({ score }) => score > 0)
        .sort((left, right) => right.score - left.score)
        .slice(0, effectiveQuery ? 4 : 3);

      for (const { finding } of filteredFindings) {
        push({
          id: `finding:${finding.id}`,
          group: 'Findings',
          kind: 'finding',
          title: finding.title,
          subtitle: `${finding.severity} • ${finding.providerLabel ?? finding.investigatorId} • ${formatRelativeTime(finding.updatedAt)}`,
          detail: finding.summary,
          icon: AlertTriangle,
          href: `/investigations?findingId=${finding.id}`,
        });
      }

      const filteredStorylines = storylines
        .map((storyline) => ({
          storyline,
          score: scoreText(effectiveQuery, [
            storyline.title,
            storyline.summary,
            storyline.whyItMatters,
            storyline.providerNpi ?? '',
            storyline.recommendedActions.join(' '),
          ]) + storylineWeight(storyline),
        }))
        .filter(({ score }) => score > 0)
        .sort((left, right) => right.score - left.score)
        .slice(0, effectiveQuery ? 4 : 3);

      for (const { storyline } of filteredStorylines) {
        push({
          id: `storyline:${storyline.id}`,
          group: 'Storylines',
          kind: 'storyline',
          title: storyline.title,
          subtitle: `${storyline.severity} • ${formatRelativeTime(storyline.lastActivityAt)} • ${storyline.findingIds.length} findings`,
          detail: storyline.summary,
          icon: GitBranch,
          href: `/investigations?storylineId=${storyline.id}`,
        });
      }

      if (effectiveQuery.length >= 6) {
        push({
          id: 'copilot-query',
          group: 'Actions',
          kind: 'copilot',
          title: `Ask Copilot about "${effectiveQuery}"`,
          subtitle: 'Operator action',
          detail: 'Seed the intelligence Copilot with this prompt and stay in operator scope.',
          icon: Sparkles,
          href: `/intelligence?view=dashboard&copilot=${encodeURIComponent(effectiveQuery)}`,
        });
      }

      const leadProvider = providers[0];
      if (leadProvider && effectiveQuery) {
        push({
          id: `investigate:${leadProvider.npi}`,
          group: 'Actions',
          kind: 'action',
          title: `Open workbench for ${leadProvider.name}`,
          subtitle: 'Operator action',
          detail: 'Jump straight into the investigation workbench anchored to the top provider match.',
          icon: Workflow,
          href: `/investigations?npi=${leadProvider.npi}`,
        });
      }
    }

    return Array.from(groups.entries())
      .map(([label, items]) => ({ label, items }))
      .filter((group) => group.items.length > 0);
  }, [commandMode, effectiveQuery, findings, pathname, providers, storylines]);

  const flatResults = useMemo(
    () => resultGroups.flatMap((group) => group.items),
    [resultGroups],
  );
  const preview = flatResults[selectedIndex] ?? null;
  const loading = loadingProviders || loadingFeed;

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (flatResults.length === 0) {
      setSelectedIndex(0);
      return;
    }

    setSelectedIndex((current) => Math.min(current, flatResults.length - 1));
  }, [flatResults.length]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const activeRow = resultsRef.current?.querySelector<HTMLElement>(`[data-result-index="${selectedIndex}"]`);
    activeRow?.scrollIntoView({ block: 'nearest' });
  }, [open, selectedIndex]);

  const selectResult = useCallback((result: PaletteResult) => {
    if (result.action === 'refresh-intelligence') {
      if (pathname === '/intelligence') {
        window.dispatchEvent(new Event('vital:intelligence:refresh'));
      } else {
        router.push('/intelligence');
      }
      setOpen(false);
      return;
    }

    if (result.href) {
      router.push(result.href);
      setOpen(false);
    }
  }, [pathname, router]);

  const handleInputKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (flatResults.length === 0) {
        return;
      }
      setSelectedIndex((current) => Math.min(current + 1, flatResults.length - 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (flatResults.length === 0) {
        return;
      }
      setSelectedIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const selected = flatResults[selectedIndex];
      if (selected) {
        selectResult(selected);
      }
      return;
    }

    if (event.key === 'Tab') {
      const selected = flatResults[selectedIndex];
      if (!selected) {
        return;
      }

      event.preventDefault();
      setQuery(selected.title);
    }
  }, [flatResults, selectResult, selectedIndex]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center px-4 pt-[10vh] sm:pt-[12vh]">
      <button
        type="button"
        aria-label="Close command palette"
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      <div className="relative flex w-full max-w-4xl overflow-hidden rounded-[1.35rem] border border-white/10 bg-[#08111d] shadow-[0_30px_120px_rgba(2,6,23,0.55)]">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="border-b border-white/8 px-4 py-3">
            <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 focus-within:border-cyan-400/20">
              <Search className="h-4 w-4 shrink-0 text-white/45" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder="Search providers, findings, storylines, or type > for commands"
                className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/35"
              />
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin text-cyan-300" />
              ) : (
                <kbd className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
                  esc
                </kbd>
              )}
            </div>
          </div>

          <div ref={resultsRef} className="max-h-[28rem] overflow-y-auto px-2 py-2">
            {resultGroups.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-white/45">
                No operator matches for &quot;{effectiveQuery || query}&quot;
              </div>
            ) : (
              resultGroups.map((group) => (
                <section key={group.label} className="pb-2">
                  <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
                    {group.label}
                  </div>
                  <div className="grid gap-1">
                    {group.items.map((result) => {
                      const resultIndex = flatResults.findIndex((item) => item.id === result.id);
                      const selected = resultIndex === selectedIndex;
                      const Icon = result.icon;

                      return (
                        <button
                          key={result.id}
                          type="button"
                          data-result-index={resultIndex}
                          onMouseEnter={() => setSelectedIndex(resultIndex)}
                          onClick={() => selectResult(result)}
                          className={`flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition ${
                            selected
                              ? 'bg-cyan-400/[0.08] text-white'
                              : 'text-white/75 hover:bg-white/[0.04]'
                          }`}
                        >
                          <div className={`mt-0.5 rounded-xl border p-2 ${selected ? 'border-cyan-400/20 bg-cyan-400/[0.08] text-cyan-200' : 'border-white/8 bg-white/[0.03] text-white/50'}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-semibold">{result.title}</p>
                              {result.kind === 'finding' ? (
                                <span className="rounded-full border border-amber-400/20 bg-amber-400/8 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-amber-200/80">
                                  ranked
                                </span>
                              ) : null}
                              {result.kind === 'storyline' ? (
                                <span className="rounded-full border border-violet-400/18 bg-violet-400/8 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-violet-200/75">
                                  latest
                                </span>
                              ) : null}
                            </div>
                            <p className="truncate text-xs text-white/48">{result.subtitle}</p>
                            <p className="mt-1 line-clamp-2 text-xs text-white/62">{result.detail}</p>
                          </div>
                          {selected ? <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-cyan-300" /> : null}
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))
            )}
          </div>

          <div className="flex items-center gap-4 border-t border-white/8 px-4 py-2 text-[10px] uppercase tracking-[0.16em] text-white/38">
            <span><kbd className="rounded border border-white/10 px-1.5 py-0.5">↑↓</kbd> navigate</span>
            <span><kbd className="rounded border border-white/10 px-1.5 py-0.5">↵</kbd> open</span>
            <span><kbd className="rounded border border-white/10 px-1.5 py-0.5">tab</kbd> autofill</span>
            <span><kbd className="rounded border border-white/10 px-1.5 py-0.5">&gt;</kbd> commands</span>
          </div>
        </div>

        {preview ? (
          <aside className="hidden w-72 shrink-0 border-l border-white/8 bg-white/[0.02] p-4 lg:block">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
              <Command className="h-3.5 w-3.5" />
              <span>{preview.group}</span>
            </div>
            <h3 className="mt-4 text-base font-semibold text-white">{preview.title}</h3>
            <p className="mt-1 text-sm text-white/52">{preview.subtitle}</p>
            <p className="mt-3 text-sm leading-6 text-white/68">{preview.detail}</p>
            {preview.href ? (
              <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2 text-xs text-cyan-200/80">
                {preview.href}
              </div>
            ) : null}
          </aside>
        ) : null}
      </div>
    </div>
  );
}
