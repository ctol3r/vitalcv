import { Router } from 'express';

export const oidcEnt = Router();

oidcEnt.get('/sso/oidc/metadata', (_req, res) =>
  res.json({
    issuer: 'https://idp.example',
    client_id: 'vitalcv',
    redirect_uri: '/sso/oidc/cb'
  })
);

oidcEnt.get('/sso/oidc/cb', (_req, res) =>
  res.redirect('/')
);

