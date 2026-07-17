import { expect, test, type Page } from '@playwright/test'

/**
 * MATCHA Deck interaction spec (PR J1).
 *
 * Drives the fixture-backed harness at /dev/matcha-deck (enabled for the e2e
 * web server via MATCHA_DECK_PREVIEW=1) with real pointer input: commit
 * drags, failed-threshold returns, velocity commits, undo, details, keyboard,
 * and reduced motion. The signed-in surface at /holder/opportunities/discover
 * renders the identical component behind the Clerk gate.
 */

const HARNESS = '/dev/matcha-deck'

async function openDeck(page: Page) {
  // The real holder frame has persistent status/launch trackers, so network
  // idle is not a meaningful readiness signal. The deck's loaded marker is.
  await page.goto(HARNESS, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-mdk-loaded]')).toBeVisible()
  await expect(page.locator('[data-mdk-sample-banner]')).toBeVisible()
}

function stage(page: Page) {
  return page.locator('.mdk-stage')
}

function activeCard(page: Page) {
  return page.locator('.mdk-card--active')
}

async function expectNoOverlap(page: Page) {
  const actionBar = page.locator('[data-matcha-deck-actions]')
  await actionBar.scrollIntoViewIfNeeded()
  const actions = await actionBar.boundingBox()
  const bottomNav = await page.locator('[data-holder-mobile-bottom-nav]').boundingBox()

  expect(actions, 'deck action bar must have a bounding box').not.toBeNull()
  expect(bottomNav, 'holder bottom navigation must have a bounding box').not.toBeNull()
  expect(actions!.y + actions!.height, 'deck actions must end above the holder nav').toBeLessThanOrEqual(
    bottomNav!.y,
  )
}

async function activeId(page: Page): Promise<string> {
  return (await stage(page).getAttribute('data-mdk-active')) ?? ''
}

async function cardCenter(page: Page): Promise<{ x: number; y: number; width: number }> {
  const box = await activeCard(page).boundingBox()
  if (!box) throw new Error('active card has no bounding box')
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, width: box.width }
}

/**
 * Drag from the card center by (dx, dy).
 *
 * pauseMs > 0 walks the steps one round-trip at a time, deliberately slow, so
 * velocity stays under COMMIT_VELOCITY.
 *
 * pauseMs === 0 means "flick": travel the whole distance in a single move.
 * Velocity is derived from the LAST pointer delta over its wall-clock gap, so
 * splitting the path into steps shrinks that delta while a loaded CI runner
 * stretches the gap — which parks a 90px/3-step drag right on the 700px/s
 * line and makes it commit on a fast laptop but not in CI. One full-distance
 * move keeps the delta large and the gap to a single round-trip.
 */
async function drag(page: Page, dx: number, dy: number, steps: number, pauseMs = 0) {
  const center = await cardCenter(page)
  await page.mouse.move(center.x, center.y)
  await page.mouse.down()
  if (pauseMs > 0) {
    for (let i = 1; i <= steps; i += 1) {
      await page.mouse.move(center.x + (dx * i) / steps, center.y + (dy * i) / steps)
      await page.waitForTimeout(pauseMs)
    }
    await page.waitForTimeout(120) // settle: kill residual velocity
  } else {
    await page.mouse.move(center.x + dx, center.y + dy)
  }
  await page.mouse.up()
}

async function signalCount(page: Page, action: string): Promise<number> {
  return page.evaluate(
    (a) =>
      ((window as unknown as { __mdkSignals?: Array<{ action: string }> }).__mdkSignals ?? []).filter(
        (s) => s.action === a,
      ).length,
    action,
  )
}

