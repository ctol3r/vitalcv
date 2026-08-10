import pw from '@playwright/test'
const { chromium } = pw

const WIDTHS = [1280, 1440, 1512, 1728, 1920, 2560]

function paintProbe() {
  // returns every element near the top that PAINTS a surface (bg / backdrop / border)
  const out = []
  for (const el of document.querySelectorAll('header, header *, [class*=header i], [class*=Header]')) {
    const r = el.getBoundingClientRect()
    if (r.top > 200 || r.width < 100) continue
    const cs = getComputedStyle(el)
    const paints =
      cs.backdropFilter !== 'none' ||
      (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent') ||
      cs.mixBlendMode !== 'normal'
    if (!paints) continue
    out.push({
      tag: el.tagName.toLowerCase(),
      cls: (el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className) || '',
      x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
      radius: cs.borderRadius,
      bg: cs.backgroundColor,
      backdrop: cs.backdropFilter,
      blend: cs.mixBlendMode,
      maxWidth: cs.maxWidth,
      inset: `${cs.left} / ${cs.right}`,
      position: cs.position,
    })
  }
  return out
}

function instrumentProbe(sel) {
  const els = [...document.querySelectorAll(sel)]
  return els.map((el) => {
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    return {
      text: (el.innerText || '').trim().slice(0, 24),
      x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
      right: Math.round(window.innerWidth - r.right),
      radius: cs.borderRadius, fontSize: cs.fontSize, padding: cs.padding,
    }
  })
}

const results = {}
const browser = await chromium.launch()

for (const target of [
  { name: 'palantir', url: 'https://www.palantir.com/', sel: 'header a, header button' },
  { name: 'vitalcv', url: 'https://www.vitalcv.com/', sel: '.vcv-eb a, .vcv-eb button' },
]) {
  results[target.name] = {}
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  await page.goto(target.url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
  // kill consent banner rather than accepting it
  await page.evaluate(() => {
    document.querySelector('#onetrust-consent-sdk')?.remove()
    document.querySelector('#onetrust-banner-sdk')?.remove()
  })
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: 900 })
    await page.waitForTimeout(400)
    results[target.name][w] = {
      viewport: w,
      painted: await page.evaluate(paintProbe),
      instruments: await page.evaluate(instrumentProbe, target.sel),
    }
  }
  await ctx.close()
}

await browser.close()
console.log(JSON.stringify(results, null, 1))
