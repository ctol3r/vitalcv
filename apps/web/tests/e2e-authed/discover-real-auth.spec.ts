import { expect, test } from '@playwright/test'

/**
 * MATCHA Discover through the REAL auth path (J8).
 *
 * Everything here crosses the real Clerk gate as a signed-in test clinician —
 * no preview harness, no fixture escape hatch. This is the acceptance
 * coverage the fixture suite structurally cannot give:
 *
 *   - the /holder middleware chain (Clerk session → role cookie) admits a
 *     clinician and keeps everyone else out,
 *   - the live surface NEVER falls back to sample data,
 *   - a decision persists through real auth to the real database and derives
 *     back out through the deck-signals contract,
 *   - the Interested workspace renders that persisted decision.
 *
 * The web server runs with a Clerk DEVELOPMENT instance; the backend runs
 * locally in CI so role resolution is the real chain end-to-end.
 */

test.describe('real gate', () => {
  test('a signed-in clinician reaches Discover with no sample-data fallback', async ({ page }) => {
    await page.goto('/holder/opportunities/discover')

    // Through the gate — not bounced to sign-in, not stuck resolving.
    await expect(page).toHaveURL(/\/holder\/opportunities\/discover/)
    await expect(page.getByRole('heading', { level: 1, name: 'Discover' })).toBeVisible()

    // The truth boundary: an authenticated surface may be live or honestly
    // empty, but NEVER the preview fixture deck.
    const mode = await page
      .locator('[data-matcha-deck-source-mode]')
      .getAttribute('data-matcha-deck-source-mode')
    expect(['live', 'empty']).toContain(mode)
    await expect(page.locator('[data-mdk-sample-banner]')).toHaveCount(0)

    if (mode === 'empty') {
      // The empty state must say plainly that nothing was substituted.
      await expect(page.getByText('No sample roles have been substituted.')).toBeVisible()
    }
  })

  test('signed-out visitors are redirected to sign-in, not shown the deck', async ({ browser, baseURL }) => {
    // A fresh context with NO stored auth — the signed-out control.
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const page = await context.newPage()
    await page.goto('/holder/opportunities/discover')
    await expect(page).toHaveURL(/\/sign-in/, { timeout: 20_000 })
    expect(page.url().startsWith(String(baseURL))).toBe(true)
    await context.close()
  })
})

test.describe('decision persistence through real auth', () => {
  test('a deck signal persists, is idempotent, derives back out, and restores clean', async ({
    page,
  }) => {
    await page.goto('/holder/opportunities/discover')
    await expect(page.getByRole('heading', { level: 1, name: 'Discover' })).toBeVisible()

    const opportunityId = `e2e-authed-${Date.now()}`
    const clientSignalId = `e2e-sig-${Date.now()}`

    // 1. Persist an interested decision as the signed-in clinician.
    const post = await page.request.post('/api/matcha/deck/signal', {
      data: {
        action: 'interested',
        opportunityId,
        opportunityVersion: 'e2e-v1',
        clientSignalId,
      },
    })
    expect(post.status()).toBe(200)
    const posted = (await post.json()) as { persisted?: boolean; duplicate?: boolean }
    expect(posted.persisted).toBe(true)
    expect(posted.duplicate).toBe(false)

    // 2. The SAME intent retried collapses onto one row — the J2 idempotency
    //    contract, now proven through real auth against the real database.
    const retry = await page.request.post('/api/matcha/deck/signal', {
      data: { action: 'interested', opportunityId, opportunityVersion: 'e2e-v1', clientSignalId },
    })
    expect(((await retry.json()) as { duplicate?: boolean }).duplicate).toBe(true)

    // 3. The decision derives back out of the append-only log.
    const decisions = (await (await page.request.get('/api/matcha/deck/signals')).json()) as {
      decisions: Record<string, string>
    }
    expect(decisions.decisions[opportunityId]).toBe('interested')

    // 4. The Interested workspace renders it through the real gate. The role
    //    is not in the live feed, so it must appear as honest history — never
    //    silently swapped for a different listing.
    await page.goto('/holder/opportunities/interested')
    const card = page.locator(`.mdk-ws-card`).filter({ hasText: 'no longer in your active matches' })
    await expect(card.first()).toBeVisible()

    // 5. Restore (undo) — appends a restored row; the decision is gone.
    const restore = await page.request.post('/api/matcha/deck/signal', {
      data: {
        action: 'restored',
        opportunityId,
        opportunityVersion: 'e2e-v1',
        clientSignalId: `e2e-restore-${Date.now()}`,
      },
    })
    expect(((await restore.json()) as { persisted?: boolean }).persisted).toBe(true)
    const after = (await (await page.request.get('/api/matcha/deck/signals')).json()) as {
      decisions: Record<string, string>
    }
    expect(after.decisions[opportunityId]).toBeUndefined()
  })

  test('an unauthenticated signal write is rejected', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const res = await context.request.post(`${baseURL}/api/matcha/deck/signal`, {
      data: {
        action: 'interested',
        opportunityId: 'e2e-unauthed',
        clientSignalId: `e2e-unauthed-${Date.now()}`,
      },
    })
    expect(res.status()).toBe(401)
    await context.close()
  })
})
