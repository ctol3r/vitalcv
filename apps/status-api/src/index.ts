import './tracing';
import express, { Request, Response } from 'express';
import cors from 'cors';
import statusListRoutes from './routes/statusList';
import { createLogger } from '@chai-vc/logging-core';
import { requestIdMiddleware } from './middleware/requestId';

const log = createLogger({
  service: process.env.SERVICE_NAME || 'status-api',
});

const app = express();
app.use(cors());
app.use(express.json());
app.use(requestIdMiddleware());

// Status list routes
app.post('/status-list/revoke', statusListRoutes.revokeCredential);
app.get('/status-list/status/:credential_id', statusListRoutes.checkCredentialStatus);
app.get('/status-list/2021', statusListRoutes.getStatusListVC);
app.get('/status-list/2021/bitstring', statusListRoutes.getStatusListBitstring);
app.post('/status-list/restore', statusListRoutes.restoreCredential);

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'status-api' });
});

const PORT = process.env.PORT || 4003;

app.listen(PORT, () => {
  log.info('Status API listening', { port: PORT });
});

export default app;