test.describe('MATCHA Deck — pointer physics', () => {
  test('right drag past the threshold commits Interested and advances the deck', async ({ page }) => {
    await openDeck(page)
    expect(await activeId(page)).toBe('fx-rec-001')

    const { width } = await cardCenter(page)
    const commit = Math.min(120, width * 0.28)
    await drag(page, commit + 80, 0, 12)

    await expect(stage(page)).toHaveAttribute('data-mdk-active', 'fx-rec-002', { timeout: 3000 })
    expect(await signalCount(page, 'interested')).toBe(1)
    await expect(page.getByText('Interested (1)')).toBeVisible()
  })

  test('left drag past the threshold commits Pass', async ({ page }) => {
    await openDeck(page)
    const { width } = await cardCenter(page)
    await drag(page, -(Math.min(120, width * 0.28) + 80), 0, 12)

    await expect(stage(page)).toHaveAttribute('data-mdk-active', 'fx-rec-002', { timeout: 3000 })
    expect(await signalCount(page, 'passed')).toBe(1)
  })

  test('a below-threshold drag returns the card and decides nothing', async ({ page }) => {
    await openDeck(page)
    await drag(page, 60, 0, 14, 30) // slow, short — no distance or velocity commit

    await page.waitForTimeout(700) // let the snap-back spring finish
    expect(await activeId(page)).toBe('fx-rec-001')
    expect(await signalCount(page, 'interested')).toBe(0)
    expect(await signalCount(page, 'passed')).toBe(0)

    const transform = await activeCard(page).evaluate((el) => getComputedStyle(el).transform)
    // Card returned to rest (identity or near-identity transform).
    expect(transform === 'none' || /matrix\(1, 0, 0, 1, 0, 0\)/.test(transform)).toBe(true)
  })

  test('a fast flick commits on velocity even below the distance threshold', async ({ page }) => {
    await openDeck(page)
    await drag(page, 90, 0, 3) // short but fast

    await expect(stage(page)).toHaveAttribute('data-mdk-active', 'fx-rec-002', { timeout: 3000 })
    expect(await signalCount(page, 'interested')).toBe(1)
  })

  test('directional label fades in while dragging right', async ({ page }) => {
    await openDeck(page)
    const center = await cardCenter(page)
    await page.mouse.move(center.x, center.y)
    await page.mouse.down()
    await page.mouse.move(center.x + 130, center.y, { steps: 8 })

    const opacity = await page
      .locator('.mdk-overlay--interested')
      .evaluate((el) => Number(getComputedStyle(el).opacity))
    expect(opacity).toBeGreaterThan(0.5)
    await page.mouse.up()
  })

  test('upward drag opens details and preserves deck position', async ({ page }) => {
    await openDeck(page)
    await drag(page, 0, -220, 10)

    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByRole('dialog').getByText('Compensation source')).toBeVisible()
    expect(await signalCount(page, 'details_opened')).toBe(1)

    await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click()
    await expect(page.getByRole('dialog')).toBeHidden()
    expect(await activeId(page)).toBe('fx-rec-001')
  })
})

test.describe('MATCHA Deck — buttons, keyboard, undo', () => {
  test('undo restores the exact card after a button pass', async ({ page }) => {
    await openDeck(page)
    await page.getByRole('button', { name: 'Pass' }).click()
    await expect(stage(page)).toHaveAttribute('data-mdk-active', 'fx-rec-002', { timeout: 3000 })

    await page.getByRole('button', { name: 'Undo' }).click()
    await expect(stage(page)).toHaveAttribute('data-mdk-active', 'fx-rec-001', { timeout: 3000 })
    expect(await signalCount(page, 'restored')).toBe(1)
  })

  test('keyboard: arrows and letters drive the deck', async ({ page }) => {
    await openDeck(page)
    await stage(page).focus()

    await page.keyboard.press('ArrowRight')
    await expect(stage(page)).toHaveAttribute('data-mdk-active', 'fx-rec-002', { timeout: 3000 })
    expect(await signalCount(page, 'interested')).toBe(1)

    await page.keyboard.press('ArrowLeft')
    await expect(stage(page)).toHaveAttribute('data-mdk-active', 'fx-rec-003', { timeout: 3000 })
    expect(await signalCount(page, 'passed')).toBe(1)

    await page.keyboard.press('z')
    await expect(stage(page)).toHaveAttribute('data-mdk-active', 'fx-rec-002', { timeout: 3000 })

    await page.keyboard.press('Enter')
    await expect(page.getByRole('dialog')).toBeVisible()
  })
})

test.describe('MATCHA Deck — reduced motion', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } })

  test('decisions commit instantly with controls intact and no drag requirement', async ({ page }) => {
    await openDeck(page)

    await page.getByRole('button', { name: 'Interested' }).click()
    await expect(stage(page)).toHaveAttribute('data-mdk-active', 'fx-rec-002', { timeout: 1500 })

    await page.getByRole('button', { name: 'Undo' }).click()
    await expect(stage(page)).toHaveAttribute('data-mdk-active', 'fx-rec-001', { timeout: 1500 })

    // No rotation is applied to the resting card under reduced motion.
    const transform = await activeCard(page).evaluate((el) => getComputedStyle(el).transform)
    expect(transform === 'none' || /matrix\(1, 0, 0, 1, 0, 0\)/.test(transform)).toBe(true)
  })
})

test.describe('MATCHA Deck — mobile viewport', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test('one-handed layout: card visible, full action bar reachable, drag commits', async ({ page }) => {
    await openDeck(page)

    // Rails collapse; the deck and every action button remain.
    await expect(page.locator('.mdk-rail').first()).toBeHidden()
    for (const name of ['Pass', 'Details', 'Interested'] as const) {
      await expect(page.getByRole('button', { name })).toBeVisible()
    }
    await expect(page.getByRole('button', { name: 'Send feedback' })).toHaveCount(0)
    await expectNoOverlap(page)

    const { width } = await cardCenter(page)
    await drag(page, Math.min(120, width * 0.28) + 70, 0, 10)
    await expect(stage(page)).toHaveAttribute('data-mdk-active', 'fx-rec-002', { timeout: 3000 })
  })
})

for (const viewport of [
  { width: 430, height: 932, label: '430 × 932' },
  { width: 844, height: 390, label: 'landscape mobile' },
] as const) {
  test(`MATCHA Deck — ${viewport.label}: holder nav never overlaps deck actions`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await openDeck(page)
    await expectNoOverlap(page)
  })
}
