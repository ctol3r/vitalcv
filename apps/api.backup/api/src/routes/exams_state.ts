import { Router } from 'express';
import { pool } from '../db';

export const examState = Router();

/**
 * MPJE State Adoption Endpoint
 * Returns whether a state has adopted the Uniform MPJE
 */
examState.get('/api/exams/mpje/state/:xx', async (req, res) => {
  try {
    const s = req.params.xx.toUpperCase();

    if (s.length !== 2) {
      return res.status(400).json({ error: 'Invalid state code' });
    }

    const { rows } = await pool.query(
      'SELECT uniform FROM "ExamAdoption" WHERE state=$1',
      [s]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'State not found' });
    }

    res.json({
      state: s,
      uniform: !!rows[0]?.uniform
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

