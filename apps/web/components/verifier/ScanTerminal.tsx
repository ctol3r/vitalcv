"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";

import { StatusPill } from "@/components/holder/StatusPill";
import { useVerifierSession } from "@/lib/hooks/useVerifierSession";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";

interface ScanTerminalProps {
  onSessionReady?: (sessionId: string) => void;
}

export function ScanTerminal({ onSessionReady }: ScanTerminalProps) {
  const session = useVerifierSession();

  useEffect(() => {
    if (session.sessionId && onSessionReady) {
      onSessionReady(session.sessionId);
    }
  }, [session.sessionId, onSessionReady]);

  const qrUri = session.sessionId
    ? `openid4vp://?client_id=did:web:verifier.vitalcv.com&request_uri=${API_BASE}/api/verifier/presentation-request/${session.sessionId}`
    : "";

  return (
    <AnimatePresence mode="wait">
      {session.status === "verified" ? (
        <motion.div
          key="receipt-view"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.4, ease: [0, 0, 0.2, 1] }}
          className="bg-white/80 backdrop-blur-md rounded-2xl border border-white/30 shadow-lg ring-2 ring-green-400/40 p-8"
        >
          <div className="flex flex-col items-center text-center">
            {/* Green checkmark */}
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-green-600">
              <span className="text-4xl leading-none">&#10003;</span>
            </div>

            <h2 className="mt-6 text-3xl font-bold text-gray-900">
              Credential Verified
            </h2>

            <div className="mt-4">
              <StatusPill state="valid" />
            </div>

            {/* Claims grid */}
            <dl className="mt-8 grid w-full grid-cols-1 gap-4 text-left text-lg sm:grid-cols-2">
              <div>
                <dt className="text-sm uppercase tracking-wider text-gray-400">
                  Issuer
                </dt>
                <dd className="mt-1 font-medium text-gray-900">
                  {session.issuer || "Holder"}
                </dd>
              </div>
              <div>
                <dt className="text-sm uppercase tracking-wider text-gray-400">
                  Credential Type
                </dt>
                <dd className="mt-1 font-medium text-gray-900">
                  {session.vct || "Unknown"}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-sm uppercase tracking-wider text-gray-400">
                  Verified At
                </dt>
                <dd className="mt-1 font-medium text-gray-900">
                  {session.verifiedAt
                    ? new Date(session.verifiedAt).toLocaleDateString()
                    : "—"}
                </dd>
              </div>
            </dl>

            {/* Audit hash */}
            {session.auditHash && (
              <div className="mt-6 w-full text-left">
                <p className="text-sm uppercase tracking-wider text-gray-400">
                  Audit Hash
                </p>
                <p className="mt-1 break-all font-mono text-base text-gray-600">
                  {session.auditHash.slice(0, 24)}&hellip;
                </p>
              </div>
            )}
          </div>
        </motion.div>
      ) : session.status === "failed" ? (
        <motion.div
          key="failed-view"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.4, ease: [0, 0, 0.2, 1] }}
          className="bg-white/80 backdrop-blur-md rounded-2xl border border-white/30 shadow-lg ring-2 ring-red-400/40 p-8"
        >
          <div className="flex flex-col items-center text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-100 text-red-600">
              <span className="text-4xl leading-none">&times;</span>
            </div>
            <h2 className="mt-6 text-2xl font-semibold text-gray-800">
              Verification Failed
            </h2>
            <p className="mt-2 text-lg text-gray-500">
              {session.error || "The credential could not be verified."}
            </p>
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="qr-view"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.35 }}
          className="bg-white/80 backdrop-blur-md rounded-2xl border border-white/30 shadow-lg p-8"
        >
          <div className="flex flex-col items-center text-center">
            <h2 className="text-2xl font-semibold text-gray-900">
              Scan to Verify
            </h2>
            <p className="mt-2 text-lg text-gray-500">
              Present your VitalCV credential wallet
            </p>

            <div className="mt-6 rounded-2xl bg-white p-4">
              {session.sessionId ? (
                <QRCodeSVG value={qrUri} size={260} level="H" />
              ) : (
                <div className="flex h-[260px] w-[260px] items-center justify-center bg-gray-100 rounded-xl">
                  <span className="text-lg text-gray-400">
                    Initializing&hellip;
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 mt-6">
              <span className="inline-block h-3 w-3 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-lg text-gray-500">
                Waiting for clinician scan&hellip;
              </span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
