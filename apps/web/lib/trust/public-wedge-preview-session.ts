export type PublicWedgePreviewMode = 'live' | 'preview_only';

export interface PublicWedgePreviewSession {
  capturedAt: string;
  npi: string;
  displayName: string;
  specialty: string | null;
  readinessScore: number | null;
  mode: PublicWedgePreviewMode;
}

const PUBLIC_WEDGE_PREVIEW_SESSION_KEY = 'vitalcv.public-wedge-preview';

function parseStoredPreview(raw: string | null): PublicWedgePreviewSession | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }

    const candidate = parsed as Record<string, unknown>;
    const npi = typeof candidate.npi === 'string' ? candidate.npi.trim() : '';
    const displayName = typeof candidate.displayName === 'string' ? candidate.displayName.trim() : '';
    const capturedAt = typeof candidate.capturedAt === 'string' ? candidate.capturedAt : '';
    const mode = candidate.mode === 'live' || candidate.mode === 'preview_only'
      ? candidate.mode
      : null;

    if (!/^\d{10}$/.test(npi) || !displayName || !capturedAt || !mode) {
      return null;
    }

    return {
      capturedAt,
      npi,
      displayName,
      specialty: typeof candidate.specialty === 'string' && candidate.specialty.trim().length > 0
        ? candidate.specialty.trim()
        : null,
      readinessScore: typeof candidate.readinessScore === 'number' && Number.isFinite(candidate.readinessScore)
        ? candidate.readinessScore
        : null,
      mode,
    };
  } catch {
    return null;
  }
}

export function readPublicWedgePreviewSession(
  expectedNpi?: string | null,
): PublicWedgePreviewSession | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const snapshot = parseStoredPreview(window.sessionStorage.getItem(PUBLIC_WEDGE_PREVIEW_SESSION_KEY));
  if (!snapshot) {
    return null;
  }

  if (typeof expectedNpi === 'string' && expectedNpi.trim().length > 0 && snapshot.npi !== expectedNpi.trim()) {
    return null;
  }

  return snapshot;
}

export function writePublicWedgePreviewSession(
  snapshot: PublicWedgePreviewSession,
): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.setItem(PUBLIC_WEDGE_PREVIEW_SESSION_KEY, JSON.stringify(snapshot));
  } catch {
    // Storage failures should never block the public wedge flow.
  }
}

export function clearPublicWedgePreviewSession(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.removeItem(PUBLIC_WEDGE_PREVIEW_SESSION_KEY);
  } catch {
    // Storage failures should never block the public wedge flow.
  }
}
