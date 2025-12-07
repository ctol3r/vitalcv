import { Router, type Request, type Response } from 'express';

import {
  activateKillSwitch,
  assertKillSwitchAllows,
  deactivateKillSwitch,
  getKillSwitchState,
  KillSwitchError,
} from '../../services/security/kill-switch';

const router = Router();
const ADMIN_ROLES = new Set(['ADMIN', 'admin', 'INTERNAL_ADMIN']);

router.get('/', (_req: Request, res: Response) => {
  return res.json({ killSwitch: getKillSwitchState() });
});

router.post('/', async (req: Request, res: Response) => {
  const roles = extractRoles(req);
  if (!roles.some((role) => ADMIN_ROLES.has(role))) {
    return res.status(403).json({
      error: 'admin_only',
      message: 'Only org or internal administrators can toggle the kill switch.',
    });
  }

  const action = typeof req.body?.action === 'string' ? req.body.action : 'activate';
  const actor = resolveInitiator(req);
  const reason =
    typeof req.body?.reason === 'string' && req.body.reason.trim().length
      ? req.body.reason.trim()
      : 'security_override';

  try {
    if (action === 'deactivate') {
      const state = await deactivateKillSwitch({ initiatedBy: actor, reason });
      return res.status(200).json({ killSwitch: state });
    }

    const scopes =
      Array.isArray(req.body?.scopes) && req.body.scopes.length
        ? req.body.scopes
        : undefined;
    const ttlMinutes =
      typeof req.body?.ttlMinutes === 'number' ? req.body.ttlMinutes : undefined;

    const state = await activateKillSwitch({
      initiatedBy: actor,
      reason,
      scopes,
      ttlMinutes,
      metadata: req.body?.metadata,
    });
    return res.status(202).json({ killSwitch: state });
  } catch (error) {
    console.error('[security][kill-switch] toggle failed', error);
    return res.status(500).json({
      error: 'kill_switch_toggle_failed',
      message: error instanceof Error ? error.message : 'Unable to update kill switch',
    });
  }
});

export function enforceKillSwitch(scope: 'issuance' | 'verification', res: Response): boolean {
  try {
    assertKillSwitchAllows(scope);
    return false;
  } catch (error) {
    if (error instanceof KillSwitchError) {
      res.status(503).json({
        error: 'kill_switch_engaged',
        message: error.message,
        killSwitch: error.state,
      });
      return true;
    }
    throw error;
  }
}

function extractRoles(req: Request): string[] {
  const user = (req as Request & { user?: { roles?: string[] } }).user;
  return Array.isArray(user?.roles) ? user!.roles : [];
}

function resolveInitiator(req: Request): string {
  const user = (req as Request & { user?: { id?: string } }).user;
  if (user?.id) {
    return user.id;
  }
  const header = req.header('x-admin-actor');
  if (header) {
    return header;
  }
  return 'unknown-admin';
}

export default router;

