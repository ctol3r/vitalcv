import { Router } from 'express';
import fs from 'fs';

export const cli = Router();

cli.get('/cli/install.sh', (_req, res) => {
  res.type('text/x-shellscript').send(fs.readFileSync('scripts/install.sh', 'utf8'));
});

