import { clerk, clerkSetup } from '@clerk/testing/playwright'
import { expect, test as setup } from '@playwright/test'

import { AUTH_STATE_PATH } from '../../playwright.config'
import { E2E_CLINICIAN_EMAIL } from './testClinician'

/**
 * Authed-suite bootstrap (J8): make the real gate crossable, once.
 *
 * 1. Maps the E2E_* Clerk DEVELOPMENT-instance keys onto the names
 *    @clerk/testing expects, and obtains a Testing Token (bypasses Clerk's
 *    bot detection for this run — the documented mechanism, not a hack).
 * 2. Ensures the shared test clinician exists via the instance API —
 *    idempotent, keyed by email. `+clerk_test` addresses are Clerk's
 *    dev-instance test users: no real mailbox, no real person.
 * 3. Mints a one-time sign-in TICKET for that user (Backend API) and consumes
 *    it through the real ClerkJS sign-in — factor-agnostic, so it works no
 *    matter which first factors (password / email code / …) the instance has
 *    enabled. Then visits a /holder route so the role-resolution chain
 *    (middleware → /auth/resolving → /api/auth/resolve-role → backend
 *    /api/me/role) mints the signed role cookie exactly as it does for a real
 *    clinician.
 * 4. Saves browser state for every authed spec to reuse.
 *
 * The test instance is a Clerk *development* instance: it cannot serve
 * production traffic and holds no real clinician data.
 */

// A committed password for a synthetic user on a development-only instance
// that can never hold real data. Only used to seed the user; sign-in uses a
// one-time ticket, so the instance's enabled factors don't matter.
const E2E_CLINICIAN_PASSWORD = 'vitalcv-e2e-Fixture-7741!'

const CLERK_API = 'https://api.clerk.com/v1'

function secretKey(): string {
  const key = process.env.E2E_CLERK_SECRET_KEY
  if (!key) throw new Error('authed suite started without E2E_CLERK_SECRET_KEY')
  if (!key.startsWith('sk_test_')) {
    // Refuse to run user bootstrap against anything but a development
    // instance — this suite creates and signs in synthetic users.
    throw new Error('authed suite requires a sk_test_ (development instance) key')
  }
  return key
}

async function clerkApi(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${CLERK_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
}

/** Create-or-find the shared test clinician. Returns its Clerk user id. */
async function ensureTestClinician(): Promise<string> {
  const lookup = await clerkApi(
    `/users?email_address=${encodeURIComponent(E2E_CLINICIAN_EMAIL)}&limit=1`,
  )
  if (lookup.ok) {
    const found = (await lookup.json()) as Array<{ id: string }>
    if (found.length > 0) return found[0].id
  }

  const created = await clerkApi('/users', {
    method: 'POST',
    body: JSON.stringify({
      email_address: [E2E_CLINICIAN_EMAIL],
      password: E2E_CLINICIAN_PASSWORD,
      first_name: 'E2E',
      last_name: 'Clinician',
    }),
  })
  if (!created.ok) {
    const body = await created.text()
    // A concurrent run may have created it between lookup and create.
    if (created.status === 422 && body.includes('taken')) {
      const retry = await clerkApi(
        `/users?email_address=${encodeURIComponent(E2E_CLINICIAN_EMAIL)}&limit=1`,
      )
      const found = (await retry.json()) as Array<{ id: string }>
      if (found.length > 0) return found[0].id
    }
    throw new Error(`could not ensure test clinician: ${created.status} ${body.slice(0, 200)}`)
  }
  return ((await created.json()) as { id: string }).id
}

/** Mint a one-time sign-in ticket for the user — factor-agnostic sign-in. */
async function createSignInTicket(userId: string): Promise<string> {
  const res = await clerkApi('/sign_in_tokens', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId }),
  })
  if (!res.ok) {
    throw new Error(`could not mint sign-in ticket: ${res.status} ${(await res.text()).slice(0, 200)}`)
  }
  return ((await res.json()) as { token: string }).token
}

setup('sign the shared test clinician in through the real gate', async ({ page }) => {
  // @clerk/testing reads the standard env names in THIS process; the web
  // server got them via playwright.config's webServer.env.
  process.env.CLERK_SECRET_KEY = secretKey()
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = process.env.E2E_CLERK_PUBLISHABLE_KEY

  await clerkSetup()
  const userId = await ensureTestClinician()
  const ticket = await createSignInTicket(userId)

  // ClerkJS must be loaded on the page before clerk.signIn can drive it.
  await page.goto('/sign-in')
  await clerk.signIn({ page, signInParams: { strategy: 'ticket', ticket } })

  // Cross a /holder route once so the real role-resolution chain runs and the
  // signed role cookie lands in this browser state. A brand-new Clerk user
  // resolves to the default CLINICIAN role via backend /api/me/role.
  await page.goto('/holder/opportunities/discover')
  await expect(page).toHaveURL(/\/holder\/opportunities\/discover/, { timeout: 45_000 })
  await expect(page.getByRole('heading', { level: 1, name: 'Discover' })).toBeVisible({
    timeout: 30_000,
  })

  await page.context().storageState({ path: AUTH_STATE_PATH })
})
