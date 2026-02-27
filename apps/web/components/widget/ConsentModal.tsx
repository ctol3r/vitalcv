"use client"

import { AnimatePresence, motion } from "framer-motion"
import { useState } from "react"

export interface ConsentResult {
  sharedClaims: string[]
  hidePii: boolean
  auditToken: string
}

interface ConsentModalProps {
  isOpen: boolean
  employerName: string
  positionTitle: string
  onAuthorize: (result: ConsentResult) => void
  onCancel: () => void
}

interface ClaimItem {
  id: string
  label: string
  sublabel: string
  required: boolean
  defaultChecked: boolean
}

const CLAIM_ITEMS: ClaimItem[] = [
  { id: "medical_license", label: "Medical License", sublabel: "State: CA \u00b7 #A-142857 \u00b7 Valid", required: true, defaultChecked: true },
  { id: "npi", label: "NPI Registration", sublabel: "NPI: 1003000126 \u00b7 CMS/NPPES Verified", required: true, defaultChecked: true },
  { id: "board_cert", label: "Board Certification", sublabel: "ABIM \u00b7 Internal Medicine \u00b7 Current", required: false, defaultChecked: true },
  { id: "dea_reg", label: "DEA Registration", sublabel: "Schedule II\u2013V \u00b7 DEA #FC-1234563", required: false, defaultChecked: false },
]

export function ConsentModal({ isOpen, employerName, positionTitle, onAuthorize, onCancel }: ConsentModalProps) {
  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(CLAIM_ITEMS.map(c => [c.id, c.defaultChecked]))
  )
  const [hidePii, setHidePii] = useState(true)

  const handleAuthorize = () => {
    const sharedClaims = CLAIM_ITEMS.filter(c => checked[c.id]).map(c => c.id)
    onAuthorize({
      sharedClaims,
      hidePii,
      auditToken: "sha256:e3b0c44298fc1c149afbf4c8996fb924",
    })
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="consent-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={onCancel}
          />

          {/* Sheet — slides up from bottom */}
          <motion.div
            key="consent-sheet"
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 32, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[90vh] overflow-y-auto
                       bg-white rounded-t-3xl shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-10 rounded-full bg-gray-200" />
            </div>

            <div className="px-6 pb-8 pt-2">
              {/* Header */}
              <div className="mb-6">
                <p className="text-sm font-semibold uppercase tracking-widest text-teal-600 mb-1">
                  Credential Share Request
                </p>
                <h2 className="text-2xl font-bold text-gray-900">
                  {employerName} is requesting your credentials.
                </h2>
                <p className="text-lg text-gray-500 mt-1">
                  Position: {positionTitle}
                </p>
              </div>

              {/* Claim checklist */}
              <div className="space-y-3 mb-6">
                <p className="text-sm uppercase tracking-widest text-gray-400 font-semibold">
                  Requested data
                </p>
                {CLAIM_ITEMS.map(claim => (
                  <div
                    key={claim.id}
                    className="flex items-start gap-4 p-4 rounded-xl border border-gray-100 bg-gray-50/60"
                  >
                    <input
                      type="checkbox"
                      id={`claim-${claim.id}`}
                      checked={claim.required ? true : checked[claim.id]}
                      disabled={claim.required}
                      onChange={e => {
                        if (!claim.required) setChecked(prev => ({ ...prev, [claim.id]: e.target.checked }))
                      }}
                      className="mt-1 h-5 w-5 rounded border-gray-300 text-teal-600
                                 accent-teal-600 cursor-pointer disabled:cursor-default shrink-0"
                    />
                    <label htmlFor={`claim-${claim.id}`} className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-semibold text-gray-900">{claim.label}</span>
                        {claim.required ? (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700">
                            Required
                          </span>
                        ) : (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                            Optional
                          </span>
                        )}
                      </div>
                      <p className="text-base text-gray-500 mt-0.5">{claim.sublabel}</p>
                    </label>
                  </div>
                ))}
              </div>

              {/* PII toggle */}
              <div className="flex items-center justify-between p-4 rounded-xl border border-gray-100 bg-gray-50/60 mb-6">
                <div>
                  <p className="text-lg font-semibold text-gray-900">Hide off-chain PII</p>
                  <p className="text-base text-gray-500">Mask DOB, SSN, and address from disclosure</p>
                </div>
                <button
                  role="switch"
                  aria-checked={hidePii}
                  onClick={() => setHidePii(v => !v)}
                  className={`relative inline-flex h-7 w-12 shrink-0 rounded-full border-2 border-transparent
                             transition-colors duration-200 ease-in-out focus:outline-none
                             focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2
                             ${hidePii ? "bg-teal-600" : "bg-gray-200"}`}
                >
                  <motion.span
                    layout
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    className={`pointer-events-none inline-block h-6 w-6 rounded-full bg-white shadow-md
                               ${hidePii ? "translate-x-5" : "translate-x-0"}`}
                  />
                </button>
              </div>

              {/* Legal note */}
              <p className="text-sm text-gray-400 mb-6 text-center">
                Your data is cryptographically signed and you can revoke access at any time.
                VitalCV never stores plaintext PII.
              </p>

              {/* Authorize button */}
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleAuthorize}
                className="w-full min-h-[56px] rounded-2xl bg-teal-600 hover:bg-teal-500
                           text-white text-xl font-bold transition-colors
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
              >
                Authorize &amp; Disclose
              </motion.button>

              {/* Cancel */}
              <button
                onClick={onCancel}
                className="mt-3 w-full min-h-[44px] text-lg text-gray-400 hover:text-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
