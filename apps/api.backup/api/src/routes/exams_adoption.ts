import { Router } from 'express';
import { pool } from '../db';

export const exams = Router();

exams.get('/api/exams/mpje/adoption', async (_req, res) => {
  const { rows } = await pool.query('SELECT state, uniform FROM "ExamAdoption"');
  res.json({ rows });
});

exams.post('/api/exams/mpje/adoption', async (req, res) => {
  const { state, uniform } = req.body || {};

  await pool.query(
    `INSERT INTO "ExamAdoption"(state, uniform, updated_at)
     VALUES($1, $2, now())
     ON CONFLICT (state)
     DO UPDATE SET uniform=$2, updated_at=now()`,
    [String(state).toUpperCase(), !!uniform]
  );

  res.json({ ok: true });
});

