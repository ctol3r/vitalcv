/**
 * Render THE HOMEPAGE — the real route, not whichever component happens to be
 * the homepage this month.
 *
 * Why this helper exists: until 2026-07-26 every homepage vitest file rendered
 * `app/HomePageClient` directly. When `/` switched to the six-scene film
 * (#859), all of them kept passing — while asserting a composition no visitor
 * could reach. A fully green vitest run proved nothing about the homepage.
 *
 * Importing the route's own default export means the next composition swap
 * cannot silently orphan these guards: they will either follow `/` or go red.
 *
 * `app/page.tsx` is an async-free server component that renders a client
 * component, so `renderToStaticMarkup` handles it — and that is exactly the
 * SSR path a no-JS visitor and the deploy-smoke marker grep both depend on.
 */

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import HomePage from '@/app/page';

/** The homepage's server-rendered HTML, exactly as `/` ships it. */
export function renderHomepageHtml(): string {
  return renderToStaticMarkup(React.createElement(HomePage));
}
