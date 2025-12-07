import { createHash } from 'crypto';

export interface CrossBorderLicensePdfInput {
  clinicianId: string;
  license: {
    authority: string;
    country: string;
    licenseNumber: string;
    status: string;
    issuedAt?: string | null;
    expiresAt?: string | null;
    equivalencyTarget?: string | null;
    equivalencyLevel?: string | null;
    provenanceScore?: number | null;
    boardName?: string | null;
    lastVerified?: string | null;
  };
}

export interface CrossBorderLicensePdfResult {
  fileName: string;
  buffer: Buffer;
  digest: string;
  dataUri: string;
  generatedAt: string;
}

export function generateCrossBorderLicensePdf(
  input: CrossBorderLicensePdfInput,
): CrossBorderLicensePdfResult {
  const now = new Date().toISOString();
  const lines = buildSummaryLines(input, now);
  const pdfContent = buildPdf(lines);
  const buffer = Buffer.from(pdfContent, 'binary');
  const digest = createHash('sha256').update(buffer).digest('hex');
  const fileName = `global-license-${input.license.authority.toLowerCase()}-${input.license.licenseNumber}.pdf`;

  return {
    fileName,
    buffer,
    digest,
    dataUri: `data:application/pdf;base64,${buffer.toString('base64')}`,
    generatedAt: now,
  };
}

function buildSummaryLines(
  input: CrossBorderLicensePdfInput,
  generatedAt: string,
): string[] {
  const { license } = input;
  const score =
    typeof license.provenanceScore === 'number'
      ? `${Math.round(license.provenanceScore * 100)}%`
      : 'n/a';

  return [
    'Global Credential Readiness Passport',
    `Clinician: ${input.clinicianId}`,
    `Authority: ${license.authority} (${license.country})`,
    `Board: ${license.boardName ?? `Global ${license.authority}`}`,
    `License #: ${license.licenseNumber}`,
    `Status: ${license.status.toUpperCase()}`,
    `Issued: ${license.issuedAt ?? 'Unknown'}`,
    `Expires: ${license.expiresAt ?? 'Unknown'}`,
    `US Equivalency Target: ${license.equivalencyTarget ?? 'Pending'}`,
    `Equivalency Level: ${license.equivalencyLevel ?? 'UNSET'}`,
    `Provenance Confidence: ${score}`,
    `Last Verified: ${license.lastVerified ?? generatedAt}`,
    `Generated: ${generatedAt}`,
  ];
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
  const leading = 18;
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









