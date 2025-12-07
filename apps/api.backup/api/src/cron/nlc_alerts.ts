/**
 * NLC Residency Move Alerts Cron Job
 * Runs daily to send alerts for upcoming 60-day breach deadlines
 */

import fetch from 'node-fetch';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const SLACK_WEBHOOK = process.env.SLACK_WEBHOOK;

async function runNLCAlerts() {
  console.log(`[${new Date().toISOString()}] Running NLC alerts...`);

  try {
    const response = await fetch(`${BACKEND_URL}/api/nlc/alerts-due`);
    const result = await response.json();

    if (!result.ok) {
      console.error('✗ NLC alerts failed:', result.error);
      return;
    }

    const alerts = result.alerts || [];
    console.log(`Found ${alerts.length} NLC alerts to send`);

    for (const alert of alerts) {
      const { move, alertType } = alert;
      const message = `🚨 NLC Residency Move Alert (${alertType})
NPI: ${move.npi}
Move: ${move.fromState} → ${move.toState}
Breach Date: ${new Date(move.breachDate).toLocaleDateString()}
Action Required: Obtain new multistate license`;

      if (SLACK_WEBHOOK) {
        await fetch(SLACK_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: message }),
        });
        console.log(`✓ Sent ${alertType} alert for NPI ${move.npi}`);
      } else {
        console.log(`⚠ No Slack webhook configured, alert logged:`, message);
      }
    }

    console.log(`✓ NLC alerts complete: ${alerts.length} alerts processed`);
  } catch (error) {
    console.error('✗ NLC alerts error:', error);
  }
}

// Run immediately if called directly
if (require.main === module) {
  runNLCAlerts().then(() => process.exit(0));
}

export { runNLCAlerts };

