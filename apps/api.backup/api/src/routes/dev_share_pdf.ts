/**
 * Batch 62: Share Preview → PDF Export
 * Renders the share-report.html as a downloadable PDF
 */

import { Router } from 'express';
import puppeteer from 'puppeteer';

export const sharePdf = Router();

sharePdf.get('/api/dev/share-report.pdf', async (_req, res) => {
  try {
    const url = `http://localhost:${process.env.PORT || 3001}/api/dev/share-report.html`;

    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: true
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      printBackground: true,
      format: 'A4'
    });

    await browser.close();

    res.type('application/pdf').send(pdf);
  } catch (error: any) {
    console.error('PDF generation error:', error);
    res.status(500).json({ ok: false, error: error.message || 'PDF generation failed' });
  }
});

