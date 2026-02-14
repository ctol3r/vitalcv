import cors from 'cors';
import express from 'express';
import oidc4vpRouter from './oidc4vp/routes';
import prisma from './db';

const app: express.Express = express();
if (process.env.NODE_ENV === 'production' && !process.env.API_KEYS?.trim()) {
  throw new Error('API_KEYS is required in production');
}

const corsOrigin = process.env.CORS_ORIGIN?.trim() || '*';
if (process.env.NODE_ENV === 'production' && corsOrigin === '*') {
  throw new Error('CORS_ORIGIN must not be "*" in production');
}

app.use(
  cors({
    origin: corsOrigin === '*' ? true : corsOrigin.split(',').map((value) => value.trim()),
  }),
);
app.use(express.json());

// Canonical path enforcement only.
app.use('/oidc4vp', oidc4vpRouter);

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'verifier-api' });
});

app.get('/readyz', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ready', service: 'verifier-api' });
  } catch {
    res.status(503).json({ status: 'not_ready', service: 'verifier-api' });
  }
});

const PORT = process.env.PORT || 4002;

app.listen(PORT, () => {
  console.log('Verifier API listening', { port: PORT });
});

export default app;
