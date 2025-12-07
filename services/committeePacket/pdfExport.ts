import type { CommitteePacket, CommitteePacketSection, CommitteeTimelineEntry } from './types'

export interface CommitteePacketPdfOptions {
  rendererUrl?: string
  downloadName?: string
  locale?: string
  watermark?: string
}

export interface CommitteePacketPdfResult {
  buffer: Buffer
  filename: string
  contentType: 'application/pdf'
  metadata: {
    packetId: string
    generatedAt: string
    status: string
  }
}

export async function exportCommitteePacketPdf(packet: CommitteePacket, options: CommitteePacketPdfOptions = {}): Promise<CommitteePacketPdfResult> {
  const html = buildPacketHtml(packet, options)
  const filename = `${options.downloadName ?? `committee-packet-${packet.id}`}.pdf`

  const rendererUrl = options.rendererUrl ?? process.env.PDF_RENDERER_URL
  const buffer = rendererUrl ? await renderViaService(html, rendererUrl) : await renderWithOptionalChromium(html)

  return {
    buffer,
    filename,
    contentType: 'application/pdf',
    metadata: {
      packetId: packet.id,
      generatedAt: packet.generatedAt,
      status: packet.status,
    },
  }
}

async function renderViaService(html: string, url: string): Promise<Buffer> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ html }),
  })

  if (!response.ok) {
    throw new Error(`Remote PDF renderer failed with status ${response.status}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

async function renderWithOptionalChromium(html: string): Promise<Buffer> {
  const moduleName = 'playwright-core'
  try {
    // Dynamic specifier keeps TypeScript from requiring the dependency when not installed.
    const playwright: any = await import(moduleName)
    const browser = await playwright.chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    })

    try {
      const page = await browser.newPage({ deviceScaleFactor: 2 })
      await page.setContent(html, { waitUntil: 'networkidle' })
      const pdfBuffer: Buffer = await page.pdf({
        format: 'Letter',
        margin: { top: '0.6in', bottom: '0.6in', left: '0.5in', right: '0.5in' },
        printBackground: true,
      })
      await page.close()
      return pdfBuffer
    } finally {
      await browser.close()
    }
  } catch (error) {
    throw new Error('Unable to render PDF. Provide PDF_RENDERER_URL or install playwright-core.')
  }
}

function buildPacketHtml(packet: CommitteePacket, options: CommitteePacketPdfOptions) {
  const sectionsHtml = packet.sections.map(renderSection).join('')
  const timelineHtml = packet.timeline.map(renderTimelineEvent).join('')
  const aiSummaryHtml = packet.aiSummary
    ? `
      <section class="section">
        <div class="section__header">
          <h2>AI Summary</h2>
          <p class="subtitle">Generated ${new Date(packet.aiSummary.updatedAt).toLocaleString(options.locale)}</p>
        </div>
        ${packet.aiSummary.sections
          .map(
            (section) => `
              <div class="card card--narrative">
                <div class="card__header">
                  <h3>${escapeHtml(section.title)}</h3>
                  <span class="pill pill--${section.sentiment ?? 'neutral'}">${section.sentiment ?? 'neutral'}</span>
                </div>
                <p>${escapeHtml(section.summary)}</p>
                <ul>
                  ${section.bulletPoints.map((point) => `<li>${escapeHtml(point)}</li>`).join('')}
                </ul>
              </div>
            `,
          )
          .join('')}
      </section>
    `
    : ''

  const watermark = options.watermark
    ? `<div class="watermark">${escapeHtml(options.watermark)}</div>`
    : ''

  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>Committee Packet • ${escapeHtml(packet.clinicianName)}</title>
        <style>
          :root {
            color-scheme: light;
            font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
          }
          body {
            margin: 0;
            padding: 32px;
            font-size: 12px;
            background: #f9fafb;
            color: #0f172a;
          }
          header {
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 16px;
            margin-bottom: 24px;
          }
          h1 {
            font-size: 24px;
            margin: 0;
          }
          .subtitle {
            color: #64748b;
            margin: 4px 0 0;
            font-size: 12px;
          }
          .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 12px;
          }
          .pill {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            border-radius: 999px;
            font-size: 11px;
            padding: 2px 10px;
            text-transform: uppercase;
            letter-spacing: 0.06em;
          }
          .pill--neutral { background: #e2e8f0; color: #334155; }
          .pill--positive { background: #dcfce7; color: #166534; }
          .pill--warning { background: #fef3c7; color: #92400e; }
          .pill--critical { background: #fee2e2; color: #991b1b; }
          .section {
            margin-bottom: 28px;
            page-break-inside: avoid;
          }
          .section__header {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            margin-bottom: 8px;
          }
          .card {
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 14px;
            background: #fff;
            margin-bottom: 12px;
          }
          .card__header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 6px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
            margin-top: 8px;
          }
          th {
            text-align: left;
            font-weight: 600;
            border-bottom: 1px solid #e2e8f0;
            padding: 6px 4px;
            color: #475569;
          }
          td {
            padding: 6px 4px;
            border-bottom: 1px solid #f1f5f9;
          }
          ul {
            padding-left: 16px;
            margin: 6px 0;
          }
          .timeline {
            position: relative;
            padding-left: 20px;
          }
          .timeline::before {
            content: '';
            position: absolute;
            left: 7px;
            top: 0;
            bottom: 0;
            width: 2px;
            background: #e2e8f0;
          }
          .timeline__item {
            position: relative;
            margin-bottom: 14px;
          }
          .timeline__item::before {
            content: '';
            position: absolute;
            left: -14px;
            top: 4px;
            width: 8px;
            height: 8px;
            border-radius: 999px;
            background: #0ea5e9;
          }
          .timeline__item--warning::before { background: #f59e0b; }
          .timeline__item--risk::before { background: #dc2626; }
          .watermark {
            position: fixed;
            inset: 0;
            font-size: 90px;
            color: rgba(226, 232, 240, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            transform: rotate(-30deg);
            pointer-events: none;
          }
        </style>
      </head>
      <body>
        ${watermark}
        <header>
          <h1>${escapeHtml(packet.clinicianName)}</h1>
          <p class="subtitle">
            Packet ${escapeHtml(packet.credentialId)} • ${escapeHtml(packet.facility)} • Generated
            ${new Date(packet.generatedAt).toLocaleString(options.locale)}
          </p>
          <div class="pill pill--neutral">Status ${escapeHtml(packet.status)}</div>
        </header>
        <section class="section">
          <div class="section__header">
            <h2>Timeline</h2>
          </div>
          <div class="timeline">
            ${timelineHtml}
          </div>
        </section>
        ${sectionsHtml}
        ${aiSummaryHtml}
      </body>
    </html>
  `
}

function renderSection(section: CommitteePacketSection) {
  const fieldsHtml = section.fields
    ? `
      <div class="grid">
        ${section.fields
          .map(
            (field) => `
              <div class="card">
                <p class="subtitle">${escapeHtml(field.label)}</p>
                <p><strong>${escapeHtml(field.value)}</strong></p>
                ${field.detail ? `<p>${escapeHtml(field.detail)}</p>` : ''}
              </div>
            `,
          )
          .join('')}
      </div>
    `
    : ''

  const tableHtml = section.table
    ? `
      <table>
        <thead>
          <tr>${section.table.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${section.table.rows.map((row) => `<tr>${row.map((value) => `<td>${escapeHtml(value)}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
      ${section.table.caption ? `<p class="subtitle">${escapeHtml(section.table.caption)}</p>` : ''}
    `
    : ''

  const notesHtml = section.notes
    ? `<ul>${section.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join('')}</ul>`
    : ''

  const risksHtml = section.risks
    ? `
      <div class="grid">
        ${section.risks
          .map(
            (risk) => `
              <div class="card" style="border-color:#fecdd3;background:#fff1f2">
                <div class="card__header">
                  <h3>${escapeHtml(risk.label)}</h3>
                  <span class="pill pill--${risk.severity === 'high' ? 'critical' : 'warning'}">${escapeHtml(risk.severity)}</span>
                </div>
                <p>${escapeHtml(risk.recommendation)}</p>
                <p class="subtitle">Owner: ${escapeHtml(risk.owner)}</p>
              </div>
            `,
          )
          .join('')}
      </div>
    `
    : ''

  return `
    <section class="section">
      <div class="section__header">
        <h2>${escapeHtml(section.title)}</h2>
        <p class="subtitle">${escapeHtml(section.summary)}</p>
      </div>
      ${fieldsHtml}
      ${tableHtml}
      ${notesHtml}
      ${risksHtml}
    </section>
  `
}

function renderTimelineEvent(event: CommitteeTimelineEntry) {
  const toneClass = event.tone ? `timeline__item--${event.tone}` : ''
  return `
    <div class="timeline__item ${toneClass}">
      <p><strong>${escapeHtml(event.title)}</strong></p>
      <p class="subtitle">${new Date(event.occurredAt).toLocaleString()}</p>
      <p>${escapeHtml(event.description)}</p>
    </div>
  `
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}


