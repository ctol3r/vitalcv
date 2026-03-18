import type { GraphNode } from '@/components/graph-system/types';
import { formatGraphNodeType } from '@/components/graph/state/graphDisplayState';

interface GraphTooltipOptions {
  node: GraphNode;
  relationshipCount: number;
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

  return root;
}
