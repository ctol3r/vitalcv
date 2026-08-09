import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageFrame } from '@/components/layout/PageFrame';
import { BoardClient } from '@/components/explore/board/BoardClient';

/**
 * /explore — the public opportunities board.
 *
 * This route already existed in the auth and chrome contracts (roles.ts
 * PUBLIC_ROUTE_PATTERNS, publicSurfaceRoutes.ts) and is monitored as a critical
 * route by launch-ops, but its page had been archived to _archive/wave119 — so
 * /explore returned 404 in production while four surfaces still linked to it.
 * This restores the page those contracts assume.
 *
 * Static + revalidate: the board is anonymous-first, so it is shared-cached and
 * the viewer-specific half (credential readiness) is fetched client-side. That
 * keeps the public surface fast and indexable without ever caching one
 * clinician's readiness for another.
 */

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Clinical roles',
  description:
    'Browse open clinical roles with the employer’s stated requirements, pay, start timing and sponsorship shown up front — each answer named to the source it came from.',
};

export default function ExplorePage() {
  return (
    // data-surface-tier="public": CD-14 fixes the public acquisition tier as
    // paper, light only. The app currently pins forcedTheme="light" in
    // providers.tsx, so `.dark` never lands today — this attribute is the guard
    // for if that is ever relaxed, since a dark `.mz` repaint would otherwise
    // take this surface with it. See styles/matcha-zen.css.
    <div className="mz mz-paper mz-persona-holder min-h-screen" data-surface-tier="public">
      <PageFrame as="main" mode="marketing">
        <header style={{ marginBottom: 22 }}>
          <p className="mz-eyebrow">Open roles</p>
          <h1 className="mz-h1" style={{ marginTop: 12, maxWidth: 660 }}>
            Roles with the <span className="mz-accent">requirements shown up front</span>.
          </h1>
          <p className="mz-lede" style={{ marginTop: 12, maxWidth: 620 }}>
            Every listing shows what the employer actually requires, what it pays, how
            soon it starts, and where that information came from. Signed in with your
            NPI linked, the board also shows which requirements your record already
            satisfies.
          </p>
        </header>

        <Suspense fallback={<BoardFallback />}>
          <BoardClient />
        </Suspense>
      </PageFrame>
    </div>
  );
}

function BoardFallback() {
  return (
    <p className="mz-mono" style={{ fontSize: 12.5, color: 'var(--vt-text-muted)' }}>
      Loading roles…
    </p>
  );
}
