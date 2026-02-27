"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface MockProfile {
  npi: string;
  holderName: string;
  crsScore: number;
  trustLevel: string;
  licenseState: string;
  specialty: string;
  status: string;
  daysToStart: number;
}

const MOCK_PROFILES: Record<string, MockProfile> = {
  default: {
    npi: "",
    holderName: "Dr. Sarah Chen",
    crsScore: 87,
    trustLevel: "L3",
    licenseState: "CA",
    specialty: "Internal Medicine",
    status: "valid",
    daysToStart: 2,
  },
};

type TerminalState = "idle" | "loading" | "result";

export default function NpiTerminal() {
  const [npi, setNpi] = useState("");
  const [termState, setTermState] = useState<TerminalState>("idle");
  const [profile, setProfile] = useState<MockProfile | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleGenerate = () => {
    if (npi.trim().length < 5) return;
    setTermState("loading");
    timeoutRef.current = setTimeout(() => {
      setProfile({ ...MOCK_PROFILES.default, npi: npi.trim() });
      setTermState("result");
    }, 1400);
  };

  return (
    <div className="max-w-2xl mx-auto px-6 -mt-20 relative z-20">
      <div className="bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
        {/* Terminal header bar */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-white/5 bg-black/20">
          <span className="h-3 w-3 rounded-full bg-red-500/70" />
          <span className="h-3 w-3 rounded-full bg-yellow-500/70" />
          <span className="h-3 w-3 rounded-full bg-green-500/70" />
          <span className="ml-3 text-xs text-slate-500 font-mono">
            vitalcv -- trust-terminal -- 80x24
          </span>
        </div>

        {/* Terminal body */}
        <div className="px-6 py-6">
          <p className="text-xs font-mono text-slate-500 mb-3">
            $ vitalcv generate-trust-profile --npi
          </p>

          {/* Input row */}
          <div className="flex gap-3">
            <input
              type="text"
              inputMode="numeric"
              value={npi}
              onChange={(e) =>
                setNpi(e.target.value.replace(/\D/g, "").slice(0, 10))
              }
              onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
              placeholder="Enter 10-digit NPI..."
              className="flex-1 min-h-[44px] rounded-xl bg-black/30 border border-white/10 text-white placeholder-slate-600 px-4 text-lg font-mono focus:outline-none focus:border-teal-500/50 transition-colors"
              maxLength={10}
              disabled={termState === "loading"}
            />
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={handleGenerate}
              disabled={termState === "loading" || npi.trim().length < 5}
              className="min-h-[44px] min-w-[44px] px-6 rounded-xl bg-teal-500 hover:bg-teal-400 disabled:opacity-40 text-slate-950 text-lg font-bold transition-colors"
            >
              {termState === "loading" ? "..." : "→"}
            </motion.button>
          </div>

          {/* Results area */}
          <AnimatePresence mode="wait">
            {termState === "loading" && (
              <motion.div
                key="skeleton"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mt-4 space-y-3"
              >
                <div
                  className="h-4 bg-white/5 rounded animate-pulse"
                  style={{ width: "60%" }}
                />
                <div
                  className="h-4 bg-white/5 rounded animate-pulse"
                  style={{ width: "40%" }}
                />
                <div
                  className="h-4 bg-white/5 rounded animate-pulse"
                  style={{ width: "75%" }}
                />
              </motion.div>
            )}

            {termState === "result" && profile && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className="mt-5 space-y-4"
              >
                <p className="font-mono text-sm text-teal-400">
                  ✓ Provider located · NPPES confirmed
                </p>

                <div className="bg-black/30 rounded-xl p-4 mt-3">
                  <p className="text-xl font-bold text-white">
                    {profile.holderName}
                  </p>
                  <p className="text-base text-slate-400">
                    {profile.specialty} · {profile.licenseState}
                  </p>

                  <div className="grid grid-cols-3 gap-3 mt-4">
                    <div className="text-center">
                      <p className="text-2xl font-black text-teal-400">
                        {profile.crsScore}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        CRS Score
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-black text-white">
                        {profile.trustLevel}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Trust Level
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-black text-green-400">
                        {profile.daysToStart}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Days to Start
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-sm text-slate-400 font-mono">
                      NPI {profile.npi}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/15 text-green-400 text-sm font-semibold">
                      ● Eligible
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
