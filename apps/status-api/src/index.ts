import cors from 'cors';
import express, { Request, Response, type Express } from 'express';
import statusListRoutes from './routes/statusList';

const app: Express = express();
app.use(cors());
app.use(express.json());

// W3C VC 2.0 Bitstring Status List routes (launch blocker #11).
// The StatusList2021-era /status-list/2021* routes were removed with the
// Bitstring port — the service was never deployed and has no live consumer.
app.post('/status-list/revoke', statusListRoutes.revokeCredential);
app.post('/status-list/restore', statusListRoutes.restoreCredential);
app.get('/status-list/status/:credential_id', statusListRoutes.checkCredentialStatus);
app.get('/status-list/entry/:credential_id', statusListRoutes.getStatusListEntry);
app.get('/status-list/bitstring', statusListRoutes.getStatusListVC);
app.get('/status-list/summary', statusListRoutes.getStatusListSummary);

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'status-api' });
});

const PORT = process.env.PORT || 4003;

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT);
}

export default app;
