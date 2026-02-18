import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { isSigningKeyConfigured } from './services/signingKeyProvider';
import internalRoutes from './routes/internal';
import metadataRouter from './routes/oidc4vci/metadata';
import didRoutes from './routes/did';
import walletRoutes from './routes/wallet';
import oidc4vciRoutes from './routes/oidc4vci/credential';

const app: ReturnType<typeof express> = express();

if (process.env.NODE_ENV === 'production' && !isSigningKeyConfigured()) {
  throw new Error('Production requires ISSUER_SIGNING_JWK or SIGNING_KEY_JWK configuration.');
}

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// OIDC4VCI metadata and discovery
app.use(metadataRouter);
app.use('/oidc4vci', oidc4vciRoutes);
app.use('/api/oid4vci', oidc4vciRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/internal', internalRoutes);
app.use(didRoutes);

app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'issuer-api',
  });
});

app.get('/readyz', (_req, res) => {
  res.status(200).json({
    status: isSigningKeyConfigured() ? 'ready' : 'starting',
    service: 'issuer-api',
  });
});

const PORT = process.env.PORT || 4001;

app.listen(PORT, () => {
  console.log('Issuer API listening', { port: PORT });
});

export default app;
