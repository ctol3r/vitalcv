'use client';

import { MessageSquareMore, Send, Sparkles } from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useCopilotSession } from './useCopilotSession';
import type {
  CopilotContextPayload,
  CopilotDocumentSection,
  CopilotGraphAction,
  CopilotSessionAction,
  CopilotSessionEntry,
} from './types';

interface CopilotSearchBarProps {
  compact?: boolean;
  sessionId?: string;
  context: CopilotContextPayload;
  onNavigateToNpi?: (npi: string) => void;
  onSelectFinding?: (findingId: string) => void;
  onSelectStoryline?: (storylineId: string) => void;
  onFocusGraphNode?: (nodeId: string) => void;
  onHighlightGraphNode?: (nodeId: string) => void;
  onOpenEvidence?: (findingId: string, evidenceIndex: number | null) => void;
  placeholder?: string;
  seedQuery?: string | null;
  autoFocus?: boolean;
}

function ContextChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface)] px-3 py-1 text-[11px] text-[var(--vt-text-2)]">
      <span className="uppercase tracking-[0.14em] text-[var(--vt-text-3)]">{label}</span>
      <span className="text-[var(--vt-text-1)]">{value}</span>
    </span>
  );
}

function availabilityTone(availability: CopilotDocumentSection['availability']) {
  switch (availability) {
    case 'ready':
      return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300';
    case 'limited':
      return 'border-amber-400/20 bg-amber-400/10 text-amber-300';
    case 'unavailable':
    default:
      return 'border-[var(--vt-border)] bg-[var(--vt-surface-2)] text-[var(--vt-text-3)]';
  }
}

function statusTone(status: CopilotSessionEntry['status']) {
  switch (status) {
    case 'ok':
      return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300';
    case 'limited':
      return 'border-amber-400/20 bg-amber-400/10 text-amber-300';
    default:
      return 'border-[var(--vt-border)] bg-[var(--vt-surface-2)] text-[var(--vt-text-3)]';
  }
}

function graphActionLabel(action: CopilotGraphAction | null | undefined): string {
  switch (action?.kind) {
    case 'focus-node':
      return 'Focus graph';
    case 'highlight-neighborhood':
      return 'Highlight neighborhood';
    case 'navigate-provider':
      return 'Open provider';
    default:
      return 'Graph action';
  }
}

function contextChips(context: CopilotContextPayload) {
  const chips: Array<{ label: string; value: string }> = [];

  if (context.provider) {
    chips.push({
      label: 'Provider',
      value: context.provider.label ?? `NPI ${context.provider.npi}`,
    });
  }

  if (context.finding) {
    chips.push({ label: 'Finding', value: context.finding.title });
  }

  if (context.storyline) {
    chips.push({ label: 'Storyline', value: context.storyline.title });
  }

  if (context.graph?.selectedNodeId || context.graph?.focusNodeId) {
    chips.push({
      label: 'Graph',
      value: context.graph.selectedNodeId ?? context.graph.focusNodeId ?? 'Neighborhood',
    });
  }

  if (chips.length === 0) {
    chips.push({ label: 'Scope', value: 'Global operator context' });
  }

  return chips;
}

function scopeHeading(context: CopilotContextPayload): string {
  if (context.provider?.label) {
    return `Provider ${context.provider.label}`;
  }

  if (context.finding?.title) {
    return `Finding ${context.finding.title}`;
  }

  if (context.storyline?.title) {
    return `Storyline ${context.storyline.title}`;
  }

  if (context.graph?.selectedNodeId || context.graph?.focusNodeId) {
    return `Graph ${context.graph.selectedNodeId ?? context.graph.focusNodeId}`;
  }

  return 'Current investigation scope';
}

function scopeSummary(context: CopilotContextPayload): string {
  if (context.finding?.summary) {
    return context.finding.summary;
  }

  if (context.storyline?.whyItMatters) {
    return context.storyline.whyItMatters;
  }

  if (context.provider?.summary) {
    return context.provider.summary;
  }

  if (context.riskSummary?.summary) {
    return context.riskSummary.summary;
  }

  return 'Use the current scope to ask for evidence, relationships, or the next action.';
}

