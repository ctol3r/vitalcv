/**
 * Weekly Pilot Summary PDF Generator
 * Fetches /api/pilot/health + compliance leaderboard; renders PDF via Puppeteer; emails to stakeholders
 */

import puppeteer from 'puppeteer';
import fetch from 'node-fetch';

// Try to import nodemailer, but handle gracefully if not available
let nodemailer: any;
try {
  nodemailer = require('nodemailer');
} catch (e) {
  console.warn('nodemailer not available, PDF will be generated but not emailed');
}

(async () => {
  try {
    const port = process.env.PORT || 3001;
    const baseUrl = `http://localhost:${port}`;

    // Launch browser
    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();

    // Navigate to pilot health endpoint (or create a summary HTML page)
    // For now, we'll create a simple HTML summary
    const healthResponse = await fetch(`${baseUrl}/api/pilot/health`).then((r) => r.json());
    const leaderboardResponse = await fetch(`${baseUrl}/api/compliance/leaderboard`)
      .then((r) => r.json())
      .catch(() => ({ rows: [] })); // Gracefully handle if endpoint doesn't exist

    // Generate HTML summary
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Weekly Pilot Summary - ${new Date().toLocaleDateString()}</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      margin: 24px;
      max-width: 1200px;
      line-height: 1.6;
    }
    h1 {
      color: #1f2937;
      border-bottom: 3px solid #3b82f6;
      padding-bottom: 12px;
    }
    .metric {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 16px;
      margin: 12px 0;
    }
    .metric h3 {
      margin-top: 0;
      color: #374151;
    }
    .grade {
      font-size: 24px;
      font-weight: bold;
      color: #059669;
    }
  </style>
</head>
<body>
  <h1>Weekly Pilot Summary</h1>
  <p><strong>Generated:</strong> ${new Date().toISOString()}</p>

  <div class="metric">
    <h3>Executive Brief</h3>
    <p>Length: ${healthResponse.exec_length || 0} bytes</p>
  </div>

  <div class="metric">
    <h3>PSV Score</h3>
    <p>Percentage: ${healthResponse.psv_score?.pct || 0}%</p>
    <p class="grade">Grade: ${healthResponse.psv_score?.grade || 'C'}</p>
  </div>

  <div class="metric">
    <h3>AI Governance Events</h3>
    <p>Count: ${healthResponse.ai_events || 0}</p>
  </div>

  <div class="metric">
    <h3>Wallet Usage</h3>
    <p>Remote: ${healthResponse.wallet?.remote || 0}</p>
    <p>Proximity: ${healthResponse.wallet?.proximity || 0}</p>
    <p>Certified Share: ${Math.round((healthResponse.wallet?.cert_share || 0) * 100)}%</p>
  </div>

  <div class="metric">
    <h3>Compliance Leaderboard</h3>
    <p>Top performers: ${leaderboardResponse.rows?.length || 0} entries</p>
  </div>
</body>
</html>`;

    // Set content and generate PDF
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
    });

    await browser.close();

    // Send email if nodemailer is available
    if (nodemailer) {
      const transporter = nodemailer.createTransport({
        jsonTransport: true, // For testing - use real SMTP in production
      });

      await transporter.sendMail({
        to: process.env.PILOT_SUMMARY_EMAIL || 'ops@vitalcv.local',
        subject: `Weekly Pilot Summary - ${new Date().toLocaleDateString()}`,
        text: `Weekly Pilot Summary attached.`,
        attachments: [
          {
            filename: `pilot-health-${new Date().toISOString().split('T')[0]}.pdf`,
            content: pdf,
          },
        ],
      });
      console.log('Email sent to', process.env.PILOT_SUMMARY_EMAIL || 'ops@vitalcv.local');
    } else {
      console.log('PDF generated but email not sent (nodemailer not available)');
    }

    console.log('PILOT_SUMMARY_OK');
    process.exit(0);
  } catch (error: any) {
    console.error('PILOT_SUMMARY_ERROR:', error);
    process.exit(1);
  }
})();

