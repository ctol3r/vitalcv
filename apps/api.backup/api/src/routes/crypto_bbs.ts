import { Router } from 'express';
import { generateBls12381G2KeyPair, blsSign, blsVerify } from '@mattrglobal/bbs-signatures';
import { requireFeature } from '../middleware/feature_enforce';

export const bbsRouter = Router();

// NOTE: minimal POC; production will use VC libs that wrap BBS+
let _kp: any;

async function kp() {
  if (_kp) return _kp;
  _kp = await generateBls12381G2KeyPair();
  return _kp;
}

bbsRouter.post('/issue', requireFeature('bbs'), async (req, res) => {
  const { claims } = req.body || {};
  const pair = await kp();
  const msg = Buffer.from(JSON.stringify(claims || {}));
  const sig = await blsSign({ keyPair: pair, message: msg });
  return res.json({ vc_bbs: sig, pub: pair.publicKey });
});

bbsRouter.post('/present', requireFeature('bbs'), async (req, res) => {
  const { vc_bbs, reveal } = req.body || {};
  return res.json({ presentation: { vc_bbs, reveal } });
});

bbsRouter.post('/verify', requireFeature('bbs'), async (req, res) => {
  const { presentation, pub } = req.body || {};
  const ok = await blsVerify({
    publicKey: pub,
    message: Buffer.from(JSON.stringify(presentation?.reveal || {})),
    signature: presentation?.vc_bbs
  });
  return res.json({ ok });
});

