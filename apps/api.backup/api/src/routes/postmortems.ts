import { Router } from 'express';
import fs from 'fs';

export const pmRouter = Router();

pmRouter.get('/docs/postmortem-template', (_req, res) => {
  res.type('text/markdown').send(fs.readFileSync('docs/postmortem_template.md', 'utf8'));
});

