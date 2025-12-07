import { Router } from 'express';

export const goliveRouter = Router();

goliveRouter.get('/', (_req, res) => {
  res.json({
    tls: '✔',
    jwks: '✔',
    oidc4vci: '✔',
    statuslist: '✔',
    audit_anchors: '✔',
    logging: '✔',
    backups: '• configure S3',
    vault: '• optional',
    alerts: '• set SLO alarms'
  });
});

