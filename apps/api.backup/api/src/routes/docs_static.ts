import { Router } from 'express';
import fs from 'fs';

export const docsStatic = Router();

docsStatic.get('/docs/bugbash', (_req, res) => {
  res.type('text/markdown').send(fs.readFileSync('docs/bugbash.md', 'utf8'));
});

