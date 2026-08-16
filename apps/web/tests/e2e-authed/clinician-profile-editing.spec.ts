import { expect, test } from '@playwright/test'

import { E2E_CLINICIAN_EMAIL } from './testClinician'

/**
 * /clinician/profile — the editing flow, end to end, as a signed-in clinician.
 *
 * This is the regression guard for a specific failure mode this route has hit
 * twice: shipping controls that look editable and are not. The first time it
 * was 34 readOnly inputs with focus rings and no Save button. The second time
 * it was the opposite — a complete, tested editing surface (ProfileSurface)
 * sitting on disk imported by nothing, while the live page rendered a
 * read-only shell apologising that editing had not shipped.
 *
 * Unit tests cannot catch either one: they mount ProfileSurface directly and
 * mock fetch, so they pass whether or not the page imports it and whether or
 * not the backend accepts the write. This spec asserts the only thing that
 * actually matters to a clinician — I typed something, I saved it, and it was
 * still there when I came back — through the real page, the real Clerk
 * session, the real proxy routes, and the real backend.
 */

const CLERK_API = 'https://api.clerk.com/v1'

/**
 * The NPI the surface binds to. 1999999992 is the repo's canonical
 * checksum-valid-but-unassigned NPI (npi-smoke's ABSENT default): it passes
 * the CMS check digit and NPPES returns result_count 0 (verified 2026-08-16).
 * Nothing this spec asserts needs an NPPES-assigned NPI — the bind is
 * self-asserted (bootstrapNpiIntake upserts whether or not the registry
 * resolves) and the registry panel renders its heading in every state — and
 * binding an unassigned number means no environment this suite touches ever
 * squats a real registrant's NPI. Valid-format numbers can be assigned later:
 * re-verify against NPPES before reusing this value elsewhere.
 */
const TEST_NPI = '1999999992'

function backendBase(): string {
  return process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://127.0.0.1:4000'
}

function secretKey(): string {
  const key = process.env.E2E_CLERK_SECRET_KEY
  if (!key?.startsWith('sk_test_')) {
    throw new Error('authed suite requires a sk_test_ (development instance) key')
  }
  return key
}

async function clerkUserId(): Promise<string> {
  const res = await fetch(
    `${CLERK_API}/users?email_address=${encodeURIComponent(E2E_CLINICIAN_EMAIL)}&limit=1`,
    { headers: { Authorization: `Bearer ${secretKey()}` } },
  )
  const found = (await res.json()) as Array<{ id: string }>
  if (!found?.length) throw new Error('test clinician not found; did clinician.setup run?')
  return found[0].id
}

/**
 * Give the test clinician an NPI-bound PersonProfile.
 *
 * Without one the surface correctly renders its "Connect your NPI" empty
 * state and there is no form to drive — so this is a precondition of the
 * test, not part of what it asserts. Idempotent: re-bootstrapping an already
 * bound NPI is a no-op on the backend.
 */
test.beforeAll(async () => {
  const userId = await clerkUserId()
  const identity = {
    'Content-Type': 'application/json',
    'x-clerk-user-id': userId,
    'x-clerk-user-email': E2E_CLINICIAN_EMAIL,
  }

  // Already bound from an earlier run? Then there is nothing to do. Checked
  // first because binding is one-NPI-per-account: re-POSTing a bootstrap for
  // an NPI this account already holds is not a no-op, it is a conflict.
  const existing = await fetch(`${backendBase()}/api/me/workspaces`, { headers: identity })
  if (existing.ok) {
    const payload = (await existing.json()) as { personProfile?: { npi?: string | null } }
    if (payload?.personProfile?.npi) return
  }

  const res = await fetch(`${backendBase()}/api/profile/npi/bootstrap`, {
    method: 'POST',
    headers: identity,
    body: JSON.stringify({ npi: TEST_NPI }),
  })
  if (!res.ok) {
    const body = (await res.text()).slice(0, 200)
    // A distinct account holding this NPI is an environment problem, not a
    // product bug — say which, so the failure is not read as a regression in
    // the editing flow this spec exists to cover.
    if (body.includes('already registered')) {
      throw new Error(
        `NPI ${TEST_NPI} is bound to a different account in this environment. ` +
          `Free it (or give the e2e clinician its own NPI) before running this suite. Backend said: ${body}`,
      )
    }
    throw new Error(`could not bind NPI for the test clinician: ${res.status} ${body}`)
  }
})

test('the profile is editable, and what it saves survives a reload', async ({ page }) => {
  await page.goto('/clinician/profile')

  // The surface loads its workspace client-side; wait for the ready state
  // rather than the shell.
  const linkedin = page.locator('#profile-linkedin')
  await expect(linkedin).toBeVisible({ timeout: 45_000 })

  // The read-only shell's claim is gone because it is no longer true.
  await expect(page.getByText('This profile is read-only for now.')).toHaveCount(0)
  await expect(page.getByText('the editing flow has not shipped yet')).toHaveCount(0)

  // The registry panel the clinician cannot fix without seeing sits above the
  // form they can.
  const registryHeading = page.locator('#own-registry-record-heading')
  await expect(registryHeading).toBeVisible()
  const registryBox = await registryHeading.boundingBox()
  const formBox = await linkedin.boundingBox()
  expect(registryBox!.y).toBeLessThan(formBox!.y)

  // Save is inert until something actually changes.
  const save = page.getByRole('button', { name: /Save self-attested fields/i })
  await expect(save).toBeDisabled()

  // A value unique to this run, so a stale row can never make this pass.
  const unique = `https://linkedin.com/in/e2e-${Date.now()}`
  await linkedin.fill(unique)
  await expect(save).toBeEnabled()

  await save.click()
  await expect(page.getByText('Saved as self-attested.')).toBeVisible({ timeout: 30_000 })

  // The real assertion: it persisted server-side, not just in React state.
  await page.reload()
  await expect(page.locator('#profile-linkedin')).toHaveValue(unique, { timeout: 45_000 })

  // And it is labelled for what it is — never as verified.
  await expect(page.getByText('User-entered information is not verified until source-backed evidence is attached.')).toBeVisible()
})

test('a saved value can be cleared back to empty', async ({ page }) => {
  await page.goto('/clinician/profile')
  const linkedin = page.locator('#profile-linkedin')
  await expect(linkedin).toBeVisible({ timeout: 45_000 })

  // Seed a value so there is something to clear regardless of test order.
  const seeded = `https://linkedin.com/in/clear-${Date.now()}`
  await linkedin.fill(seeded)
  const save = page.getByRole('button', { name: /Save self-attested fields/i })
  await save.click()
  await expect(page.getByText('Saved as self-attested.')).toBeVisible({ timeout: 30_000 })

  // Clearing is a write, not a no-op: the surface warns before removing.
  await linkedin.fill('')
  await expect(page.getByText(/Saving will remove LinkedIn/i)).toBeVisible()
  await save.click()
  await expect(page.getByText('Saved as self-attested.')).toBeVisible({ timeout: 30_000 })

  await page.reload()
  await expect(page.locator('#profile-linkedin')).toHaveValue('', { timeout: 45_000 })
})
