import fetch from 'node-fetch';
import { pool } from '../db';

const URL = process.env.PSYPACT_REGISTRY_URL || process.env.PSYCAPCT_REGISTRY_URL || '';
const TOKEN = process.env.PSYPACT_REGISTRY_TOKEN || '';

export async function lookupPsypactByNpi(npi: string) {
  // Check cache first
  const { rows } = await pool.query('SELECT * FROM "PsychPsyPactStatus" WHERE npi=$1', [npi]);
  const cached = rows[0];
  if (cached && cached.expires_at && new Date(cached.expires_at) > new Date()) return cached;

  // TODO: Real PSYPACT registry call when endpoint is available
  // const response = await fetch(`${URL}/lookup/${npi}`, {
  //   headers: { 'Authorization': `Bearer ${TOKEN}` }
  // });
  // const data = await response.json();

  // Demo data - replace with real API response
  const resp = {
    apit: true,  // Authority for Interjurisdictional Practice of Telepsychology
    tap: false,  // Temporary Authorization to Practice
    epassport: 'DEMO',
    expires_at: new Date(Date.now() + 90 * 86400000)
  };

  // Update cache
  await pool.query(
    'INSERT INTO "PsychPsyPactStatus"(npi,apit,tap,epassport,expires_at,updated_at) VALUES($1,$2,$3,$4,$5,now()) ON CONFLICT (npi) DO UPDATE SET apit=$2,tap=$3,epassport=$4,expires_at=$5,updated_at=now()',
    [npi, resp.apit, resp.tap, resp.epassport, resp.expires_at]
  );

  return { npi, ...resp };
}
