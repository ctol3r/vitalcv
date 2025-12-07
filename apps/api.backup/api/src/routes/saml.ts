import { Router } from 'express';

export const samlRouter = Router();

// NOTE: minimal placeholders; wire real passport-saml later
samlRouter.get('/metadata', (_req, res) => {
  // Enhanced metadata for enterprise onboarding demo
  res.type('application/xml').send(
    '<EntityDescriptor entityID="vitalcv-agent">' +
    '<SPSSODescriptor>' +
    '<AssertionConsumerService Location="/sso/saml/acs"/>' +
    '</SPSSODescriptor>' +
    '</EntityDescriptor>'
  );
});

samlRouter.post('/acs', (_req, res) => {
  res.redirect('/');
});

