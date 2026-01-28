import cors from 'cors';
import express from 'express';
import oidc4vpRouter from './oidc4vp/routes';

const app: express.Express = express();
app.use(cors());
app.use(express.json());

// Canonical path enforcement only.
app.use('/oidc4vp', oidc4vpRouter);

const PORT = process.env.PORT || 4002;

app.listen(PORT, () => {
  console.log('Verifier API listening', { port: PORT });
});

export default app;
