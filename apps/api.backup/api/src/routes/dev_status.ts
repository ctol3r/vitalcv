import { Router } from 'express';
import { getVersion } from '../util/version';

export const devStatus = Router();

devStatus.get('/dev/status', (_req, res) => {
  res.json({
    ok: true,
    version: getVersion(),
    services: ['agent', 'compacts', 'telehealth', 'playbook', 'audit']
  });
});

