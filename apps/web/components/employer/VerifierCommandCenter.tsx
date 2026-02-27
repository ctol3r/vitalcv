"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Shield,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Terminal,
} from "lucide-react";
import {
  createSafeFallbackState,
  type CredentialItem,
  type ClaimLevel,
} from "@/lib/api";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Candidate {
  id: string;
  name: string;
  npi: string;
  specialty: string;
  claimLevel: ClaimLevel;
  trustScore: number;
  credentials: CredentialItem[];
}

/* ------------------------------------------------------------------ */
/*  Mock Data                                                          */
/* ------------------------------------------------------------------ */

const MOCK_CANDIDATES: Candidate[] = [
  {
    id: "cand-001",
    name: "Dr. Maria Santos",
    npi: "1234567890",
    specialty: "Internal Medicine",
    claimLevel: "L3",
    trustScore: 100,
    credentials: [
      {
        id: "cred-001a",
        name: "State Medical License",
        issuer: "CA Medical Board",
        scope: "Practice of Medicine",
        status: "Valid",
        claimLevel: "L3",
        issueDate: "2022-03-15",
        expirationDate: "2026-03-15",
      },
      {
        id: "cred-001b",
        name: "DEA Registration",
        issuer: "DEA",
        scope: "Schedule II-V",
        status: "Valid",
        claimLevel: "L3",
        issueDate: "2023-01-10",
        expirationDate: "2026-01-10",
      },
      {
        id: "cred-001c",
        name: "Board Certification — Internal Medicine",
        issuer: "ABMS",
        scope: "Internal Medicine",
        status: "Valid",
        claimLevel: "L3",
        issueDate: "2021-06-01",
        expirationDate: "2031-06-01",
      },
    ],
  },
  {
    id: "cand-002",
    name: "Dr. James Chen",
    npi: "9876543210",
    specialty: "Cardiology",
    claimLevel: "L3",
    trustScore: 98,
    credentials: [
      {
        id: "cred-002a",
        name: "State Medical License",
        issuer: "NY State Education Dept",
        scope: "Practice of Medicine",
        status: "Valid",
        claimLevel: "L3",
        issueDate: "2020-09-01",
        expirationDate: "2026-09-01",
      },
      {
        id: "cred-002b",
        name: "Board Certification — Cardiology",
        issuer: "ABMS",
        scope: "Cardiovascular Disease",
        status: "Valid",
        claimLevel: "L3",
        issueDate: "2019-11-15",
        expirationDate: "2029-11-15",
      },
    ],
  },
  {
    id: "cand-003",
    name: "Dr. Aisha Patel",
    npi: "5551234567",
    specialty: "Emergency Medicine",
    claimLevel: "L2",
    trustScore: 74,
    credentials: [
      {
        id: "cred-003a",
        name: "State Medical License",
        issuer: "TX Medical Board",
        scope: "Practice of Medicine",
        status: "Valid",
        claimLevel: "L2",
        issueDate: "2023-05-20",
        expirationDate: "2025-05-20",
      },
      {
        id: "cred-003b",
        name: "DEA Registration",
        issuer: "DEA",
        scope: "Schedule II-V",
        status: "Pending",
        claimLevel: "L1",
        issueDate: "2024-01-15",
      },
    ],
  },
  {
    id: "cand-004",
    name: "Dr. Robert Kim",
    npi: "3335557777",
    specialty: "Orthopedic Surgery",
    claimLevel: "L2",
    trustScore: 62,
    credentials: [
      {
        id: "cred-004a",
        name: "State Medical License",
        issuer: "FL Board of Medicine",
        scope: "Practice of Medicine",
        status: "Expiring",
        claimLevel: "L2",
        issueDate: "2021-08-01",
        expirationDate: "2025-08-01",
      },
    ],
  },
  {
    id: "cand-005",
    name: "NP Sarah Okonkwo",
    npi: "4442226688",
    specialty: "Family Practice NP",
    claimLevel: "L1",
    trustScore: 38,
    credentials: [
      {
        id: "cred-005a",
        name: "APRN License",
        issuer: "IL DFPR",
        scope: "Advanced Practice Nursing",
        status: "Valid",
        claimLevel: "L1",
        issueDate: "2024-02-01",
        expirationDate: "2026-02-01",
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  ZK Terminal log lines                                              */
/* ------------------------------------------------------------------ */

const ZK_LOG_LINES = [
  { ts: "08:42:11.15", text: "Initializing ZK verification pipeline...", color: "text-yellow-300" },
  { ts: "08:42:11.42", text: "Loading issuer DID registry (131 trusted authorities)...", color: "text-yellow-300" },
  { ts: "08:42:11.89", text: "Checking ES256 cryptographic signatures...", color: "text-yellow-300" },
  { ts: "08:42:12.03", text: "State License signature matched to CA Medical Board DID.", color: "text-green-400" },
  { ts: "08:42:12.18", text: "DEA Registration signature matched to DEA federal DID.", color: "text-green-400" },
  { ts: "08:42:12.31", text: "Board Certification matched to ABMS DID registry.", color: "text-green-400" },
  { ts: "08:42:12.55", text: "NPI enrollment verified against CMS/NPPES root.", color: "text-green-400" },
  { ts: "08:42:12.72", text: "Cross-checking PoU bindings for scope compliance...", color: "text-yellow-300" },
  { ts: "08:42:12.89", text: "Zero-Knowledge proof bundle assembled.", color: "text-yellow-300" },
  { ts: "08:42:12.95", text: "✓ L3 Bundle mathematically proven. Readiness Score: 100/100.", color: "text-green-400" },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const LEVEL_COLORS: Record<ClaimLevel, string> = {
  L0: "bg-gray-200 text-gray-600",
  L1: "bg-blue-100 text-blue-700",
  L2: "bg-amber-100 text-amber-700",
  L3: "bg-green-100 text-green-700",
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  Valid: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  Expiring: <CheckCircle2 className="h-4 w-4 text-amber-500" />,
  Revoked: <XCircle className="h-4 w-4 text-red-500" />,
  Pending: <CheckCircle2 className="h-4 w-4 text-gray-400" />,
};

function LevelBadge({ level }: { level: ClaimLevel }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${LEVEL_COLORS[level]}`}
    >
      {level}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function TrustScoreRing({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (score / 100) * circumference;
  const color =
    score >= 90
      ? "text-green-500"
      : score >= 60
        ? "text-amber-500"
        : "text-red-500";

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg className="h-24 w-24 -rotate-90" viewBox="0 0 96 96">
        <circle
          cx="48"
          cy="48"
          r="40"
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          className="text-gray-200"
        />
        <circle
          cx="48"
          cy="48"
          r="40"
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={color}
        />
      </svg>
      <span className="absolute text-xl font-bold text-gray-900">{score}</span>
    </div>
  );
}

function ZkTerminal({ candidateId }: { candidateId: string }) {
  return (
    <div className="rounded-xl bg-gray-900 p-4 font-mono text-sm">
      {/* Header bar */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-blue-400">
          <Terminal className="h-4 w-4" />
          <span className="font-semibold">ZK Proof Validation Terminal</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
          <span className="text-xs text-green-400">LIVE</span>
        </div>
      </div>

      {/* Log lines — re-animate on candidate change via key */}
      <AnimatePresence mode="wait">
        <motion.div
          key={candidateId}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {ZK_LOG_LINES.map((line, index) => (
            <motion.div
              key={`${candidateId}-${index}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.4 }}
              className="leading-relaxed"
            >
              <span className="text-blue-300">[{line.ts}]</span>{" "}
              <span className={line.color}>{line.text}</span>
            </motion.div>
          ))}

          {/* Blinking cursor */}
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: ZK_LOG_LINES.length * 0.4 }}
            className="mt-1 inline-block animate-pulse text-green-400"
          >
            _
          </motion.span>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export function VerifierCommandCenter() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = MOCK_CANDIDATES.filter((c) => {
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) || c.npi.includes(q)
    );
  });

  const selected = MOCK_CANDIDATES.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="flex min-h-screen flex-row">
      {/* ── Left Pane ─────────────────────────────────────────── */}
      <div className="flex w-1/3 flex-col border-r border-gray-200 bg-gray-50">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 className="text-lg font-bold text-gray-900">Inbound Queue</h2>
          <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
            {filtered.length}
          </span>
        </div>

        {/* Search */}
        <div className="px-4 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or NPI…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="min-h-[44px] w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Candidate list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.map((candidate) => {
            const isActive = candidate.id === selectedId;
            return (
              <button
                key={candidate.id}
                type="button"
                onClick={() => setSelectedId(candidate.id)}
                className={`flex min-h-[44px] w-full items-center justify-between px-4 py-3 text-left transition-colors ${
                  isActive
                    ? "border-l-4 border-blue-600 bg-blue-50"
                    : "border-l-4 border-transparent hover:bg-gray-100"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-gray-900">
                    {candidate.name}
                  </p>
                  <p className="text-sm text-gray-500">NPI {candidate.npi}</p>
                  <p className="text-sm text-gray-500">{candidate.specialty}</p>
                </div>
                <div className="ml-3 flex flex-shrink-0 items-center gap-2">
                  <LevelBadge level={candidate.claimLevel} />
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </div>
              </button>
            );
          })}

          {filtered.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-gray-400">
              No candidates match your search.
            </div>
          )}
        </div>
      </div>

      {/* ── Right Pane ────────────────────────────────────────── */}
      <div className="flex w-2/3 flex-col bg-white">
        {!selected ? (
          /* Empty state */
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-gray-400">
            <Shield className="h-16 w-16 text-gray-300" />
            <p className="text-lg">
              Select a candidate from the queue to begin verification
            </p>
          </div>
        ) : (
          /* Candidate detail */
          <div className="flex-1 overflow-y-auto p-6">
            {/* Section 1: Golden Record header */}
            <div className="mb-8">
              <div className="flex items-start gap-6">
                <TrustScoreRing score={selected.trustScore} />
                <div className="flex-1">
                  <h1 className="text-2xl font-bold text-gray-900">
                    {selected.name}
                  </h1>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-gray-500">
                    <span>NPI {selected.npi}</span>
                    <span className="text-gray-300">|</span>
                    <span>{selected.specialty}</span>
                    <span className="text-gray-300">|</span>
                    <LevelBadge level={selected.claimLevel} />
                  </div>
                </div>
              </div>

              {/* Instant Approve button */}
              <button
                type="button"
                disabled={selected.claimLevel !== "L3"}
                className={`mt-6 min-h-[56px] w-full rounded-xl text-lg font-bold transition-colors ${
                  selected.claimLevel === "L3"
                    ? "bg-green-600 text-white hover:bg-green-700"
                    : "cursor-not-allowed bg-gray-200 text-gray-400 opacity-60"
                }`}
              >
                {selected.claimLevel === "L3"
                  ? "✓ Instant Approve — L3 Mathematically Proven"
                  : "Instant Approve — L3 Required"}
              </button>
            </div>

            {/* Section 2: Credential summary */}
            <div className="mb-8">
              <h2 className="mb-3 text-lg font-semibold text-gray-900">
                Credentials
              </h2>
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Issuer</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Level</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {createSafeFallbackState(selected.credentials, []).map(
                      (cred) => (
                        <tr key={cred.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">
                            {cred.name}
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {cred.issuer}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              {STATUS_ICON[cred.status] ?? null}
                              <span className="text-gray-700">
                                {cred.status}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <LevelBadge level={cred.claimLevel} />
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Section 3: Cryptographic Audit Terminal */}
            <div>
              <h2 className="mb-3 text-lg font-semibold text-gray-900">
                Cryptographic Audit
              </h2>
              <ZkTerminal candidateId={selected.id} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
