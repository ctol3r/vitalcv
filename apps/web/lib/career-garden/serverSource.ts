import 'server-only';

import { cache } from 'react';
import { auth } from '@clerk/nextjs/server';

import { buildMarketplaceHeaders } from '@/lib/server/marketplace-proxy';
import { getApiBase } from '@/lib/api';

import { GARDEN_UNAVAILABLE, type GardenCvView, type GardenData, type GardenNoteView } from './gardenViews';
import type { CvSection } from './demoData';

/**
 * Live Career Garden data for the authenticated clinician. One fetch per
 * request (React cache), shared by the garden layout and every garden page.
 *
 * Fixtures are never a fallback here: when the backend cannot be reached the
 * caller gets `mode: 'unavailable'` and the UI says so honestly. The fixture
 * dataset exists only behind the /dev harness.
 */

const SECTIONS: readonly CvSection[] = ['experience', 'research', 'teaching', 'service', 'publications'];

interface BackendNote {
  id: string;
  title: string;
  body: string;
  tags: string[];
  status: string;
  createdAt: string;
}

interface BackendCvEntry {
  id: string;
  section: string;
  headline: string;
  detail: string;
  origin: string;
  fromNoteId?: string | null;
  createdAt: string;
}

function day(iso: string): string {
  return typeof iso === 'string' && iso.length >= 10 ? iso.slice(0, 10) : '';
}

function toNoteView(n: BackendNote): GardenNoteView {
  return {
    id: n.id,
    title: n.title,
    body: n.body,
    tags: Array.isArray(n.tags) ? n.tags : [],
    status: n.status === 'growing' || n.status === 'grown' ? n.status : 'unfiled',
    capturedAt: day(n.createdAt),
  };
}

function toCvView(e: BackendCvEntry): GardenCvView | null {
  if (!(SECTIONS as readonly string[]).includes(e.section)) return null;
  return {
    id: e.id,
    section: e.section as CvSection,
    headline: e.headline,
    detail: e.detail,
    provenance: 'self-attested',
    origin: [e.origin],
    approvedAt: day(e.createdAt),
    fromNoteId: e.fromNoteId ?? undefined,
  };
}

export const loadGardenData = cache(async (): Promise<GardenData> => {
  const session = await auth();
  if (!session.userId) return GARDEN_UNAVAILABLE;

  const base = getApiBase();
  if (!base) return GARDEN_UNAVAILABLE;

  // Marketplace headers carry the verified JWT and the email claim — the
  // email is what lets the backend create the User row on first touch, so
  // the garden works for a brand-new account before any NPI exists.
  const headers = await buildMarketplaceHeaders(session);

  try {
    const [notesRes, cvRes] = await Promise.all([
      fetch(`${base}/api/profile/garden/notes`, {
        headers,
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      }),
      fetch(`${base}/api/profile/garden/cv`, {
        headers,
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      }),
    ]);
    if (!notesRes.ok || !cvRes.ok) return GARDEN_UNAVAILABLE;

    const notesJson = (await notesRes.json()) as { notes?: BackendNote[] };
    const cvJson = (await cvRes.json()) as { entries?: BackendCvEntry[] };

    return {
      mode: 'live',
      notes: (notesJson.notes ?? []).map(toNoteView),
      cvEntries: (cvJson.entries ?? []).map(toCvView).filter((e): e is GardenCvView => e !== null),
    };
  } catch {
    return GARDEN_UNAVAILABLE;
  }
});
