// Prove the overflow guard + its diagnostic by INJECTING the bug it claims to
// catch: restore the bare `1fr` track (whose automatic minimum is min-content)
// and put an over-wide child in the hero column — the exact shape of the CI
// failure. Run from apps/web against the server on :3311.
import { chromium } from '@playwright/test';

const measure = async (page, width) =>
  page.evaluate((vw) => {
    const el = document.querySelector('#ezh-npi');
    const r = el.getBoundingClientRect();
    const rows = [];
    for (let node = el; node; node = node.parentElement) {
      const b = node.getBoundingClientRect();
      const cs = getComputedStyle(node);
      rows.push(
        `${node.tagName.toLowerCase()}${node.id ? '#' + node.id : ''}` +
          `${node.classList.length ? '.' + [...node.classList].join('.') : ''}`.slice(0, 48) +
          ` x=${b.x.toFixed(1)} w=${b.width.toFixed(1)} right=${(b.x + b.width).toFixed(1)}` +
          ` cols=${cs.gridTemplateColumns}`,
      );
      if (node.tagName === 'HTML') break;
    }
    return { right: r.x + r.width, overflows: r.x + r.width > vw + 1, rows };
  }, width);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.route('**/api/opportunities?*', (r) =>
  r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ total: 0, opportunities: [] }) }),
);
await page.goto('http://127.0.0.1:3311/', { waitUntil: 'networkidle' });

const clean = await measure(page, 390);
console.log(`FIXED build      → #ezh-npi right=${clean.right.toFixed(1)} overflows=${clean.overflows}`);

// Inject the bug: bare 1fr track + a child wider than the viewport.
await page.addStyleTag({
  content: `.ezh-hero-grid { grid-template-columns: 1fr !important; }
            .ezh .ezh-hero-copy { min-width: auto !important; }`,
});
await page.evaluate(() => {
  const probe = document.createElement('div');
  probe.textContent = 'X'.repeat(60);
  probe.style.cssText = 'white-space:nowrap;font-size:20px;';
  document.querySelector('.ezh-hero-copy')?.appendChild(probe);
});
await page.waitForTimeout(150);

const broken = await measure(page, 390);
console.log(`BUG injected     → #ezh-npi right=${broken.right.toFixed(1)} overflows=${broken.overflows}`);
console.log('  ancestor chain the diagnostic would print:');
for (const r of broken.rows.slice(0, 6)) console.log('    ' + r);

console.log(
  `\nGUARD PROOF: ${!clean.overflows && broken.overflows ? 'PASS — clean build inside the viewport, injected bug caught' : 'FAIL — guard did not discriminate'}`,
);
await browser.close();
