import { createHash } from 'crypto';

import type { AnchorRecord } from '../audit/anchor';
import { anchorEvent } from '../audit/anchor';

export interface WarrantyCertificateRequest {
  warrantyId: string;
  credentialId: string;
  issuerDid: string;
  warrantyType: string;
  coverage: number;
  expiresAt: Date | string;
  premium: number;
  terms?: string[];
}

export interface WarrantyCertificate {
  warrantyId: string;
  credentialId: string;
  issuerDid: string;
  warrantyType: string;
  coverage: number;
  premium: number;
  expiresAt: string;
  issuedAt: string;
  document: string;
  hash: string;
  anchor?: AnchorRecord;
}

export async function generateWarrantyCertificate(
  request: WarrantyCertificateRequest,
): Promise<WarrantyCertificate> {
  const issuedAt = new Date().toISOString();
  const expiresAt = new Date(request.expiresAt).toISOString();

  const pdfBase64 = await buildCertificatePdf({
    warrantyId: request.warrantyId,
    credentialId: request.credentialId,
    issuerDid: request.issuerDid,
    warrantyType: request.warrantyType,
    coverage: request.coverage,
    premium: request.premium,
    issuedAt,
    expiresAt,
    terms: request.terms,
  });

  const pdfBuffer = Buffer.from(pdfBase64, 'base64');
  const hash = createHash('sha256').update(pdfBuffer).digest('hex');

  let anchor: AnchorRecord | undefined;
  try {
    anchor = anchorEvent('warrantyIssued', {
      warrantyId: request.warrantyId,
      credentialId: request.credentialId,
      issuerDid: request.issuerDid,
      warrantyType: request.warrantyType,
      coverage: request.coverage,
      premium: request.premium,
      expiresAt,
      certificateHash: hash,
    });
  } catch (error) {
    console.warn('[warranty][certificate] failed to anchor warranty issuance', error);
  }

  return {
    warrantyId: request.warrantyId,
    credentialId: request.credentialId,
    issuerDid: request.issuerDid,
    warrantyType: request.warrantyType,
    coverage: request.coverage,
    premium: request.premium,
    expiresAt,
    issuedAt,
    document: pdfBase64,
    hash,
    anchor,
  };
}

interface CertificateRenderContext {
  warrantyId: string;
  credentialId: string;
  issuerDid: string;
  warrantyType: string;
  coverage: number;
  premium: number;
  issuedAt: string;
  expiresAt: string;
  terms?: string[];
}

async function buildCertificatePdf(data: CertificateRenderContext) {
  try {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text('Credential Warranty Certificate', 14, 20);
    doc.setFontSize(11);
    doc.text(`Warranty ID: ${data.warrantyId}`, 14, 32);
    doc.text(`Credential ID: ${data.credentialId}`, 14, 40);
    doc.text(`Issuer DID: ${data.issuerDid}`, 14, 48);

    doc.setFontSize(13);
    doc.text('Coverage Terms', 14, 64);
    doc.setFontSize(11);
    doc.text(`Type: ${data.warrantyType}`, 14, 74);
    doc.text(`Coverage: ${formatCurrency(data.coverage)}`, 14, 82);
    doc.text(`Premium: ${formatCurrency(data.premium)}`, 14, 90);
    doc.text(`Issued: ${new Date(data.issuedAt).toLocaleString()}`, 14, 98);
    doc.text(`Expires: ${new Date(data.expiresAt).toLocaleString()}`, 14, 106);

    const terms = data.terms?.length
      ? data.terms
      : [
          'Coverage limited to credential authenticity disputes.',
          'Claims must be filed within 30 days of incident discovery.',
          'Issuer agrees to cooperate with breach investigations.',
        ];

    doc.setFontSize(13);
    doc.text('Conditions', 14, 124);
    doc.setFontSize(10);
    let y = 134;
    terms.forEach((term, index) => {
      if (y > 270) {
        doc.addPage();
        y = 24;
      }
      doc.text(`${index + 1}. ${term}`, 16, y);
      y += 8;
    });

    const arrayBuffer = doc.output('arraybuffer') as ArrayBuffer;
    return Buffer.from(arrayBuffer).toString('base64');
  } catch (error) {
    console.warn('[warranty][certificate] pdf generation failed, falling back to text', error);
    const fallback = [
      'Credential Warranty Certificate',
      `Warranty ID: ${data.warrantyId}`,
      `Credential ID: ${data.credentialId}`,
      `Issuer DID: ${data.issuerDid}`,
      `Coverage: ${formatCurrency(data.coverage)}`,
      `Premium: ${formatCurrency(data.premium)}`,
      `Issued: ${data.issuedAt}`,
      `Expires: ${data.expiresAt}`,
      'Terms:',
      ...(data.terms ?? []),
    ].join('\n');
    return Buffer.from(fallback, 'utf8').toString('base64');
  }
}

function formatCurrency(amount: number): string {
  if (!Number.isFinite(amount)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(amount);
}


