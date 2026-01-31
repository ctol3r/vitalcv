import cors from 'cors';
import express, { Request, Response, type Express } from 'express';
import statusListRoutes from './routes/statusList';

const app: Express = express();
app.use(cors());
app.use(express.json());

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

app.listen(PORT);

export default app;
