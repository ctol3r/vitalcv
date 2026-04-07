import type { TrustPassport } from '../entity/passportService';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatValue(value: string | number | null | undefined): string {
  if (value === null || typeof value === 'undefined') {
    return 'Unavailable';
  }
  return escapeHtml(String(value));
}

function renderList(items: readonly string[], emptyLabel: string): string {
  if (items.length === 0) {
    return `<p class="empty">${escapeHtml(emptyLabel)}</p>`;
  }

  return [
    '<ul>',
    ...items.map((item) => `<li>${escapeHtml(item)}</li>`),
    '</ul>',
  ].join('');
}

function renderCredentialRows(passport: TrustPassport): string {
  const credentials = passport.authority.credentials.slice(0, 12);
  if (credentials.length === 0) {
    return '<p class="empty">No authority credentials attached yet.</p>';
  }

  return [
    '<table>',
    '<thead><tr><th>Domain</th><th>Type</th><th>Status</th><th>Source</th><th>Verified</th></tr></thead>',
    '<tbody>',
    ...credentials.map((credential) => [
      '<tr>',
      `<td>${formatValue(credential.domain)}</td>`,
      `<td>${formatValue(credential.label ?? credential.type)}</td>`,
      `<td>${formatValue(credential.statusLabel ?? credential.status)}</td>`,
      `<td>${formatValue(credential.issuerName ?? credential.sourceId ?? 'Unknown')}</td>`,
      `<td>${formatValue(credential.verifiedAt ?? credential.observedAt ?? 'Unavailable')}</td>`,
      '</tr>',
    ].join('')),
    '</tbody>',
    '</table>',
  ].join('');
}

function renderSourceCoverageRows(passport: TrustPassport): string {
  const checks = passport.sourceCoverage?.checks ?? [];
  if (checks.length === 0) {
    return '<p class="empty">No source coverage available.</p>';
  }

  return [
    '<table>',
    '<thead><tr><th>Source</th><th>State</th><th>Checked</th><th>Reason</th></tr></thead>',
    '<tbody>',
    ...checks.map((check) => [
      '<tr>',
      `<td>${formatValue(check.sourceId)}</td>`,
      `<td>${formatValue(check.state)}</td>`,
      `<td>${formatValue(check.checkedAt ?? 'Unavailable')}</td>`,
      `<td>${formatValue(check.reason)}</td>`,
      '</tr>',
    ].join('')),
    '</tbody>',
    '</table>',
  ].join('');
}

