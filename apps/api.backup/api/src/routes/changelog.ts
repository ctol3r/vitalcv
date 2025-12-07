import { Router } from 'express';
import fs from 'fs';
import path from 'path';

export const changelog = Router();

changelog.get('/changelog', (_req, res) => {
  const changelogPath = path.join(process.cwd(), 'docs', 'changelog.md');
  res.type('text/markdown').send(fs.readFileSync(changelogPath, 'utf8'));
});

