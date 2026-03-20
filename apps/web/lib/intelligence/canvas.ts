export const CANVAS_OPEN_PANEL_VALUES = [
  'provider',
  'finding',
  'storyline',
] as const;

export const CANVAS_EMPTY_PANEL_SENTINEL = 'none';

export type CanvasOpenPanel = (typeof CANVAS_OPEN_PANEL_VALUES)[number];

const COMPARE_NPI_RE = /^\d{10}$/;

export function isCanvasOpenPanel(value: string | null | undefined): value is CanvasOpenPanel {
  return Boolean(value) && CANVAS_OPEN_PANEL_VALUES.includes(value as CanvasOpenPanel);
}

export function parseCanvasOpenPanels(values: readonly string[]): CanvasOpenPanel[] {
  const deduped: CanvasOpenPanel[] = [];

  for (const value of values) {
    if (!isCanvasOpenPanel(value) || deduped.includes(value)) {
      continue;
    }
    deduped.push(value);
  }

  return deduped;
}

export function serializeCanvasOpenPanels(values: readonly CanvasOpenPanel[]): CanvasOpenPanel[] {
  return parseCanvasOpenPanels(values);
}

export function buildCanvasOpenPanelParams(values: readonly CanvasOpenPanel[]): string[] {
  const normalized = serializeCanvasOpenPanels(values);
  return normalized.length > 0 ? normalized : [CANVAS_EMPTY_PANEL_SENTINEL];
}

export function mergeCanvasOpenPanels(
  existing: readonly CanvasOpenPanel[],
  panel: CanvasOpenPanel,
): CanvasOpenPanel[] {
  return serializeCanvasOpenPanels([...existing, panel]);
}

export function removeCanvasOpenPanel(
  existing: readonly CanvasOpenPanel[],
  panel: CanvasOpenPanel,
): CanvasOpenPanel[] {
  return serializeCanvasOpenPanels(existing.filter((candidate) => candidate !== panel));
}

export function parseCompareSelection(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  const deduped: string[] = [];

  for (const candidate of value.split(',')) {
    const normalized = candidate.trim();
    if (!COMPARE_NPI_RE.test(normalized) || deduped.includes(normalized)) {
      continue;
    }
    deduped.push(normalized);
  }

  return deduped.slice(0, 3);
}

export function serializeCompareSelection(values: readonly string[]): string | null {
  const normalized = parseCompareSelection(values.join(','));
  return normalized.length > 0 ? normalized.join(',') : null;
}

export function toggleCompareSelection(
  existing: readonly string[],
  npi: string,
  maxSelections = 3,
): string[] {
  if (!COMPARE_NPI_RE.test(npi)) {
    return parseCompareSelection(existing.join(','));
  }

  const normalized = parseCompareSelection(existing.join(','));
  if (normalized.includes(npi)) {
    return normalized.filter((candidate) => candidate !== npi);
  }

  return [...normalized.slice(-(Math.max(1, maxSelections) - 1)), npi];
}
