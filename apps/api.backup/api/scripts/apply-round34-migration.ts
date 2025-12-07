#!/usr/bin/env ts-node

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

async function applyMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/vitalcv?schema=public',
  });

  try {
    console.log('🚀 Applying Round 34 migration...');

    const migrationPath = path.join(__dirname, '../../prisma/migrations/20251103_newsletter_flags.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    await pool.query(sql);

    console.log('✅ Migration applied successfully!');
    console.log('   - Newsletter table created');
    console.log('   - RuntimeFlag table created');

    // Verify tables exist
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('Newsletter', 'RuntimeFlag')
      ORDER BY table_name;
    `);

    console.log('\n📋 Verified tables:');
    result.rows.forEach(row => console.log(`   ✓ ${row.table_name}`));

  } catch (error: any) {
    if (error.message.includes('already exists')) {
      console.log('ℹ️  Tables already exist, skipping migration');
    } else {
      console.error('❌ Migration failed:', error.message);
      process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

applyMigration();

