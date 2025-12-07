import { Router, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';

import { evaluateWarrantyRisk } from '../../services/warranty/risk';
import { estimateWarrantyPremium } from '../../services/warranty/premium';
import { generateWarrantyCertificate } from '../../services/warranty/certificate';
import { detectWarrantyBreaches } from '../../services/warranty/breach';

const router = Router();
const prisma = new PrismaClient();

router.post('/warranty/validate', async (req: Request, res: Response) => {
  try {
    const { credentialId, credentialType, issuerDid } = req.body ?? {};
    let { coverage, warrantyType, expiresAt } = req.body ?? {};

    if (!credentialId || !credentialType || !issuerDid) {
      return res.status(400).json({
        error: 'invalid_payload',
        message: 'credentialId, credentialType, and issuerDid are required',
      });
    }

    const credential = await prisma.walletCredential.findUnique({
      where: { credentialId: credentialId.trim() },
    });
    if (!credential) {
      return res.status(404).json({
        error: 'credential_not_found',
        message: 'Wallet credential is required before issuing a warranty',
      });
    }

    const normalizedType = String(warrantyType ?? 'accuracy').toLowerCase();
    const coverageValue = normalizeCoverage(coverage);
    const expiryDate = resolveExpiry(expiresAt);

    const risk = await evaluateWarrantyRisk({
      credentialId: credentialId.trim(),
      credentialType: String(credentialType),
      issuerDid: String(issuerDid),
    });
    const premium = estimateWarrantyPremium({
      coverage: coverageValue,
      warrantyType: normalizedType,
      riskScore: risk.compositeRisk,
      tenorMonths: monthsBetween(new Date(), expiryDate),
    });

    const warrantyRecord = await prisma.credentialWarranty.upsert({
      where: { credentialId: credentialId.trim() },
      update: {
        coverage: coverageValue,
        warrantyType: normalizedType,
        expiresAt: expiryDate,
        issuerDid: String(issuerDid),
      },
      create: {
        credentialId: credentialId.trim(),
        coverage: coverageValue,
        warrantyType: normalizedType,
        expiresAt: expiryDate,
        issuerDid: String(issuerDid),
      },
    });

    const breaches = await detectWarrantyBreaches({
      credentialId: credentialId.trim(),
      credentialType: String(credentialType),
      issuerDid: String(issuerDid),
      expiresAt: warrantyRecord.expiresAt,
      baselineRisk: risk,
    });

    const certificate = await generateWarrantyCertificate({
      warrantyId: warrantyRecord.id,
      credentialId: credentialId.trim(),
      issuerDid: String(issuerDid),
      warrantyType: normalizedType,
      coverage: warrantyRecord.coverage,
      expiresAt: warrantyRecord.expiresAt,
      premium: premium.premium,
      terms: buildWarrantyTerms(warrantyRecord.coverage, normalizedType, expiryDate),
    });

    return res.json({
      credentialId: credentialId.trim(),
      warranty: {
        id: warrantyRecord.id,
        warrantyType: warrantyRecord.warrantyType,
        coverage: warrantyRecord.coverage,
        expiresAt: warrantyRecord.expiresAt.toISOString(),
        issuerDid: warrantyRecord.issuerDid,
        createdAt: warrantyRecord.createdAt.toISOString(),
        updatedAt: warrantyRecord.updatedAt.toISOString(),
      },
      risk,
      premium,
      certificate,
      breaches,
    });
  } catch (error) {
    console.error('[warranty][validate] failed', error);
    return res.status(500).json({
      error: 'warranty_validation_failed',
      message: error instanceof Error ? error.message : 'Unexpected warranty validation error',
    });
  }
});

export default router;

function normalizeCoverage(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === 'string') {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) {
      return numeric;
    }
  }
  return 50000;
}

function resolveExpiry(value: unknown): Date {
  if (value) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }
  const fallback = new Date();
  fallback.setMonth(fallback.getMonth() + 12);
  return fallback;
}

function monthsBetween(start: Date, end: Date): number {
  const years = end.getFullYear() - start.getFullYear();
  const months = end.getMonth() - start.getMonth();
  return Math.max(1, years * 12 + months);
}

function buildWarrantyTerms(coverage: number, type: string, expiresAt: Date) {
  return [
    `Coverage up to ${formatCurrency(coverage)} for credential disputes classified as ${type}.`,
    `Effective immediately and expiring on ${expiresAt.toDateString()}.`,
    'Claims require documented evidence of credential tampering or issuer dispute.',
  ];
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}










