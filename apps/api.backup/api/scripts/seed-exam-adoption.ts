#!/usr/bin/env ts-node

/**
 * Seed script for ExamAdoption table
 * Usage: ts-node scripts/seed-exam-adoption.ts
 */

import { pool } from '../src/db';

const ALL_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL',
  'GA', 'HI', 'IA', 'ID', 'IL', 'IN', 'KS', 'KY', 'LA', 'MA',
  'MD', 'ME', 'MI', 'MN', 'MO', 'MS', 'MT', 'NC', 'ND', 'NE',
  'NH', 'NJ', 'NM', 'NV', 'NY', 'OH', 'OK', 'OR', 'PA', 'RI',
  'SC', 'SD', 'TN', 'TX', 'UT', 'VA', 'VT', 'WA', 'WI', 'WV', 'WY'
];

async function seed() {
  console.log('🌱 Seeding ExamAdoption table...');

  // Create table if not exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "ExamAdoption" (
      state VARCHAR(2) PRIMARY KEY,
      uniform BOOLEAN DEFAULT false,
      updated_at TIMESTAMP DEFAULT NOW(),
      notes TEXT
    )
  `);

  // Insert all states with default non-adopted status
  for (const state of ALL_STATES) {
    await pool.query(
      `INSERT INTO "ExamAdoption" (state, uniform, updated_at)
       VALUES ($1, false, NOW())
       ON CONFLICT (state) DO NOTHING`,
      [state]
    );
  }

  // Check current state
  const { rows } = await pool.query(
    'SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE uniform = true) as adopted FROM "ExamAdoption"'
  );

  console.log(`✅ Seeded ${rows[0].total} states`);
  console.log(`📊 ${rows[0].adopted} states have adopted Uniform MPJE`);
  console.log('');
  console.log('Next steps:');
  console.log('  - Visit /admin/exams/mpje to manage adoption status');
  console.log('  - Test: curl http://localhost:3001/api/exams/mpje/state/CA');

  await pool.end();
}

seed().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});

