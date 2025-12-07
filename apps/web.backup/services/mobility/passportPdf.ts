import { createHash } from 'crypto';

import type { CompactEligibilityV2Result } from './compactEligibilityV2.js';
import type { ReciprocityPathway } from './globalReciprocity.js';
import type { MobilityScoreBreakdown } from './mobilityScore.js';
import type { WaiverEligibilityResult } from './waiverEligibility.js';

export interface MobilityPassportPdfInput {
  clinicianId: string;
  statesEligible: string[];
  countries: string[];
  mobilityScore: MobilityScoreBreakdown;
  compacts: CompactEligibilityV2Result[];
  reciprocityPaths: ReciprocityPathway[];
  waiverEligibility: WaiverEligibilityResult;
}

export interface MobilityPassportPdf {
  fileName: string;
  dataUri: string;
  digest: string;
  size: number;
  generatedAt: string;
}

const TITLE = 'Vital Credential Mobility Passport';

export function generateMobilityPassportPdf(input: MobilityPassportPdfInput): MobilityPassportPdf {
  const generatedAt = new Date().toISOString();
  const compactLines = formatCompactLines(input.compacts);
  const waiverLines = formatWaiverLines(input.waiverEligibility);
  const reciprocityLines = formatReciprocityLines(input.reciprocityPaths);

  const lines: string[] = [
    TITLE,
    `Clinician ID: ${input.clinicianId}`,
    `Generated: ${generatedAt}`,
    '',
    `Mobility score (v${input.mobilityScore.version}): ${input.mobilityScore.total}/100`,
    ` - License breadth: ${(input.mobilityScore.components.licenseBreadth.value ?? 0).toString()} states`,
    ` - Compact coverage: ${input.mobilityScore.components.compacts.value}`,
    ` - Global equivalency pathways: ${input.mobilityScore.components.globalEquivalency.value}`,
    '',
    `Eligible states (${input.statesEligible.length}): ${input.statesEligible.join(', ') || 'None recorded'}`,
    `Priority countries: ${input.countries.length ? input.countries.join(', ') : 'No cross-border pathways'}`,
    '',
    'Compact readiness:',
    ...compactLines,
    '',
    'Reciprocity pathways:',
    ...reciprocityLines,
    '',
    'Disaster / waiver readiness:',
    ...waiverLines,
  ];

  const pdfBinary = buildPdf(lines);
  const buffer = Buffer.from(pdfBinary, 'binary');
  const digest = createHash('sha256').update(buffer).digest('hex');

  return {
    fileName: `mobility-passport-${input.clinicianId}.pdf`,
    dataUri: `data:application/pdf;base64,${buffer.toString('base64')}`,
    digest,
    size: buffer.length,
    generatedAt,
  };
}

function formatCompactLines(results: CompactEligibilityV2Result[]): string[] {
  if (!results || results.length === 0) {
    return ['  · No compact data available'];
  }
  return results.map(
    (result) =>
      `  · ${result.compact}: ${result.status.toUpperCase()} (${result.authorizedStates.length} states)`,
  );
}

function formatReciprocityLines(paths: ReciprocityPathway[]): string[] {
  if (!paths || paths.length === 0) {
    return ['  · No reciprocity pathways on record'];
  }
  return paths.map(
    (path) =>
      `  · ${path.origin}→${path.destination}: ${path.status.toUpperCase()} (${path.processingTimeDays}d SLA)`,
  );
}

function formatWaiverLines(waiver: WaiverEligibilityResult): string[] {
  if (!waiver || waiver.programs.length === 0) {
    return ['  · No waiver programs configured'];
  }
  return waiver.programs.map((program) => {
    const status = program.eligible ? 'READY' : 'BLOCKED';
    return `  · ${program.state} ${program.name}: ${status} — ${program.reason}`;
  });
}

function buildPdf(lines: string[]): string {
  const header = '%PDF-1.4\n';
  const objects: string[] = [];

  const contentStream = buildContentStream(lines);
  const contentLength = Buffer.byteLength(contentStream, 'utf-8');

  objects[1] = `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`;
  objects[2] = `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`;
  objects[3] =
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ` +
    `/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n`;
  objects[4] = `4 0 obj\n<< /Length ${contentLength} >>\nstream\n${contentStream}\nendstream\nendobj\n`;
  objects[5] = `5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`;

  let offset = header.length;
  const xrefEntries: string[] = ['0000000000 65535 f \n'];
  const bodyParts: string[] = [];

  for (let i = 1; i < objects.length; i += 1) {
    const object = objects[i];
    if (!object) continue;
    xrefEntries[i] = `${padOffset(offset)} 00000 n \n`;
    bodyParts.push(object);
    offset += Buffer.byteLength(object, 'utf-8');
  }

  const body = bodyParts.join('');
  const xrefStart = offset;
  const xref = `xref\n0 ${objects.length}\n${xrefEntries.join('')}`;
  const trailer = `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return header + body + xref + trailer;
}

function buildContentStream(lines: string[]): string {
  const startY = 780;
  const leading = 16;
  const commands: string[] = ['BT', '/F1 12 Tf', `${leading} TL`, `50 ${startY} Td`];

  lines.forEach((line, index) => {
    if (index > 0) {
      commands.push('T*');
    }
    commands.push(`(${escapePdfText(line)}) Tj`);
  });

  commands.push('ET');
  return commands.join('\n');
}

function escapePdfText(value: string): string {
  return value.replace(/([\\()])/g, '\\$1');
}

function padOffset(value: number): string {
  return value.toString().padStart(10, '0');
}

