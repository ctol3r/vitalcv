import express from 'express';
import { router as verifierRouter } from './routes/verifier_routes';

const app = express();
const port = process.env.PORT || 3000;

app.use('/api', verifierRouter);

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
