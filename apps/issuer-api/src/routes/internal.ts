import { Request, Response, Router } from 'express';
import { getHaipComplianceSnapshot } from '../services/haipPolicy';

const router: Router = Router();

function getMonitoringSecret(): string {
  return process.env.MONITORING_SECRET?.trim() ?? '';
}

function extractInternalSecret(req: Request): string {
  const value = req.get('x-monitoring-secret');
  if (typeof value === 'string') {
    return value.trim();
  }
  return '';
}

function requireInternalSecret(req: Request, res: Response): boolean {
  const expected = getMonitoringSecret();
  const provided = extractInternalSecret(req);
  if (!expected || !provided || expected !== provided) {
    res.status(403).json({ error: 'Forbidden' });
    return false;
  }
  return true;
}

router.get('/haip-status', (req: Request, res: Response): void => {
  if (!requireInternalSecret(req, res)) {
    return;
  }

  const snapshot = getHaipComplianceSnapshot();
  res.json({
    signingAlg: snapshot.signingAlg,
    pkceRequired: snapshot.pkceRequired,
    nonceStrict: snapshot.nonceStrict,
    downgradeProtection: snapshot.downgradeProtection,
    compliant: snapshot.compliant,
  });
});

export default router;
