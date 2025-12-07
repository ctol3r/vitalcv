import { Router } from 'express';

export const bhVC = Router();

bhVC.get('/api/behavioral/vc-preview', (req, res) => {
  const npi = (req.query.npi || '').toString();
  res.json({
    PsypactEligibilityCredential: {
      subject: npi,
      apit: true,
      epassport: 'DEMO'
    },
    CounselingPrivilegeCredential: {
      subject: npi,
      privilege: true,
      states: ['CA', 'FL']
    }
  });
});


