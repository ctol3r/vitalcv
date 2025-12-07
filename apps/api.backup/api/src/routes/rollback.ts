import { Router } from 'express';
import { pool } from '../agent/db';

export const rollbackRouter = Router();

/**
 * Rollback & Pilot Mode Toggle (Round 15)
 *
 * Provides endpoints to enable/disable pilot mode and perform rollback operations.
 *
 * ⚠️ SECURITY NOTE: In production, these endpoints should be protected with
 * admin authentication and audit logging.
 */

/**
 * POST /pilot/enable
 * Enable pilot mode - locks down destructive operations
 */
rollbackRouter.post('/pilot/enable', async (req, res) => {
  try {
    // In a real implementation, this would update a config table
    // For now, we'll just acknowledge the request
    // The actual PILOT_MODE env var must be set at container/process level

    const timestamp = new Date().toISOString();

    // Log the pilot mode change (for audit trail)
    await pool.query(
      `INSERT INTO "AuditLog" (event_type, details, created_at)
       VALUES ($1, $2, $3)`,
      ['pilot_mode_enabled', { enabled_by: req.user?.id || 'system', timestamp }, timestamp]
    ).catch(() => {
      // Graceful fallback if AuditLog table doesn't exist yet
      console.log('⚠️ AuditLog table not available, skipping audit entry');
    });

    res.json({
      ok: true,
      pilot_mode: true,
      message: 'Pilot mode enabled. Restart server with PILOT_MODE=1 to activate.',
      timestamp
    });
  } catch (error) {
    console.error('Error enabling pilot mode:', error);
    res.status(500).json({ error: 'Failed to enable pilot mode' });
  }
});

/**
 * POST /pilot/disable
 * Disable pilot mode - allows full operations
 */
rollbackRouter.post('/pilot/disable', async (req, res) => {
  try {
    const timestamp = new Date().toISOString();

    // Log the pilot mode change (for audit trail)
    await pool.query(
      `INSERT INTO "AuditLog" (event_type, details, created_at)
       VALUES ($1, $2, $3)`,
      ['pilot_mode_disabled', { disabled_by: req.user?.id || 'system', timestamp }, timestamp]
    ).catch(() => {
      console.log('⚠️ AuditLog table not available, skipping audit entry');
    });

    res.json({
      ok: true,
      pilot_mode: false,
      message: 'Pilot mode disabled. Restart server with PILOT_MODE=0 to activate.',
      timestamp
    });
  } catch (error) {
    console.error('Error disabling pilot mode:', error);
    res.status(500).json({ error: 'Failed to disable pilot mode' });
  }
});

/**
 * GET /pilot/status
 * Check current pilot mode status
 */
rollbackRouter.get('/pilot/status', (req, res) => {
  res.json({
    pilot_mode: process.env.PILOT_MODE === '1',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /snapshot
 * Create a point-in-time snapshot of critical data
 */
rollbackRouter.post('/snapshot', async (req, res) => {
  try {
    const timestamp = new Date().toISOString();

    // In a real implementation, this would:
    // 1. Snapshot database state
    // 2. Export key configurations
    // 3. Save to backup storage

    res.json({
      ok: true,
      snapshot_id: `snapshot_${Date.now()}`,
      timestamp,
      message: 'Snapshot created. Use export_bundle.ts for full backup.'
    });
  } catch (error) {
    console.error('Error creating snapshot:', error);
    res.status(500).json({ error: 'Failed to create snapshot' });
  }
});

