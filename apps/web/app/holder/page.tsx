'use client';

import { useState } from 'react';

import { CredentialCard } from '@/components/holder/CredentialCard';
import { FocusMode } from '@/components/holder/FocusMode';
import type { HolderCredential } from '@/types/holder';

/* ------------------------------------------------------------------ */
/*  Mock credentials — realistic medical credential data               */
/* ------------------------------------------------------------------ */

const MOCK_CREDENTIALS: HolderCredential[] = [
  {
    id: 'cred-md-license-001',
    type: 'STATE_LICENSE',
    name: 'Medical Doctor License',
    issuer: 'California Medical Board',
    state: 'valid',
    trustLevel: 'L3',
    issueDate: 'Jan 15, 2023',
    expirationDate: 'Jan 15, 2025',
    licenseNumber: 'A-142857',
    npi: '1003000126',
    holderName: 'Dr. Sarah Chen',
    scope: 'Medicine and Surgery',
    methodologyVersion: '2.1.0',
    rawSnapshotHash:
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    verifierDID: 'did:web:verify.vitalcv.com',
    auditTrail: [
      {
        timestamp: '2023-01-15T09:30:00Z',
        action: 'Credential issued by California Medical Board',
        actor: 'CA Medical Board Automation',
        hash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
      },
      {
        timestamp: '2023-06-20T14:15:00Z',
        action: 'Primary Source Verification completed',
        actor: 'VitalCV PSV Engine v2.1',
        hash: 'f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3',
      },
      {
        timestamp: '2024-01-10T11:00:00Z',
        action: 'Annual re-verification passed',
        actor: 'VitalCV PSV Engine v2.1',
        hash: '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d',
      },
    ],
  },
  {
    id: 'cred-dea-002',
    type: 'DEA_REGISTRATION',
    name: 'DEA Registration — Schedule II–V',
    issuer: 'U.S. Drug Enforcement Administration',
    state: 'expiring',
    trustLevel: 'L2',
    issueDate: 'Mar 1, 2022',
    expirationDate: 'Mar 1, 2025',
    licenseNumber: 'FC-1234563',
    holderName: 'Dr. Sarah Chen',
    scope: 'Schedule II–V Controlled Substances',
    methodologyVersion: '2.0.3',
    rawSnapshotHash:
      '7d793037a076831e39f8abfaee4c01209fc6e84fed994982a1d2024c3be7ec6a',
    auditTrail: [
      {
        timestamp: '2022-03-01T08:00:00Z',
        action: 'DEA Registration issued',
        actor: 'DEA Diversion Control Division',
        hash: 'bb11cc22dd33ee44ff55aa66bb77cc88',
      },
      {
        timestamp: '2024-09-15T10:30:00Z',
        action: 'Source-check verification completed',
        actor: 'VitalCV Verification Pipeline',
        hash: '99aa88bb77cc66dd55ee44ff33221100',
      },
    ],
  },
  {
    id: 'cred-board-003',
    type: 'BOARD_CERTIFICATION',
    name: 'Board Certification — Internal Medicine',
    issuer: 'American Board of Internal Medicine',
    state: 'revoked',
    trustLevel: 'L1',
    issueDate: 'Jul 1, 2020',
    expirationDate: 'Jul 1, 2024',
    holderName: 'Dr. Sarah Chen',
    scope: 'Internal Medicine',
    auditTrail: [
      {
        timestamp: '2020-07-01T12:00:00Z',
        action: 'Board certification granted',
        actor: 'ABIM Certifications Office',
        hash: 'aabbccdd11223344aabbccdd11223344',
      },
      {
        timestamp: '2024-07-01T00:00:00Z',
        action: 'Certification expired — not renewed',
        actor: 'ABIM Automated Lapse',
        hash: '55667788aabbccdd55667788aabbccdd',
      },
      {
        timestamp: '2024-08-10T16:45:00Z',
        action: 'Status changed to revoked after lapse period',
        actor: 'VitalCV Status Monitor',
        hash: 'eeff0011eeff0011eeff0011eeff0011',
      },
    ],
  },
  {
    id: 'cred-npi-004',
    type: 'NPI_ENROLLMENT',
    name: 'National Provider Identifier',
    issuer: 'CMS / NPPES',
    state: 'valid',
    trustLevel: 'L0',
    issueDate: 'Sep 12, 2019',
    npi: '1003000126',
    holderName: 'Dr. Sarah Chen',
    scope: 'Individual Provider',
    verifierDID: 'did:web:verify.vitalcv.com',
    auditTrail: [
      {
        timestamp: '2019-09-12T10:00:00Z',
        action: 'NPI assigned by NPPES',
        actor: 'CMS Enrollment System',
        hash: '00112233445566778899aabbccddeeff',
      },
      {
        timestamp: '2024-11-01T09:00:00Z',
        action: 'Self-attested enrollment data submitted',
        actor: 'Dr. Sarah Chen',
        hash: 'ffeeddccbbaa99887766554433221100',
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Holder Dashboard Page                                              */
/* ------------------------------------------------------------------ */

export default function HolderPage() {
  const [focusCredential, setFocusCredential] =
    useState<HolderCredential | null>(null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-slate-100">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold text-gray-900">My Credentials</h1>
        <p className="text-lg text-gray-600 mt-2">
          Your verified clinical credentials
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          {MOCK_CREDENTIALS.map((c) => (
            <CredentialCard
              key={c.id}
              credential={c}
              onFocusMode={setFocusCredential}
            />
          ))}
        </div>
      </div>

      <FocusMode
        credential={focusCredential}
        onClose={() => setFocusCredential(null)}
      />
    </div>
  );
}
