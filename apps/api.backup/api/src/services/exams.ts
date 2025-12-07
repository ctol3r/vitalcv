import { pool } from '../db';
import dayjs from 'dayjs';
import yaml from 'js-yaml';
import fs from 'fs';

const cfg: any = yaml.load(fs.readFileSync('config/exams.yaml', 'utf8'));

export async function getVersion(
  kind: 'naplex' | 'mpje',
  date: string,
  state?: string
): Promise<string> {
  if (kind === 'naplex') {
    return date >= cfg?.naplex?.new_outline_from ? 'new_outline' : 'legacy';
  }

  if (kind === 'mpje') {
    const { rows } = await pool.query(
      'SELECT uniform FROM "ExamAdoption" WHERE state=$1',
      [String(state || '').toUpperCase()]
    );
    const adopted = !!rows[0]?.uniform;
    const cutoff = cfg?.mpje?.uniform_from || '2026-06-01';
    return date >= cutoff && adopted ? 'uniform' : 'state';
  }

  return 'state';
}
