'use client';

import { Bot, GitBranchPlus, Radar, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { ContextPanel } from '@/components/shell/ContextPanel';
import type { GraphViewportState } from '@/components/graph-system/viewportModel';
import type { EvidenceListItem } from './intelligenceModel';

interface CopilotResponseResult {
  id: string;
  title: string;
  summary: string;
  trustScore?: number;
  sourceCoverage: string[];
}

interface CopilotResponseInsight {
  summary: string;
}

export interface IntelligenceCopilotState {
  query: string;
  loading: boolean;
  error: string | null;
  results: CopilotResponseResult[];
  insights: CopilotResponseInsight[];
}

interface RightContextPanelProps {
  viewport: GraphViewportState;
  graphView: ReactNode;
  legend: ReactNode;
  focusTitle: string;
  focusSummary: string;
  evidence: EvidenceListItem[];
  copilot: IntelligenceCopilotState;
  onCopilotQueryChange: (value: string) => void;
  onRunCopilot: () => void;
}

const COPILOT_SUGGESTIONS = [
  'Which providers are ready for verification?',
  'Show the strongest evidence around the selected provider.',
  'What trust gaps are blocking this network?',
];

export function RightContextPanel({
  viewport,
  graphView,
  legend,
  focusTitle,
  focusSummary,
  evidence,
  copilot,
  onCopilotQueryChange,
  onRunCopilot,
}: RightContextPanelProps) {
  return (
    <ContextPanel
      subtitle="Graph exploration, Copilot reasoning, and source evidence stay co-located."
      title="Context Panel"
    >
      <section className="vital-panel vital-panel--dense">
        <div className="vital-panel__header">
          <div>
            <p className="vital-panel__eyebrow">Graph view</p>
            <h2 className="vital-panel__title">{focusTitle}</h2>
          </div>
          <span className="vital-status-pill">{viewport.zoomBand}</span>
        </div>
        <p className="vital-panel__copy">{focusSummary}</p>
        <div className="vital-context-graph mt-4">{graphView}</div>
        <div className="vital-chip-list mt-3">
          <span className="vital-chip">
            <Radar className="h-3 w-3" aria-hidden />
            {viewport.zoom.toFixed(2)}x zoom
          </span>
          <span className="vital-chip">
            <GitBranchPlus className="h-3 w-3" aria-hidden />
            Double-click expands local context
          </span>
        </div>
        <div className="mt-4">{legend}</div>
      </section>

      <section className="vital-panel vital-panel--dense">
        <div className="vital-panel__header">
          <div>
            <p className="vital-panel__eyebrow">Copilot panel</p>
            <h2 className="vital-panel__title">Ask the trust engine</h2>
          </div>
          <Bot className="h-4 w-4 text-[var(--vital-ops-accent-magenta)]" aria-hidden />
        </div>
        <label className="vital-copilot-composer">
          <textarea
            value={copilot.query}
            onChange={(event) => onCopilotQueryChange(event.target.value)}
            className="vital-copilot-composer__field"
            rows={4}
            placeholder="Ask Copilot about providers, trust posture, or evidence gaps."
          />
        </label>
        <div className="vital-chip-list mt-3">
          {COPILOT_SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="vital-chip"
              onClick={() => onCopilotQueryChange(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="vital-action-button vital-action-button--full mt-3"
          onClick={onRunCopilot}
          disabled={copilot.loading}
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          <span>{copilot.loading ? 'Running Copilot...' : 'Ask Copilot'}</span>
        </button>

        {copilot.error ? (
          <div className="vital-empty-state mt-3">{copilot.error}</div>
        ) : null}

        {copilot.results.length > 0 ? (
          <div className="vital-stack-list mt-3">
            {copilot.results.slice(0, 3).map((result) => (
              <article key={result.id} className="vital-inspector-item">
                <div className="vital-inspector-item__meta">
                  <span className="vital-inspector-item__label">{result.title}</span>
                  <span className="vital-inspector-item__detail">{result.summary}</span>
                  <span className="vital-inspector-item__detail">
                    {result.sourceCoverage.join(', ')}
                  </span>
                </div>
                {typeof result.trustScore === 'number' ? (
                  <span className="vital-status-pill">{Math.round(result.trustScore)}</span>
                ) : null}
              </article>
            ))}
          </div>
        ) : null}

        {copilot.insights.length > 0 ? (
          <div className="vital-stack-list mt-3">
            {copilot.insights.slice(0, 2).map((insight, index) => (
              <div key={`${insight.summary}-${index}`} className="vital-inline-action">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                <span>{insight.summary}</span>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="vital-panel vital-panel--dense">
        <div className="vital-panel__header">
          <div>
            <p className="vital-panel__eyebrow">Source evidence</p>
            <h2 className="vital-panel__title">Primary support</h2>
          </div>
        </div>
        <div className="vital-stack-list">
          {evidence.length === 0 ? (
            <div className="vital-empty-state">Select a node to inspect its evidence chain.</div>
          ) : (
            evidence.slice(0, 8).map((item) => (
              <article key={item.id} className="vital-inspector-item">
                <div className="vital-inspector-item__meta">
                  <span className="vital-inspector-item__label">{item.title}</span>
                  <span className="vital-inspector-item__detail">{item.summary}</span>
                </div>
                <span className="vital-status-pill">{item.kind}</span>
              </article>
            ))
          )}
        </div>
      </section>
    </ContextPanel>
  );
}
