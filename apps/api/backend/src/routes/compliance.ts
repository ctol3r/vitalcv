import { Router } from 'express';
import prisma from '../graphql/prisma_client';

type AuditEntry = {
  type: string;
  hash: string;
  createdAt: string;
  metadata?: Record<string, unknown> | null;
};

type ComplianceCredentialRecord = {
  credentialId: string;
  name: string;
  issuer: string;
  issuedAt: string;
  verification: {
    lastVerifiedAt: string | null;
    verificationAuditRef: string | null;
  };
  expiry: {
    status: string;
    expiresAt: string | null;
  };
  attestation: {
    attestedAt: string | null;
    source: string;
  };
  revocation: {
    revoked: boolean;
    revokedAt: string | null;
    revocationReason: string | null;
    revocationAuditRef: string | null;
  };
  auditHistory: AuditEntry[];
  CR1: Record<string, unknown>;
  CR2: Record<string, unknown>;
  CR3: Record<string, unknown>;
  CR4: Record<string, unknown>;
  CR5: Record<string, unknown>;
};

const complianceRouter = Router();

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function resolveExpiryStatus(expiresAt: string | null): string {
  if (!expiresAt) return 'unknown';
  const expires = new Date(expiresAt);
  if (Number.isNaN(expires.getTime())) return 'unknown';
  const now = new Date();
  if (expires.getTime() < now.getTime()) return 'expired';
  const daysRemaining = (expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (daysRemaining <= 30) return 'expiring_soon';
  return 'active';
}

function toCsvValue(raw: string): string {
  if (raw.includes('"') || raw.includes(',') || raw.includes('\n')) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function toCsv(rows: Record<string, string>[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((key) => toCsvValue(row[key] ?? '')).join(',')),
  ];
  return lines.join('\n');
}

complianceRouter.get('/compliance/export', async (req, res) => {
  const clinicianIdRaw = String(req.query.clinicianId || '').trim();
  if (!clinicianIdRaw) return res.status(400).json({ error: 'clinicianId is required' });
  const clinicianId = Number(clinicianIdRaw);
  if (!Number.isInteger(clinicianId)) {
    return res.status(400).json({ error: 'clinicianId must be a numeric user id' });
  }

  const format = String(req.query.format || 'json').toLowerCase();
  const user = await prisma.user.findUnique({
    where: { id: clinicianId },
    include: { credentials: true },
  });

  if (!user) return res.status(404).json({ error: 'Clinician not found' });

  const externalIds = user.credentials.map((cred) => `CRED-${cred.id}`);
  const auditEvents = await prisma.auditEvent.findMany({
    where: {
      OR: [{ credentialId: { in: externalIds } }, { userId: clinicianId }],
    },
    orderBy: { createdAt: 'desc' },
  });

  const eventsByCredential = new Map<string, typeof auditEvents>();
  for (const event of auditEvents) {
    if (!event.credentialId) continue;
    const list = eventsByCredential.get(event.credentialId) ?? [];
    list.push(event);
    eventsByCredential.set(event.credentialId, list);
  }

  const credentials: ComplianceCredentialRecord[] = user.credentials.map((cred) => {
    const credentialId = `CRED-${cred.id}`;
    const events = eventsByCredential.get(credentialId) ?? [];
    const issueEvent = events.find((event) => event.type === 'ISSUE_CREDENTIAL') ?? null;
    const verifyEvent = events.find((event) => event.type === 'VERIFY_PRESENTATION') ?? null;
    const revokeEvent = events.find((event) => event.type === 'REVOKE_CREDENTIAL') ?? null;

    const issueMetadata =
      issueEvent && issueEvent.metadata && typeof issueEvent.metadata === 'object'
        ? (issueEvent.metadata as Record<string, unknown>)
        : null;
    const expiryDate = issueMetadata ? toIso(issueMetadata.expiryDate as string | undefined) : null;
    const expiryStatus = resolveExpiryStatus(expiryDate);
    const revocationReason =
      revokeEvent && revokeEvent.metadata && typeof revokeEvent.metadata === 'object'
        ? String((revokeEvent.metadata as Record<string, unknown>).reason || '')
        : '';

    const auditHistory: AuditEntry[] = events.map((event) => ({
      type: event.type,
      hash: event.hash,
      createdAt: event.createdAt.toISOString(),
      metadata: event.metadata as Record<string, unknown> | null,
    }));

    const attestedAt = issueEvent?.createdAt ? issueEvent.createdAt.toISOString() : cred.issuedAt.toISOString();
    const lastVerifiedAt = verifyEvent?.createdAt ? verifyEvent.createdAt.toISOString() : null;
    const revokedAt = revokeEvent?.createdAt ? revokeEvent.createdAt.toISOString() : null;
    const revoked = Boolean(revokeEvent);

    const cr1 = {
      issuer: cred.issuer,
      verificationMethod: verifyEvent?.metadata && (verifyEvent.metadata as Record<string, unknown>).disclosureType
        ? (verifyEvent.metadata as Record<string, unknown>).disclosureType
        : 'presentation',
      verifiedAt: lastVerifiedAt,
      verificationAuditRef: verifyEvent?.hash ?? null,
    };
    const cr2 = {
      attestationDate: attestedAt,
      attestationSource: issueMetadata?.issuer ?? cred.issuer,
    };
    const cr3 = {
      expiryStatus,
      expiresAt: expiryDate,
    };
    const cr4 = {
      revoked,
      revokedAt,
      revocationReason: revocationReason || null,
      revocationAuditRef: revokeEvent?.hash ?? null,
    };
    const cr5 = {
      auditHistory,
    };

    return {
      credentialId,
      name: cred.name,
      issuer: cred.issuer,
      issuedAt: cred.issuedAt.toISOString(),
      verification: {
        lastVerifiedAt,
        verificationAuditRef: verifyEvent?.hash ?? null,
      },
      expiry: {
        status: expiryStatus,
        expiresAt: expiryDate,
      },
      attestation: {
        attestedAt,
        source: cred.issuer,
      },
      revocation: {
        revoked,
        revokedAt,
        revocationReason: revocationReason || null,
        revocationAuditRef: revokeEvent?.hash ?? null,
      },
      auditHistory,
      CR1: cr1,
      CR2: cr2,
      CR3: cr3,
      CR4: cr4,
      CR5: cr5,
    };
  });

  const packet = {
    clinicianId: user.id,
    clinicianName: user.name,
    clinicianEmail: user.email,
    generatedAt: new Date().toISOString(),
    credentials,
  };

  if (format === 'csv') {
    const rows = credentials.map((cred) => ({
      clinicianId: String(user.id),
      clinicianName: user.name,
      clinicianEmail: user.email,
      credentialId: cred.credentialId,
      credentialName: cred.name,
      issuer: cred.issuer,
      issuedAt: cred.issuedAt,
      lastVerifiedAt: cred.verification.lastVerifiedAt || '',
      expiryStatus: cred.expiry.status,
      expiresAt: cred.expiry.expiresAt || '',
      attestedAt: cred.attestation.attestedAt || '',
      revoked: String(cred.revocation.revoked),
      revokedAt: cred.revocation.revokedAt || '',
      revocationReason: cred.revocation.revocationReason || '',
      auditEventCount: String(cred.auditHistory.length),
      CR1: JSON.stringify(cred.CR1),
      CR2: JSON.stringify(cred.CR2),
      CR3: JSON.stringify(cred.CR3),
      CR4: JSON.stringify(cred.CR4),
      CR5: JSON.stringify(cred.CR5),
    }));

    res.type('text/csv');
    return res.send(toCsv(rows));
  }

  return res.json(packet);
});

export { complianceRouter };
