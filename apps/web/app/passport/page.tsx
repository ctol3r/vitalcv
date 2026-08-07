import { redirect } from 'next/navigation';

/**
 * /passport — RETIRED (founder decision, 2026-08-07).
 *
 * The founder experience audit (2026-08-06) called for collapsing the three
 * clinician entry points; the record-first /onboarding (#1090) made this
 * page's job — anonymous NPI → public snapshot → continue without re-typing —
 * native to the canonical entry. The entity view's data was already rendered
 * better by /verify/[npi] (same backend endpoint, Calm Wave, more content).
 *
 * This stub exists on purpose, not as leftovers:
 *  - holder-route-contract's golden scan requires every internal href in
 *    app/apply/** to resolve to a live route, and historical links point here;
 *  - the route stays declared PUBLIC in lib/auth/roles.ts (ROUTE-01: served
 *    routes must be protected or declared — never unclassified).
 *
 * Do not rebuild an experience here. The entry is /onboarding.
 */
export default function RetiredPassportPage() {
  redirect('/onboarding');
}
