import type { GraphNode } from '@/components/graph-system/types';
import { formatGraphNodeType } from '@/components/graph/state/graphDisplayState';
import type { TooltipEntityContext } from '@/lib/intelligence/entity-registry';

interface GraphTooltipOptions {
  node: GraphNode;
  relationshipCount: number;
  entityContext?: TooltipEntityContext | null;
}

function appendMetric(
  container: HTMLElement,
  label: string,
  value: string,
) {
  const metric = document.createElement('div');
  metric.className = 'vital-graph-tooltip__metric';

  const metricLabel = document.createElement('span');
  metricLabel.className = 'vital-graph-tooltip__metric-label';
  metricLabel.textContent = label;

  const metricValue = document.createElement('span');
  metricValue.className = 'vital-graph-tooltip__metric-value';
  metricValue.textContent = value;

  metric.append(metricLabel, metricValue);
  container.append(metric);
}

export function buildGraphTooltipContent({
  node,
  relationshipCount,
  entityContext,
}: GraphTooltipOptions): HTMLElement {
  const root = document.createElement('div');
  root.className = 'vital-graph-tooltip';

  const header = document.createElement('div');
  header.className = 'vital-graph-tooltip__header';

  const title = document.createElement('div');
  title.className = 'vital-graph-tooltip__title';
  title.textContent = node.title || node.label;

  const subtitle = document.createElement('div');
  subtitle.className = 'vital-graph-tooltip__subtitle';
  subtitle.textContent = formatGraphNodeType(node.type);

  header.append(title, subtitle);
  root.append(header);

  const metricGrid = document.createElement('div');
  metricGrid.className = 'vital-graph-tooltip__grid';

  appendMetric(metricGrid, 'Trust Score', node.trustScore ? String(node.trustScore) : 'n/a');
  appendMetric(metricGrid, 'Last Signal', node.lastSignal ? new Date(node.lastSignal).toLocaleDateString() : 'Just now');
  appendMetric(metricGrid, 'Risk Delta', node.riskDelta ? `${node.riskDelta > 0 ? '+' : ''}${node.riskDelta}` : '0');

  root.append(metricGrid);

  if (entityContext) {
    appendEntityContext(root, entityContext);
  }

  return root;
}

function appendEntityContext(root: HTMLElement, ctx: TooltipEntityContext): void {
  const section = document.createElement('div');
  section.className = 'vital-graph-tooltip__entity-context';

  if (ctx.provider) {
    const row = document.createElement('div');
    row.className = 'vital-graph-tooltip__entity-row';
    row.textContent = `${ctx.provider.name} (NPI ${ctx.provider.npi}) · Trust ${ctx.provider.trustScore}`;
    section.append(row);
  }

  for (const finding of ctx.findings) {
    const row = document.createElement('div');
    row.className = 'vital-graph-tooltip__entity-row';

    const badge = document.createElement('span');
    badge.className = 'vital-graph-tooltip__severity-badge';
    badge.dataset.severity = finding.severity;
    badge.textContent = finding.severity;

    const text = document.createElement('span');
    text.textContent = ` ${finding.title}`;

    row.append(badge, text);
    section.append(row);
  }

  for (const storyline of ctx.storylines) {
    const row = document.createElement('div');
    row.className = 'vital-graph-tooltip__entity-row';
    row.textContent = storyline.title;
    section.append(row);
  }

  if (ctx.backlinkCount > 0) {
    const footer = document.createElement('div');
    footer.className = 'vital-graph-tooltip__backlink-count';
    footer.textContent = `Referenced by ${ctx.backlinkCount} entit${ctx.backlinkCount === 1 ? 'y' : 'ies'}`;
    section.append(footer);
  }

  root.append(section);
}
