import { notFound } from 'next/navigation';

import { StoryRailHarness } from './StoryRailHarness';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Story rail harness (dev)',
  robots: { index: false, follow: false },
};

/**
 * Developer-only harness for the SHD-3.1 horizontal story rail.
 *
 * The rail is a homepage enhancement, but the live homepage keeps its
 * scroll-coupled vertical composition until SHD-3.2/3.3 migrate those inner
 * components onto the chapter-progress model. This page lets the rail SHELL —
 * pin, native-scroll driver, keyboard path, skip-story, deep links, and the
 * vertical fallback — be exercised in a real browser and by Playwright now.
 *
 * Gated like the other dev harnesses: dev only, or a production-mode LOCAL
 * test build with STORY_RAIL_PREVIEW=1. Canonical production always denies it.
 */
export default function StoryRailDevPage() {
  const allowed =
    process.env.NODE_ENV !== 'production' || process.env.STORY_RAIL_PREVIEW === '1';
  if (!allowed) notFound();
  return <StoryRailHarness />;
}
