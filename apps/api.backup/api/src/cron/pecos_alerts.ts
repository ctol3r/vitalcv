/**
 * PECOS Alerts Cron Job
 * Runs daily to send Slack alerts for upcoming revalidations
 */

import fetch from 'node-fetch';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

async function runPECOSAlerts() {
  console.log(`[${new Date().toISOString()}] Running PECOS alerts...`);

  try {
    const response = await fetch(`${BACKEND_URL}/api/pecos/send-alerts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const result = await response.json();

    if (result.ok) {
      console.log(`✓ PECOS alerts sent: ${result.sent} alerts`);
    } else {
      console.error('✗ PECOS alerts failed:', result.error);
    }
  } catch (error) {
    console.error('✗ PECOS alerts error:', error);
  }
}

// Run immediately if called directly
if (require.main === module) {
  runPECOSAlerts().then(() => process.exit(0));
}

export { runPECOSAlerts };

