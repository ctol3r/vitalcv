import fetch from 'node-fetch';
import { pool } from '../db';

export async function slackAlert(payload: any) {
  try {
    const f = await pool.query('SELECT value FROM "RuntimeFlag" WHERE key=$1', ['streams.slack']);
    if (f.rows[0]?.value !== true) return;
    const url = process.env.SLACK_WEBHOOK;
    if (!url) return;
    await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        text: '[VitalCV] ' + (payload?.type || 'alert') + ' ' + JSON.stringify(payload),
      }),
    });
  } catch {}
}

