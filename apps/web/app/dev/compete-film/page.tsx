import { notFound } from 'next/navigation';

import { HorizontalCareerFilm } from '@/components/home/film/HorizontalCareerFilm';
import '@/styles/compete-film.css';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Horizontal career film (dev) · VitalCV',
  robots: { index: false, follow: false },
};

/**
 * COMPETE-1 preview harness — dev-only.
 *
 * The six-scene HorizontalCareerFilm, mounted where it can be exercised in a
 * real browser and by tests BEFORE `/` is switched. The component itself is
 * production code; only this route is gated. Gated exactly like the other dev
 * harnesses (`/dev/story-rail`, `/dev/page-stack`): dev only, or a
 * production-mode LOCAL build with COMPETE_FILM_PREVIEW=1. Canonical
 * production always denies it.
 *
 * See docs/design/homepage-composition-ownership.md for the engine decision,
 * the fallback ladder, and the component inventory this composition executes.
 */
export default function CompeteFilmDevPage() {
  const allowed =
    process.env.NODE_ENV !== 'production' || process.env.COMPETE_FILM_PREVIEW === '1';
  if (!allowed) notFound();
  return <HorizontalCareerFilm />;
}
