import pw from '@playwright/test'
const { chromium } = pw

const BASE = process.env.BASE || 'http://127.0.0.1:3311'
const REF = { 1280: [10, 1260], 1440: [10, 1420], 1512: [16, 1480], 1728: [124, 1480], 1920: [220, 1480], 2560: [540, 1480] }

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
const page = await ctx.newPage()
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 90000 })
await page.waitForSelector('.vcv-eb__shape', { timeout: 60000 })
await page.waitForTimeout(1500)

const rows = []
for (const w of Object.keys(REF).map(Number)) {
  await page.setViewportSize({ width: w, height: 900 })
  await page.waitForTimeout(300)
  const m = await page.evaluate(() => {
    const box = (sel) => {
      const el = document.querySelector(sel)
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(innerWidth - r.right) }
    }
    const instrs = [...document.querySelectorAll('.vcv-eb__instr')]
    const last = instrs.length ? instrs[instrs.length - 1].getBoundingClientRect() : null
    return {
      shape: box('.vcv-eb__shape'),
      wordmark: box('.vcv-eb__wordmark'),
      cta: box('.vcv-eb__cta-box'),
      lastInstrRight: last ? Math.round(innerWidth - last.right) : null,
    }
  })
  const [refX, refW] = REF[w]
  rows.push({
    vp: w,
    shapeX: m.shape.x, shapeW: m.shape.w, shapeRight: m.shape.right,
    refX, refW,
    matchX: m.shape.x === refX, matchW: m.shape.w === refW,
    centred: m.shape.x === m.shape.right,
    wordmarkX: m.wordmark.x, expectWordmark: refX + 20,
    clusterRight: m.lastInstrRight, expectCluster: refX + 20,
    ctaW: m.cta ? m.cta.w : null, ctaH: m.cta ? m.cta.h : null,
    shapeY: m.shape.y, shapeH: m.shape.h,
  })
}

// mobile must be untouched: full-bleed 65px band, 20px gutter
await page.setViewportSize({ width: 390, height: 844 })
await page.waitForTimeout(400)
const mobile = await page.evaluate(() => {
  const r = document.querySelector('.vcv-eb__shape').getBoundingClientRect()
  const wm = document.querySelector('.vcv-eb__wordmark').getBoundingClientRect()
  const cs = getComputedStyle(document.querySelector('.vcv-eb__shape'))
  return {
    shape: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    radius: cs.borderTopLeftRadius,
    wordmarkX: Math.round(wm.x),
    docOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }
})

await browser.close()
console.log(JSON.stringify({ rows, mobile }, null, 1))