function scopeFacts(context: CopilotContextPayload): string[] {
  const facts: string[] = [];

  if (context.provider?.npi) {
    facts.push(`NPI ${context.provider.npi}`);
  }

  if (context.provider?.trustBand) {
    facts.push(context.provider.trustBand);
  }

  if (typeof context.provider?.activeFindings === 'number') {
    facts.push(`${context.provider.activeFindings} active finding${context.provider.activeFindings === 1 ? '' : 's'}`);
  }

  if (context.finding?.severity) {
    facts.push(context.finding.severity);
  }

  if (context.storyline?.severity) {
    facts.push(context.storyline.severity);
  }

  if (context.graph?.selectedNodeId || context.graph?.focusNodeId) {
    facts.push(`Graph focus ${context.graph.selectedNodeId ?? context.graph.focusNodeId}`);
  }

  if (context.recentFindings.length > 0) {
    facts.push(`${context.recentFindings.length} recent finding${context.recentFindings.length === 1 ? '' : 's'}`);
  }

  return facts.slice(0, 4);
}

function ActionButton({
  action,
  onRun,
}: {
  action: CopilotSessionAction;
  onRun: (action: CopilotSessionAction) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => void onRun(action)}
      className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-xs font-medium text-cyan-200 transition hover:bg-cyan-400/15"
    >
      {action.label}
    </button>
  );
}

