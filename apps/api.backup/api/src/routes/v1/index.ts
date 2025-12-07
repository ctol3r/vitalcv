/**
 * B143D-REL-002: API v1 Routes
 *
 * Explicit API versioning for critical routes.
 * All routes under /api/v1/* are versioned.
 * Legacy unversioned routes remain for transition but are marked deprecated.
 */

import express, { Router, Request, Response } from 'express';
import ehrRouter from '../ehr/fhirProxy';
import payerRouter from '../payer/list';
import privilegesRequestRouter from '../privileges/request';
import privilegesReviewRouter from '../privileges/review';

const router = Router();

// B143D-REL-002: v1 Issuer routes (proxy to issuer-api)
// Note: Issuer API is in apps/issuer-api (separate service on port 4001)
// These routes provide a unified API gateway experience
router.get('/issuer/*', async (req: Request, res: Response) => {
  const issuerApiUrl = process.env.ISSUER_API_URL || 'http://localhost:4001';
  const targetPath = req.path.replace('/issuer', '');

  // Proxy request to issuer-api
  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(`${issuerApiUrl}${targetPath}${req.url.split('?')[1] ? '?' + req.url.split('?')[1] : ''}`, {
      method: req.method,
      headers: {
        ...req.headers as any,
        host: undefined, // Remove host header for proxying
      },
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
    });

    const data = await response.text();
    res.status(response.status).set(response.headers.raw()).send(data);
  } catch (error) {
    console.error('Error proxying to issuer-api:', error);
    res.status(502).json({
      error: 'BadGateway',
      message: 'Failed to proxy request to issuer API',
    });
  }
});

router.post('/issuer/*', async (req: Request, res: Response) => {
  const issuerApiUrl = process.env.ISSUER_API_URL || 'http://localhost:4001';
  const targetPath = req.path.replace('/issuer', '');

  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(`${issuerApiUrl}${targetPath}${req.url.split('?')[1] ? '?' + req.url.split('?')[1] : ''}`, {
      method: req.method,
      headers: {
        ...req.headers as any,
        host: undefined,
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.text();
    res.status(response.status).set(response.headers.raw()).send(data);
  } catch (error) {
    console.error('Error proxying to issuer-api:', error);
    res.status(502).json({
      error: 'BadGateway',
      message: 'Failed to proxy request to issuer API',
    });
  }
});

// B143D-REL-002: v1 Verifier routes (proxy to verifier-api)
// Note: Verifier API is in apps/verifier-api (separate service on port 4002)
router.get('/verifier/*', async (req: Request, res: Response) => {
  const verifierApiUrl = process.env.VERIFIER_API_URL || 'http://localhost:4002';
  const targetPath = req.path.replace('/verifier', '');

  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(`${verifierApiUrl}${targetPath}${req.url.split('?')[1] ? '?' + req.url.split('?')[1] : ''}`, {
      method: req.method,
      headers: {
        ...req.headers as any,
        host: undefined,
      },
    });

    const data = await response.text();
    res.status(response.status).set(response.headers.raw()).send(data);
  } catch (error) {
    console.error('Error proxying to verifier-api:', error);
    res.status(502).json({
      error: 'BadGateway',
      message: 'Failed to proxy request to verifier API',
    });
  }
});

router.post('/verifier/*', async (req: Request, res: Response) => {
  const verifierApiUrl = process.env.VERIFIER_API_URL || 'http://localhost:4002';
  const targetPath = req.path.replace('/verifier', '');

  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(`${verifierApiUrl}${targetPath}${req.url.split('?')[1] ? '?' + req.url.split('?')[1] : ''}`, {
      method: req.method,
      headers: {
        ...req.headers as any,
        host: undefined,
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.text();
    res.status(response.status).set(response.headers.raw()).send(data);
  } catch (error) {
    console.error('Error proxying to verifier-api:', error);
    res.status(502).json({
      error: 'BadGateway',
      message: 'Failed to proxy request to verifier API',
    });
  }
});

// B143D-REL-002: v1 Payer routes
router.use('/payer', payerRouter);

// B143D-REL-002: v1 EHR routes
router.use('/ehr', ehrRouter);

// B143D-REL-002: v1 Privileges routes
router.use('/privileges', privilegesRequestRouter);
router.use('/privileges', privilegesReviewRouter);

export default router;

