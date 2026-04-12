import { DecisionState } from '@vitalcv/trust-state';

export function safeTruncateText(value: string, maxLength: number): string {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (normalized.length <= maxLength) {
    return normalized;
  }

  if (maxLength <= 1) {
    return normalized.slice(0, maxLength);
  }

  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

export function decisionStateLabel(state: DecisionState): string {
  switch (state) {
    case DecisionState.READY:
      return 'Ready';
    case DecisionState.CONDITIONAL:
      return 'Conditional';
    case DecisionState.BLOCKED:
      return 'Blocked';
    case DecisionState.ACTION_REQUIRED:
    default:
      return 'Action required';
  }
}

export function summarizeItemLabels(
  items: readonly { label: string }[],
  options?: {
    emptyLabel?: string;
    maxLabelLength?: number;
  },
): string {
  const labels = Array.from(new Set(
    items
      .map((item) => item.label.trim().replace(/\s+/g, ' '))
      .filter((label) => label.length > 0),
  ));

  if (labels.length === 0) {
    return options?.emptyLabel ?? 'an item';
  }

  const first = safeTruncateText(labels[0] ?? 'an item', options?.maxLabelLength ?? 48);
  if (labels.length === 1) {
    return first;
  }

  return `${first} +${labels.length - 1} more`;
}
