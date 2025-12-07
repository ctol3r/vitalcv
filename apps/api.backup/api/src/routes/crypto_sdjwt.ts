import { Router } from 'express';
import * as SD from '@sd-jwt/sd-jwt-vc';
import { requireFeature } from '../middleware/feature_enforce';

export const sdjwtRouter = Router();

sdjwtRouter.post('/issue', requireFeature('sdjwt'), async (req, res) => {
  const { claims, issuer } = req.body || {};
  const sd = await SD.issue({
    claims,
    issuer: issuer || { kid: 'did:web:vitalcv', alg: 'ES256' }
  });
  return res.json(sd);
});

sdjwtRouter.post('/present', requireFeature('sdjwt'), async (req, res) => {
  const { sd_jwt, disclose } = req.body || {};
  const p = await SD.present({ sdJwt: sd_jwt, disclose });
  return res.json(p);
});

sdjwtRouter.post('/verify', requireFeature('sdjwt'), async (req, res) => {
  const { presentation } = req.body || {};
  const vr = await SD.verify({ presentation });
  return res.json(vr);
});

