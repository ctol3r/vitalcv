import { Router } from 'express';
import { pool } from '../db';

export const win = Router();

const SOURCES = ['license', 'board', 'dea', 'npdb', 'oig', 'caqh', 'pecos'];

interface WindowCheck {
  ok: boolean;
  days: number;
}

function isWithinWindow(date: Date | null, isCVO = false): WindowCheck {
  if (!date) {
    return { ok: false, days: Number.POSITIVE_INFINITY };
  }

  const days = (Date.now() - date.getTime()) / 86400000;
  const maxDays = isCVO ? 90 : 120;

  return {
    ok: days <= maxDays,
    days: Math.floor(days)
  };
}

win.get('/api/compliance/windows', async (req, res) => {
  try {
    const npi = (req.query.npi || '').toString();

    if (!npi) {
      return res.status(400).json({ error: 'NPI required' });
    }

    const sourceData: any = {};
    let overdueCount = 0;

    for (const source of SOURCES) {
      const query = await pool.query(
        `SELECT pulled_at, method FROM "VerificationEvent"
         WHERE subject_npi = $1 AND source_name LIKE $2
         ORDER BY pulled_at DESC LIMIT 1`,
        [npi, `${source}%`]
      );

      const row = query.rows[0];
      const pulledAt = row ? new Date(row.pulled_at) : null;
      const isCVO = row?.method === 'CVO';

      const windowCheck = isWithinWindow(pulledAt, isCVO);

      if (!windowCheck.ok) {
        overdueCount++;
      }

      sourceData[source] = {
        latest_at: row?.pulled_at || null,
        method: row?.method || null,
        ok: windowCheck.ok,
        days_since: isFinite(windowCheck.days) ? windowCheck.days : null
      };
    }

    res.json({
      sources: sourceData,
      summary: {
        total: SOURCES.length,
        overdue: overdueCount
      }
    });
  } catch (error) {
    console.error('Compliance windows error:', error);
    res.status(500).json({ error: 'Failed to fetch compliance windows' });
  }
});
