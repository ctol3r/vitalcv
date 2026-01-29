import express, { Request, Response } from 'express';
import cors from 'cors';
import { authRouter } from './auth/routes';
import { policyRouter } from './auth/policy-routes';

const app = express();
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