function buildPassportPdfHtml(passport: TrustPassport): string {
  const displayName = passport.identity.displayName || `Clinician ${passport.identity.npi ?? passport.entityId}`;
  const estimatedStartDays =
    passport.readiness.estimatedStartDays === null
      ? 'Blocked'
      : `${passport.readiness.estimatedStartDays} day${passport.readiness.estimatedStartDays === 1 ? '' : 's'}`;

  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8" />',
    '<title>VitalCV Passport</title>',
    '<style>',
    'body { font-family: "Helvetica Neue", Arial, sans-serif; color: #0f172a; margin: 0; background: #f8fafc; }',
    '.page { padding: 40px 44px 56px; }',
    '.hero { background: linear-gradient(135deg, #0f172a, #1e293b); color: #f8fafc; border-radius: 24px; padding: 28px 32px; }',
    '.eyebrow { font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; opacity: 0.72; margin: 0 0 8px; }',
    'h1 { margin: 0; font-size: 30px; line-height: 1.15; }',
    '.meta { margin-top: 10px; font-size: 13px; opacity: 0.82; }',
    '.metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-top: 18px; }',
    '.metric { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); border-radius: 18px; padding: 14px 16px; }',
    '.metric-label { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.7; }',
    '.metric-value { font-size: 24px; font-weight: 700; margin-top: 6px; }',
    '.grid { display: grid; grid-template-columns: 1.3fr 1fr; gap: 18px; margin-top: 22px; }',
    '.card { background: #ffffff; border-radius: 20px; padding: 22px 24px; box-shadow: 0 10px 35px rgba(15, 23, 42, 0.07); }',
    '.card h2 { margin: 0 0 14px; font-size: 18px; }',
    '.kv { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 16px; }',
    '.kv-item { border-top: 1px solid #e2e8f0; padding-top: 10px; }',
    '.kv-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; }',
    '.kv-value { font-size: 14px; margin-top: 4px; color: #0f172a; }',
    'table { width: 100%; border-collapse: collapse; font-size: 13px; }',
    'th, td { text-align: left; padding: 10px 0; border-bottom: 1px solid #e2e8f0; vertical-align: top; }',
    'th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; }',
    'ul { margin: 0; padding-left: 18px; }',
    'li { margin-bottom: 8px; }',
    '.empty { color: #64748b; font-size: 13px; margin: 0; }',
    '.section { margin-top: 18px; }',
    '.footer { margin-top: 24px; font-size: 12px; color: #64748b; }',
    '</style>',
    '</head>',
    '<body>',
    '<main class="page">',
    '<section class="hero">',
    '<p class="eyebrow">VitalCV Passport</p>',
    `<h1>${escapeHtml(displayName)}</h1>`,
    `<p class="meta">NPI: ${formatValue(passport.identity.npi ?? passport.npi ?? 'Unavailable')} · Entity: ${formatValue(passport.identity.entityType)} · Last checked: ${formatValue(passport.lastCheckedAt)}</p>`,
    '<div class="metrics">',
    `<div class="metric"><div class="metric-label">CRS</div><div class="metric-value">${formatValue(passport.readiness.score)}</div></div>`,
    `<div class="metric"><div class="metric-label">Readiness</div><div class="metric-value">${formatValue(passport.readiness.status)}</div></div>`,
    `<div class="metric"><div class="metric-label">Trust Band</div><div class="metric-value">${formatValue(passport.trustPosture.bandLabel)}</div></div>`,
    `<div class="metric"><div class="metric-label">Time To Start</div><div class="metric-value">${escapeHtml(estimatedStartDays)}</div></div>`,
    '</div>',
    '</section>',
    '<section class="grid">',
    '<article class="card">',
    '<h2>Identity And Standing</h2>',
    '<div class="kv">',
    `<div class="kv-item"><div class="kv-label">Specialty</div><div class="kv-value">${formatValue(passport.identity.specialty ?? 'Unavailable')}</div></div>`,
    `<div class="kv-item"><div class="kv-label">Identity Status</div><div class="kv-value">${formatValue(passport.identity.status)}</div></div>`,
    `<div class="kv-item"><div class="kv-label">Exclusion</div><div class="kv-value">${formatValue(passport.standing.exclusionStatus)}</div></div>`,
    `<div class="kv-item"><div class="kv-label">Licensure</div><div class="kv-value">${formatValue(passport.standing.licensureStatus)}</div></div>`,
    `<div class="kv-item"><div class="kv-label">PECOS</div><div class="kv-value">${formatValue(passport.standing.pecosEnrollmentStatus)}</div></div>`,
    `<div class="kv-item"><div class="kv-label">DEA</div><div class="kv-value">${formatValue(passport.standing.deaStatus)}</div></div>`,
    '</div>',
    '<div class="section">',
    '<h2>Authority Evidence</h2>',
    renderCredentialRows(passport),
    '</div>',
    '</article>',
    '<aside class="card">',
    '<h2>Decision Summary</h2>',
    renderList(passport.trustPosture.safeToRelyOnNow, 'No immediately safe trust signals were available.'),
    '<div class="section">',
    '<h2>Blockers</h2>',
    renderList(passport.readiness.blockers, 'No blockers present.'),
    '</div>',
    '<div class="section">',
    '<h2>Next Actions</h2>',
    renderList(passport.readiness.nextActions.map((action) => `${action.title}: ${action.detail}`), 'No next actions were recommended.'),
    '</div>',
    '</aside>',
    '</section>',
    '<section class="card section">',
    '<h2>Source Coverage</h2>',
    renderSourceCoverageRows(passport),
    '</section>',
    '<p class="footer">Source-backed credentialing export generated by VitalCV. This PDF is a rendered snapshot of the current passport state and should be paired with the live passport for freshness-sensitive decisions.</p>',
    '</main>',
    '</body>',
    '</html>',
  ].join('');
}

export async function renderPassportPdf(passport: TrustPassport): Promise<Buffer> {
  // Dynamic import — playwright-chromium is an optional runtime dependency for PDF rendering.
  // If not installed, this will throw at runtime (not at build time).
  const { chromium } = await import('playwright-chromium');
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-dev-shm-usage', '--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(buildPassportPdfHtml(passport), { waitUntil: 'load' });
    await page.emulateMedia({ media: 'screen' });
    const pdf = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: {
        top: '16px',
        right: '16px',
        bottom: '16px',
        left: '16px',
      },
      preferCSSPageSize: true,
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
