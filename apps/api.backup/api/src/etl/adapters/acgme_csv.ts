import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { isoCountry, normSpec } from '../normalize';

export interface ACGMEProgram {
  program_id: string;
  name: string;
  institution: string;
  country: string;
  accreditor: string;
  specialty: string;
  level: string;
  url: string;
  last_verified: Date;
  _src: string;
}

export function parseACGMECsv(path: string): ACGMEProgram[] {
  const raw = fs.readFileSync(path, 'utf8');
  const recs = parse(raw, { columns: true });

  return recs.map((r: any) => ({
    program_id: `ACGME-${r.ProgramID}`,
    name: r.ProgramName?.trim(),
    institution: r.Sponsor?.trim(),
    country: isoCountry('US'),
    accreditor: 'ACGME',
    specialty: normSpec(r.Specialty || ''),
    level: 'residency',
    url: r.URL || '',
    last_verified: new Date(),
    _src: 'ACGME'
  }));
}