export function CopilotSearchBar({
  compact = false,
  sessionId = 'copilot-ui',
  context,
  onNavigateToNpi,
  onSelectFinding,
  onSelectStoryline,
  onFocusGraphNode,
  onHighlightGraphNode,
  onOpenEvidence,
  placeholder = 'Ask Copilot about the current investigation context…',
  seedQuery = null,
  autoFocus = false,
}: CopilotSearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const {
    draft,
    setDraft,
    loading,
    entries,
    events,
    quickSuggestions,
    submitDraft,
    submitPrompt,
    runAction,
    handleEntity,
    handleCitation,
    handleGraphAction,
  } = useCopilotSession({
    sessionId,
    context,
    host: {
      onNavigateToNpi,
      onSelectFinding,
      onSelectStoryline,
      onFocusGraphNode,
      onHighlightGraphNode,
      onOpenEvidence,
    },
  });

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (typeof seedQuery === 'string' && seedQuery.trim().length > 0) {
      setDraft(seedQuery);
    }
  }, [seedQuery, setDraft]);

  const chips = useMemo(() => contextChips(context), [context]);
  const visibleEntries = useMemo(() => [...entries].reverse(), [entries]);
  const activeFacts = useMemo(() => scopeFacts(context), [context]);

  function isSectionCollapsed(entryId: string, section: CopilotDocumentSection) {
    const key = `${entryId}:${section.id}`;
    return collapsedSections[key] ?? section.collapsedByDefault ?? (section.id !== 'summary' && section.id !== 'recommended_action');
  }

  function toggleSection(entryId: string, section: CopilotDocumentSection) {
    setCollapsedSections((current) => {
      const key = `${entryId}:${section.id}`;
      const currentValue = current[key] ?? section.collapsedByDefault ?? (section.id !== 'summary' && section.id !== 'recommended_action');
      return {
        ...current,
        [key]: !currentValue,
      };
    });
  }

  function renderEntry(entry: CopilotSessionEntry) {
    return (
      <article
        key={entry.id}
        className="space-y-3 rounded-md border border-[var(--vt-border)] bg-[var(--vt-surface)] p-3 animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out fill-mode-forwards"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-sm border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest ${statusTone(entry.status)}`}>
                {entry.status}
              </span>
              <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--vt-text-3)]">{entry.mode}</span>
            </div>
            <h3 className="text-sm font-semibold text-[var(--vt-text-1)]">{entry.title}</h3>
            <p className="text-xs text-[var(--vt-text-3)]">{entry.query}</p>
            {entry.message ? <p className="text-sm text-[var(--vt-text-2)]">{entry.message}</p> : null}
          </div>
          {entry.actions?.length ? (
            <div className="flex flex-wrap justify-end gap-2">
              {entry.actions.map((action) => (
                <ActionButton key={action.id} action={action} onRun={runAction} />
              ))}
            </div>
          ) : null}
        </div>

        <div className="space-y-2">
          {entry.document.sections.map((section) => {
            const collapsed = isSectionCollapsed(entry.id, section);
            return (
              <section
                key={`${entry.id}:${section.id}`}
                className="overflow-hidden rounded-md border border-[var(--vt-border)] bg-[var(--vt-surface-2)]"
              >
                <button
                  type="button"
                  onClick={() => toggleSection(entry.id, section)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--vt-text-1)]">{section.title}</p>
                      <span className={`rounded-full border px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.14em] ${availabilityTone(section.availability)}`}>
                        {section.availability}
                      </span>
                    </div>
                    {section.summary ? (
                      <p className="text-sm text-[var(--vt-text-3)]">{section.summary}</p>
                    ) : null}
                  </div>
                  <span className="text-xs text-[var(--vt-text-3)]">{collapsed ? 'Expand' : 'Collapse'}</span>
                </button>

                {!collapsed ? (
                  <div className="space-y-3 border-t border-[var(--vt-border)] px-4 py-3">
                    {section.items.length === 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {quickSuggestions.slice(0, 2).map((suggestion) => (
                          <button
                            key={`${entry.id}:${section.id}:${suggestion}`}
                            type="button"
                            onClick={() => void submitPrompt(suggestion)}
                            className="rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface)] px-3 py-1 text-xs text-[var(--vt-text-2)] transition hover:text-[var(--vt-text-1)]"
                          >
                            {suggestion}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => void submitPrompt('/investigate')}
                          className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-100 transition hover:bg-cyan-400/15"
                        >
                          Ask for a plan
                        </button>
                      </div>
                    ) : null}

                    {section.items.map((item) => (
                      <div key={item.id} className="space-y-2 rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] p-3">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-[var(--vt-text-1)]">{item.label}</p>
                          {item.detail ? <p className="text-sm leading-6 text-[var(--vt-text-2)]">{item.detail}</p> : null}
                        </div>

                        {item.entities?.length ? (
                          <div className="flex flex-wrap gap-2">
                            {item.entities.map((entity) => (
                              <button
                                key={entity.id}
                                type="button"
                                onClick={() => handleEntity(entity.value)}
                                className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-100 transition hover:bg-cyan-400/15"
                              >
                                {entity.label}
                              </button>
                            ))}
                          </div>
                        ) : null}

                        <div className="flex flex-wrap gap-2">
                          {item.citations?.map((citation) => (
                            <button
                              key={citation.id}
                              type="button"
                              onClick={() => handleCitation(citation.findingId ?? null, citation.evidenceIndex ?? null)}
                              className="rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface-2)] px-3 py-1 text-xs text-[var(--vt-text-2)] transition hover:text-[var(--vt-text-1)]"
                            >
                              {citation.label}
                            </button>
                          ))}
                          {item.graphAction ? (
                            <button
                              type="button"
                              onClick={() => handleGraphAction(item.graphAction)}
                              className="rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface-2)] px-3 py-1 text-xs text-[var(--vt-text-2)] transition hover:text-[var(--vt-text-1)]"
                            >
                              {graphActionLabel(item.graphAction)}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>

        {entry.suggestions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {entry.suggestions.slice(0, 4).map((suggestion) => (
              <button
                key={`${entry.id}:${suggestion}`}
                type="button"
                onClick={() => void submitPrompt(suggestion)}
                className="rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface-2)] px-3 py-1 text-xs text-[var(--vt-text-2)] transition hover:text-[var(--vt-text-1)]"
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}
      </article>
    );
  }

  function renderThinkingEntry() {
    const recentEvents = events.slice(-4);
    
    return (
      <article className="space-y-3 rounded-md border border-cyan-400/30 bg-cyan-400/5 p-3 animate-pulse">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-cyan-400 animate-spin" style={{ animationDuration: '3s' }} />
              <h3 className="text-sm font-semibold text-[var(--vt-text-1)]">Copilot thinking...</h3>
            </div>
            
            <div className="mt-4 flex flex-col gap-2 relative pl-2 border-l border-cyan-400/20">
              {recentEvents.length === 0 ? (
                <div className="flex items-center gap-2 text-xs text-[var(--vt-text-3)] animate-in fade-in slide-in-from-left-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/50" />
                  Analyzing context and parameters...
                </div>
              ) : (
                recentEvents.map((evt, idx) => (
                  <div key={evt.id} className="flex flex-col gap-0.5 animate-in fade-in slide-in-from-left-1" style={{ animationDelay: `${idx * 150}ms`, animationFillMode: 'forwards' }}>
                    <div className="flex items-center gap-2 text-xs font-medium text-[var(--vt-text-2)]">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/70" />
                      {evt.label}
                    </div>
                    {evt.detail && <span className="pl-3.5 text-[10px] text-[var(--vt-text-3)] line-clamp-1">{evt.detail}</span>}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </article>
    );
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitDraft();
  }

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <ContextChip key={`${chip.label}:${chip.value}`} label={chip.label} value={chip.value} />
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {quickSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => void submitPrompt(suggestion)}
              className="rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface-2)] px-3 py-1.5 text-xs text-[var(--vt-text-2)] transition hover:border-cyan-400/30 hover:text-[var(--vt-text-1)]"
            >
              {suggestion}
            </button>
          ))}
          {(context.provider || context.finding || context.storyline) ? (
            <button
              type="button"
              onClick={() => void submitPrompt('/investigate')}
              className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-xs font-medium text-cyan-100 transition hover:bg-cyan-400/15"
            >
              Start Investigation
            </button>
          ) : null}
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        <div className="group flex items-center gap-2 rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] px-3 py-2 transition-colors focus-within:border-cyan-400/30 focus-within:bg-[var(--vt-surface-2)]">
          {loading ? (
            <div className="flex h-4 w-4 shrink-0 items-center justify-center gap-0.5">
              <span className="h-1 w-1 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="h-1 w-1 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="h-1 w-1 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          ) : (
            <Sparkles className="h-4 w-4 shrink-0 text-cyan-400 animate-pulse duration-2000" />
          )}
          <input
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={placeholder}
            autoFocus={autoFocus}
            className="min-w-0 flex-1 bg-transparent text-sm text-[var(--vt-text-1)] outline-none placeholder:text-[var(--vt-text-3)]"
          />
          <button
            type="submit"
            disabled={loading || draft.trim().length < 3}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-100 transition hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs text-[var(--vt-text-3)]">
          Use structured prompts or slash commands like <code>/investigate</code>, <code>/plan</code>, <code>/check oig</code>, <code>/compare &lt;provider&gt;</code>, <code>/network</code>, and <code>/history</code>.
        </p>
      </form>

      {visibleEntries.length > 0 || loading ? (
        <div className="space-y-3">
          {loading && renderThinkingEntry()}
          {visibleEntries.map(renderEntry)}
        </div>
      ) : (
        <div className="rounded-md border border-[var(--vt-border)] bg-[var(--vt-surface)] px-4 py-4">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface-2)] p-2">
              <MessageSquareMore className="h-4 w-4 text-[var(--vt-text-3)]" />
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-[var(--vt-text-1)]">{scopeHeading(context)}</p>
                <p className="text-sm leading-6 text-[var(--vt-text-3)]">
                  {scopeSummary(context)}
                </p>
              </div>

              {activeFacts.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {activeFacts.map((fact) => (
                    <span
                      key={fact}
                      className="rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface-2)] px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-[var(--vt-text-3)]"
                    >
                      {fact}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                {quickSuggestions.slice(0, 3).map((suggestion) => (
                  <button
                    key={`scope:${suggestion}`}
                    type="button"
                    onClick={() => void submitPrompt(suggestion)}
                    className="rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface-2)] px-3 py-1.5 text-xs text-[var(--vt-text-2)] transition hover:border-cyan-400/30 hover:text-[var(--vt-text-1)]"
                  >
                    {suggestion}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => void submitPrompt('/investigate')}
                  className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-xs font-medium text-cyan-100 transition hover:bg-cyan-400/15"
                >
                  Start investigation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
