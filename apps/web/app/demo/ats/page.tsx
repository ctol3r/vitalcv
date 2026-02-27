"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ApplyButton } from "@/components/widget/ApplyButton"
import { ConsentModal } from "@/components/widget/ConsentModal"
import type { ConsentResult } from "@/components/widget/ConsentModal"

export default function ATSDemoPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [result, setResult] = useState<ConsentResult | null>(null)

  return (
    <div className="min-h-screen bg-white">
      {/* Legacy ATS header */}
      <header
        style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
        className="bg-[#003366] px-6 py-3 flex items-center gap-4"
      >
        <div className="text-white font-bold text-lg">&#127973; Sutter Health</div>
        <div className="text-white/70 text-sm">| Careers Portal</div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        {/* Job header */}
        <div style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
          <p className="text-sm text-gray-500">Job ID: SH-2026-0419 &middot; Posted Feb 15, 2026</p>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">
            ICU Registered Nurse &mdash; Sacramento Campus
          </h1>
          <p className="text-base text-gray-600 mt-1">
            Department: Critical Care &middot; Full Time &middot; Night Shift
          </p>
          <hr className="my-4 border-gray-200" />
        </div>

        <AnimatePresence mode="wait">
          {result ? (
            /* VISUAL STATE 2 — Success */
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45, ease: [0, 0, 0.2, 1] }}
              className="py-10"
            >
              <div className="flex flex-col items-center text-center">
                {/* Green checkmark */}
                <div className="h-24 w-24 rounded-full bg-green-100 flex items-center justify-center mb-6">
                  <span className="text-5xl leading-none text-green-600">&#10003;</span>
                </div>

                {/* Liquid Glass success banner */}
                <div className="w-full max-w-lg bg-white/80 backdrop-blur-md rounded-2xl border border-green-200/60 shadow-lg p-8">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-50 text-green-700 text-sm font-semibold mb-4">
                    W3C Verifiable Credential &#10003;
                  </div>

                  <h2 className="text-3xl font-black text-gray-900">
                    Candidate 100% Ready to Hire
                  </h2>
                  <p className="text-lg text-gray-500 mt-2">
                    All requested credentials cryptographically verified.
                  </p>

                  {/* Shared claims grid */}
                  <div className="mt-6 grid grid-cols-2 gap-3 text-left">
                    {result.sharedClaims.map(claim => (
                      <div key={claim} className="flex items-center gap-2 text-base text-gray-700">
                        <span className="text-green-500 font-bold">&#10003;</span>
                        {claim.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                      </div>
                    ))}
                  </div>

                  {/* PII status */}
                  <p className="mt-4 text-base text-gray-500">
                    {result.hidePii ? "\u2713 Off-chain PII masked" : "\u26a0 PII included in disclosure"}
                  </p>

                  {/* Audit hash */}
                  <div className="mt-6 pt-4 border-t border-gray-100 text-left">
                    <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">
                      Cryptographic Audit Token
                    </p>
                    <p className="font-mono text-sm text-gray-600 break-all">{result.auditToken}</p>
                  </div>

                  {/* Action buttons */}
                  <div className="mt-6 flex gap-3">
                    <button
                      onClick={() => setResult(null)}
                      className="flex-1 min-h-[44px] rounded-xl border border-gray-200 text-base text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      Reset Demo
                    </button>
                    <button className="flex-1 min-h-[44px] rounded-xl bg-green-600 text-white text-base font-semibold hover:bg-green-500 transition-colors">
                      Proceed to Onboarding &rarr;
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            /* VISUAL STATE 1 — Legacy ATS form */
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* LEFT — boring upload form */}
                <div style={{ fontFamily: "Arial, Helvetica, sans-serif" }} className="space-y-4">
                  <h2 className="text-base font-bold text-gray-700 uppercase tracking-wide">
                    Submit Application
                  </h2>

                  <input type="text" placeholder="First Last"
                    className="border border-gray-300 rounded px-3 py-2 w-full text-sm" />
                  <input type="email" placeholder="Email"
                    className="border border-gray-300 rounded px-3 py-2 w-full text-sm" />
                  <input type="tel" placeholder="Phone"
                    className="border border-gray-300 rounded px-3 py-2 w-full text-sm" />
                  <input type="text" placeholder="Nursing License #"
                    className="border border-gray-300 rounded px-3 py-2 w-full text-sm" />
                  <input type="text" placeholder="e.g. CA"
                    className="border border-gray-300 rounded px-3 py-2 w-full text-sm" />

                  <div>
                    <p className="text-sm text-gray-600 mb-1">Upload Resume</p>
                    <input type="file" className="block w-full text-sm text-gray-500" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Upload License Copy</p>
                    <input type="file" className="block w-full text-sm text-gray-500" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Upload Board Cert</p>
                    <input type="file" className="block w-full text-sm text-gray-500" />
                  </div>

                  <p className="text-xs text-gray-400 mt-2">
                    Processing time: 60&ndash;90 business days. HR will contact you via mail.
                  </p>

                  <button
                    type="submit"
                    className="mt-2 px-4 py-2 bg-[#003366] text-white text-sm rounded hover:bg-[#002244] transition-colors"
                  >
                    Submit Application
                  </button>
                </div>

                {/* RIGHT — VitalCV widget */}
                <div className="flex flex-col items-center justify-start pt-6 text-center">
                  <div className="w-full max-w-xs bg-gradient-to-br from-teal-50 to-slate-50 rounded-2xl border border-teal-200/60 p-6 shadow-md">
                    <div className="text-xs font-semibold uppercase tracking-widest text-teal-600 mb-2">
                      &#9889; Skip the paperwork
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Apply in 30 seconds</h3>
                    <p className="text-sm text-gray-500 mb-5 leading-relaxed">
                      Share your verified VitalCV credential bundle. No uploads. No waiting weeks for credential review.
                    </p>
                    <ApplyButton onClick={() => setModalOpen(true)} />
                    <p className="text-xs text-gray-400 mt-3">
                      Cryptographically verified &middot; W3C VC 2.0
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <ConsentModal
        isOpen={modalOpen}
        employerName="Sutter Health"
        positionTitle="ICU Registered Nurse"
        onAuthorize={(r) => { setResult(r); setModalOpen(false) }}
        onCancel={() => setModalOpen(false)}
      />
    </div>
  )
}
