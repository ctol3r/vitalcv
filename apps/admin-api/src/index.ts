import cors from 'cors';
import express, { Request, Response, type Express } from 'express';
import { policyRouter } from './auth/policy-routes';
import { authRouter } from './auth/routes';

const app: Express = express();
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'admin-api' });
});

// Auth routes (WebAuthn enrollment, authentication)
app.use('/api/auth', authRouter);

// Policy routes (AAL policy management)
app.use('/api/auth/policy', policyRouter);

const PORT = process.env.PORT || 4003;

app.listen(PORT);

export default app;
