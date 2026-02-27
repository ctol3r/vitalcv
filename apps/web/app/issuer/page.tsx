'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { IssuerPortal } from '@/components/issuer/IssuerPortal';
import { IssueActionModal } from '@/components/issuer/IssueActionModal';
import type { PendingClinician } from '@/components/issuer/IssueActionModal';

const PENDING_APPROVALS: PendingClinician[] = [
  {
    id: 'pa-001',
    name: 'Dr. James Whitfield',
    npi: '1417953954',
    licenseNumber: 'G-83741',
    credentialType: 'STATE_LICENSE',
    specialty: 'Cardiology',
    submittedAt: '2026-02-20T09:00:00Z',
  },
  {
    id: 'pa-002',
    name: 'Dr. Priya Mehta',
    npi: '1508972631',
    licenseNumber: 'M-21034',
    credentialType: 'BOARD_CERTIFICATION',
    specialty: 'Neurology',
    submittedAt: '2026-02-22T14:30:00Z',
  },
  {
    id: 'pa-003',
    name: 'Dr. Carlos Vega',
    npi: '1679824510',
    licenseNumber: '',
    credentialType: 'DEA_REGISTRATION',
    specialty: 'Anesthesiology',
    submittedAt: '2026-02-25T11:15:00Z',
  },
];

export default function IssuerPage() {
  const [selectedClinician, setSelectedClinician] =
    useState<PendingClinician | null>(null);
  const [issuedIds, setIssuedIds] = useState<Set<string>>(new Set());

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-slate-100">
        {/* Authority Command Center header */}
        <div className="max-w-5xl mx-auto px-4 pt-12 pb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Authority Command Center
          </h1>
          <p className="text-lg text-gray-600 mt-2">
            Review and cryptographically sign pending credential requests
          </p>

          {/* Pending Approvals table */}
          <div className="mt-8 bg-white/80 backdrop-blur-md rounded-2xl border border-white/30 shadow-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-xl font-semibold text-gray-900">
                Pending Approvals
                <span className="ml-2 inline-flex items-center justify-center h-6 w-6 rounded-full bg-amber-100 text-amber-700 text-sm font-bold">
                  {PENDING_APPROVALS.length - issuedIds.size}
                </span>
              </h2>
            </div>

            <ul className="divide-y divide-gray-100">
              {PENDING_APPROVALS.map((clinician, i) => (
                <motion.li
                  key={clinician.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="flex items-center justify-between px-6 py-4 gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-lg font-semibold text-gray-900 truncate">
                      {clinician.name}
                    </p>
                    <p className="text-base text-gray-500 mt-0.5">
                      {clinician.specialty} · NPI {clinician.npi} ·{' '}
                      {clinician.credentialType.replace(/_/g, ' ')}
                    </p>
                  </div>

                  {issuedIds.has(clinician.id) ? (
                    <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-green-50 text-green-700 text-sm font-semibold px-3 py-1">
                      ✓ Issued
                    </span>
                  ) : (
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      onClick={() => setSelectedClinician(clinician)}
                      className="shrink-0 min-h-[44px] rounded-xl bg-gray-900 text-white text-lg font-medium px-5 hover:bg-gray-800 active:bg-gray-700 transition-colors"
                    >
                      Review
                    </motion.button>
                  )}
                </motion.li>
              ))}
            </ul>
          </div>
        </div>

        {/* Existing issuer portal below */}
        <div className="border-t border-gray-200">
          <IssuerPortal />
        </div>
      </div>

      {/* Modal */}
      <IssueActionModal
        clinician={selectedClinician}
        onClose={() => setSelectedClinician(null)}
        onIssued={() => {
          if (selectedClinician) {
            setIssuedIds(
              (prev) => new Set([...prev, selectedClinician.id]),
            );
          }
          setSelectedClinician(null);
        }}
      />
    </>
  );
}
