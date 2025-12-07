import { Router } from 'express';
import fs from 'fs';

export const pecosCal = Router();

pecosCal.get('/api/pecos/calendar.ics', (_req, res) => {
  try {
    const ics = fs.readFileSync('pecos.ics', 'utf8');
    res.type('text/calendar').send(ics);
  } catch {
    res.status(404).send('not generated');
  }
});

