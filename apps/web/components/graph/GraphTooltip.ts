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

  appendMetric(metricGrid, 'Confidence', node.confidence ? `${Math.round(node.confidence * 100)}%` : 'n/a');
  appendMetric(metricGrid, 'Trust tier', node.trustTier ?? 'Unassigned');
  appendMetric(metricGrid, 'Links', String(relationshipCount));
  appendMetric(metricGrid, 'Group', node.group || 'Ungrouped');

  root.append(metricGrid);

  return root;
}
