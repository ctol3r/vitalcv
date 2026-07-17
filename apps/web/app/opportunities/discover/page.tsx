import { redirect } from 'next/navigation'

/**
 * Canonical alias: /opportunities/discover converges on the signed-in
 * MATCHA Discover surface, which lives in the holder workspace (auth +
 * clinician role are enforced by the /holder layout and middleware).
 */
export default function OpportunitiesDiscoverAlias() {
  redirect('/holder/opportunities/discover')
}
