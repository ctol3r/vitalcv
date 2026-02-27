'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { StatusPill } from '@/components/holder/StatusPill';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export interface PendingClinician {
  id: string;
  name: string;
  npi: string;
  licenseNumber: string;
  credentialType: string;
  specialty: string;
  submittedAt: string; // ISO string — format inside the component, never at module level
}

interface IssueActionModalProps {
  clinician: PendingClinician | null;
  onClose: () => void;
  onIssued?: (jwt: string) => void;
}

type ModalState = 'review' | 'signing' | 'success' | 'error';

export function IssueActionModal({
  clinician,
  onClose,
  onIssued,
}: IssueActionModalProps) {
  const [modalState, setModalState] = useState<ModalState>('review');
  const [issuedJwt, setIssuedJwt] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (clinician) {
      setModalState('review');
      setIssuedJwt(null);
      setErrorMsg(null);
    }
  }, [clinician]);

  async function handleSign() {
    if (!clinician) return;
    setModalState('signing');
    try {
      const res = await fetch(`${API_BASE}/api/issuer/issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicianName: clinician.name,
          npi: clinician.npi,
          licenseNumber: clinician.licenseNumber,
          credentialType: clinician.credentialType,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        status: string;
        credential: string;
      };
      if (data.status !== 'success') throw new Error('issuance_failed');
      setIssuedJwt(data.credential);
      setModalState('success');
      onIssued?.(data.credential);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Issuance failed');
      setModalState('error');
    }
  }

  return (
    <AnimatePresence>
      {clinician && (
        <motion.div
          key="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            key="modal-panel"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ duration: 0.3, ease: [0, 0, 0.2, 1] }}
            className="bg-white/90 backdrop-blur-md rounded-2xl border border-white/30 shadow-2xl w-full max-w-lg p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <AnimatePresence mode="wait">
              {/* STATE: review */}
              {modalState === 'review' && (
                <motion.div
                  key="review"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <h2 className="text-2xl font-bold text-gray-900">
                    Review Credential Request
                  </h2>
                  <p className="text-lg text-gray-500 mt-1">
                    Pending Authority Approval
                  </p>

                  <dl className="mt-6 grid grid-cols-2 gap-4">
                    <div>
                      <dt className="text-sm uppercase tracking-wider text-gray-400">
                        Clinician
                      </dt>
                      <dd className="text-lg font-medium text-gray-900 mt-1">
                        {clinician.name}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm uppercase tracking-wider text-gray-400">
                        NPI
                      </dt>
                      <dd className="text-lg font-medium text-gray-900 mt-1">
                        {clinician.npi}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm uppercase tracking-wider text-gray-400">
                        License #
                      </dt>
                      <dd className="text-lg font-medium text-gray-900 mt-1">
                        {clinician.licenseNumber || '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm uppercase tracking-wider text-gray-400">
                        Credential Type
                      </dt>
                      <dd className="text-lg font-medium text-gray-900 mt-1">
                        {clinician.credentialType}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm uppercase tracking-wider text-gray-400">
                        Specialty
                      </dt>
                      <dd className="text-lg font-medium text-gray-900 mt-1">
                        {clinician.specialty}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm uppercase tracking-wider text-gray-400">
                        Submitted
                      </dt>
                      <dd className="text-lg font-medium text-gray-900 mt-1">
                        {new Date(clinician.submittedAt).toLocaleDateString()}
                      </dd>
                    </div>
                  </dl>

                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSign}
                    className="mt-8 w-full min-h-[56px] rounded-xl bg-gray-900 text-white text-xl font-bold hover:bg-gray-800 active:bg-gray-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2"
                  >
                    🔐 Cryptographically Sign &amp; Issue
                  </motion.button>
                  <button
                    onClick={onClose}
                    className="mt-3 w-full min-h-[44px] text-lg text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                </motion.div>
              )}

              {/* STATE: signing (loading) */}
              {modalState === 'signing' && (
                <motion.div
                  key="signing"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center py-8"
                >
                  <div className="h-16 w-16 rounded-full border-4 border-gray-900 border-t-transparent animate-spin" />
                  <p className="mt-6 text-xl font-semibold text-gray-900">
                    Signing credential…
                  </p>
                  <p className="mt-2 text-lg text-gray-500">
                    Generating cryptographic proof
                  </p>
                </motion.div>
              )}

              {/* STATE: success */}
              {modalState === 'success' && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35 }}
                  className="flex flex-col items-center text-center py-4"
                >
                  <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center">
                    <span className="text-4xl leading-none text-green-600">
                      &#10003;
                    </span>
                  </div>
                  <h3 className="mt-6 text-3xl font-bold text-gray-900">
                    VC Minted
                  </h3>
                  <div className="mt-3">
                    <StatusPill state="valid" />
                  </div>
                  <p className="mt-4 text-lg text-gray-500">
                    Verifiable credential cryptographically signed and issued.
                  </p>
                  {issuedJwt && (
                    <div className="mt-6 w-full text-left">
                      <p className="text-sm uppercase tracking-wider text-gray-400">
                        JWT Signature (first 20 chars)
                      </p>
                      <p className="mt-1 font-mono text-base text-gray-700 break-all">
                        {issuedJwt.split('.')[2]?.slice(0, 20) ?? '—'}…
                      </p>
                    </div>
                  )}
                  <button
                    onClick={onClose}
                    className="mt-8 w-full min-h-[44px] rounded-xl bg-gray-900 text-white text-lg font-semibold hover:bg-gray-800 transition-colors"
                  >
                    Done
                  </button>
                </motion.div>
              )}

              {/* STATE: error */}
              {modalState === 'error' && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center text-center py-4"
                >
                  <div className="h-20 w-20 rounded-full bg-red-100 flex items-center justify-center">
                    <span className="text-4xl leading-none text-red-600">
                      &times;
                    </span>
                  </div>
                  <h3 className="mt-6 text-2xl font-semibold text-gray-800">
                    Issuance Failed
                  </h3>
                  <p className="mt-2 text-lg text-gray-500">{errorMsg}</p>
                  <div className="mt-6 flex gap-3 w-full">
                    <button
                      onClick={() => setModalState('review')}
                      className="flex-1 min-h-[44px] rounded-xl border border-gray-300 text-lg text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Retry
                    </button>
                    <button
                      onClick={onClose}
                      className="flex-1 min-h-[44px] rounded-xl bg-gray-900 text-white text-lg hover:bg-gray-800 transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
