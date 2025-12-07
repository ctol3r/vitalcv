import { Router } from 'express';
import axios from 'axios';

export const demoRouter = Router();

demoRouter.post('/run', async (req, res) => {
  const base = process.env.PUBLIC_ISSUER_URL || '';
  const subject = req.body?.subjectDid || 'did:key:zDemo';

  const offer = await axios.post(base + '/api/oidc4vci/offer', {
    subjectDid: subject,
    type: 'MedicalLicense'
  });

  const pre = offer.data.pre_authorized_code;

  const tok = await axios.post(base + '/api/oidc4vci/token', {
    'grant_type': 'urn:ietf:params:oauth:grant-type:pre-authorized_code',
    'pre-authorized_code': pre
  });

  const cred = await axios.post(base + '/api/oidc4vci/credential', {
    access_token: tok.data.access_token,
    subjectDid: subject
  });

  return res.json({
    offer: offer.data,
    token: tok.data,
    credential: cred.data
  });
});

