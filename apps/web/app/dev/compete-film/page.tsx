import { notFound } from 'next/navigation';

import { FilmSpike } from '@/components/home/film/FilmSpike';
import '@/styles/compete-film.css';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Horizontal film spike (dev) · VitalCV',
  robots: { index: false, follow: false },
};

/**
 * COMPETE-2 visual-reference spike — dev-only.
 *
 * The competitive mandate's dispatch is explicit: "Do not change production
 * routing yet." This route exists so the horizontal-film grammar can be
 * exercised in a real browser and by tests BEFORE `/` is touched. It is
 * gated exactly like the other dev harnesses (`/dev/story-rail`,
 * `/dev/page-stack`): dev only, or a production-mode LOCAL build with
 * COMPETE_FILM_PREVIEW=1. Canonical production always denies it.
 *
 * See docs/design/homepage-composition-ownership.md for the engine decision
 * and the fallback ladder this page demonstrates.
 */
export default function CompeteFilmDevPage() {
  const allowed =
    process.env.NODE_ENV !== 'production' || process.env.COMPETE_FILM_PREVIEW === '1';
  if (!allowed) notFound();
  return <FilmSpike />;
}
