"use client";

/**
 * Acceptance Graph & Predictive Routing — Labs demo surface.
 *
 * Composes the four NEW capabilities directly without mutating the
 * existing sandbox ClinicianPassport / EmployerReviewDashboard surfaces.
 *
 *   1. Predictive Acceptance Widget    (clinician)
 *   2. Facility Policy Overlay         (employer)
 *   3. Network Consensus Indicator     (employer)
 *   4. Time-to-Start Leaderboard       (clinician, triggered from Feature 1)
 *
 * Fixtures live in components/sandbox/lib/acceptance-graph.ts and are
 * imported directly — no API dependency.
 */

import { useState } from "react";
import { Building2, CheckCircle2, AlertCircle, Clock, Activity, Download, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

import PredictiveAcceptancePanel from "@/components/sandbox/PredictiveAcceptancePanel";
import VelocityLeaderboardModal from "@/components/sandbox/VelocityLeaderboardModal";
import NetworkConsensusIndicator from "@/components/sandbox/NetworkConsensusIndicator";
import FacilityPolicyDrawer from "@/components/sandbox/FacilityPolicyDrawer";
import {
  DEMO_NETWORK_CONSENSUS,
  type NetworkConsensus,
} from "@/components/sandbox/lib/acceptance-graph";
import { cn } from "@/components/sandbox/lib/utils";

type ViewMode = "clinician" | "employer";

interface DemoPacket {
  clinicianName: string;
  npi: string;
  specialty: string;
  status: "READY" | "PARTIAL" | "BLOCKED";
  submissionDate: string;
  timeToStart: string;
  synthesis: {
    verifiedCredentials: string;
    identifiedGaps: string;
    timeline: string;
  };
  networkConsensus: NetworkConsensus;
  defaultFacilityId: string;
}

const DEMO_PACKETS: DemoPacket[] = [
  {
    clinicianName: "Dr. John Smith, MD",
    npi: "1234567890",
    specialty: "Internal Medicine",
    status: "PARTIAL",
    submissionDate: new Date().toISOString(),
    timeToStart: "14 Days",
    synthesis: {
      verifiedCredentials: "NPPES Identity checked. CA State License (MD12345678) checked. OIG/LEIE checked.",
      identifiedGaps: "PECOS Enrollment status is PENDING. DEA and Board Certification are UNAVAILABLE.",
      timeline: "Safe to interview conditionally. Not safe to start.",
    },
    networkConsensus: DEMO_NETWORK_CONSENSUS["1234567890"],
    defaultFacilityId: "FAC-CEDAR-SF",
  },
  {
    clinicianName: "Dr. Sarah Chen, DO",
    npi: "1003000126",
    specialty: "Emergency Medicine",
    status: "READY",
    submissionDate: new Date(Date.now() - 86400000 * 2).toISOString(),
    timeToStart: "0 Days",
    synthesis: {
      verifiedCredentials: "All primary sources verified and active.",
      identifiedGaps: "None.",
      timeline: "Cleared to start immediately.",
    },
    networkConsensus: DEMO_NETWORK_CONSENSUS["1003000126"],
    defaultFacilityId: "FAC-KAISER-IRV",
  },
  {
    clinicianName: "Dr. Emily Davis, MD",
    npi: "9876543210",
    specialty: "Cardiology",
    status: "BLOCKED",
    submissionDate: new Date(Date.now() - 86400000 * 10).toISOString(),
    timeToStart: "TBD",
    synthesis: {
      verifiedCredentials: "NPPES Identity confirmed.",
      identifiedGaps: "State license expired. Requires manual intervention.",
      timeline: "Blocked until license renewal is verified.",
    },
    networkConsensus: DEMO_NETWORK_CONSENSUS["9876543210"],
    defaultFacilityId: "FAC-SUTTER-SAC",
  },
];

export default function AcceptanceGraphLabClient() {
  const [viewMode, setViewMode] = useState<ViewMode>("clinician");
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [policyPacket, setPolicyPacket] = useState<DemoPacket | null>(null);
  const [expandedNpi, setExpandedNpi] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-bg text-ink">
      {/* Lab header */}
      <header className="border-b border-line">
        <div className="max-w-5xl mx-auto px-6 py-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 opacity-40">
              <span className="text-[10px] font-bold uppercase tracking-widest font-mono">
                Labs · Acceptance Graph
              </span>
            </div>
            <h1 className="text-3xl font-bold tracking-tighter uppercase">
              Predictive Acceptance &amp; Routing
            </h1>
            <p className="text-xs opacity-60 font-mono max-w-2xl">
              Live demo of the four acceptance-graph capabilities — predictive probability,
              local policy alignment, network consensus, and velocity routing.
            </p>
          </div>
          <div className="inline-flex border border-line">
            {(["clinician", "employer"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                aria-pressed={viewMode === mode}
                className={cn(
                  "px-5 py-3 text-[10px] font-bold uppercase tracking-widest transition-colors",
                  viewMode === mode
                    ? "bg-ink text-bg"
                    : "bg-transparent text-ink/70 hover:bg-ink/5",
                )}
              >
                {mode === "clinician" ? "Clinician View" : "Employer View"}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        {viewMode === "clinician" ? (
          <div className="space-y-12">
            {/* Feature 1 — Predictive Acceptance */}
            <PredictiveAcceptancePanel
              onOptimizeVelocity={() => setIsLeaderboardOpen(true)}
            />
          </div>
        ) : (
          <div className="space-y-12">
            <div className="space-y-2">
              <div className="flex items-center gap-2 opacity-40">
                <span className="text-[10px] font-bold uppercase tracking-widest font-mono">
                  Clinician Packets · Employer Review
                </span>
              </div>
              <h2 className="text-2xl font-bold tracking-tighter uppercase">Incoming Packets</h2>
              <p className="text-xs opacity-60 font-mono max-w-2xl">
                Each packet carries its global verification state plus network consensus.
                Open the policy drawer on a row to see local bylaws alignment for that facility.
              </p>
            </div>

            <div className="space-y-4">
              {DEMO_PACKETS.map((packet) => (
                <PacketCard
                  key={packet.npi}
                  packet={packet}
                  expanded={expandedNpi === packet.npi}
                  onToggleExpand={() =>
                    setExpandedNpi((prev) => (prev === packet.npi ? null : packet.npi))
                  }
                  onOpenPolicy={() => setPolicyPacket(packet)}
                />
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Feature 4 — Velocity Leaderboard drawer */}
      <VelocityLeaderboardModal
        open={isLeaderboardOpen}
        onClose={() => setIsLeaderboardOpen(false)}
      />

      {/* Feature 2 — Facility Policy drawer */}
      <FacilityPolicyDrawer
        open={Boolean(policyPacket)}
        onClose={() => setPolicyPacket(null)}
        clinicianName={policyPacket?.clinicianName}
        npi={policyPacket?.npi}
        defaultFacilityId={policyPacket?.defaultFacilityId}
      />

      <footer className="border-t border-line mt-12">
        <div className="max-w-5xl mx-auto px-6 py-6 flex items-center justify-between text-[9px] font-mono uppercase tracking-widest opacity-30">
          <span>Labs · acceptance-graph · 4 capabilities · live fixture data</span>
          <span>local !== federal · separation enforced</span>
        </div>
      </footer>
    </div>
  );
}

function PacketCard({
  packet,
  expanded,
  onToggleExpand,
  onOpenPolicy,
}: {
  packet: DemoPacket;
  expanded: boolean;
  onToggleExpand: () => void;
  onOpenPolicy: () => void;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-line p-6 hover:bg-ink/5 transition-colors cursor-pointer"
      onClick={onToggleExpand}
    >
      <div className="flex flex-col md:flex-row justify-between gap-6">
        <div className="space-y-2 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="text-xl font-bold tracking-tight">{packet.clinicianName}</h3>
            <StatusChip status={packet.status} />
            {/* Feature 3 — inline chip */}
            <NetworkConsensusIndicator consensus={packet.networkConsensus} variant="chip" />
          </div>
          <div className="flex items-center gap-4 text-[10px] font-mono opacity-60 flex-wrap">
            <span>NPI: {packet.npi}</span>
            <span>·</span>
            <span>{packet.specialty}</span>
            <span>·</span>
            <span>Submitted: {new Date(packet.submissionDate).toLocaleDateString()}</span>
          </div>
        </div>

        <div className="flex items-center gap-6 shrink-0">
          <div className="text-right hidden sm:block">
            <div className="text-[9px] font-bold uppercase tracking-widest opacity-40 mb-1">
              Est. Start
            </div>
            <div className="text-lg font-bold font-mono">{packet.timeToStart}</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenPolicy();
              }}
              className="p-3 border border-indigo-500/30 dark:border-indigo-400/30 hover:bg-slate-500/10 transition-colors text-ink"
              aria-label="Open local policy alignment"
              title="Local Policy Alignment"
            >
              <Building2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                // Placeholder export
                const blob = new Blob([JSON.stringify(packet, null, 2)], {
                  type: "application/json",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `clinician-packet-${packet.npi}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="p-3 border border-line hover:bg-ink/5 transition-colors text-ink"
              aria-label="Export packet data"
              title="Export packet data"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              type="button"
              className="p-3 bg-ink text-bg hover:opacity-90 transition-opacity"
              aria-label={expanded ? "Collapse details" : "Expand details"}
            >
              <motion.div animate={{ rotate: expanded ? 90 : 0 }} transition={{ duration: 0.2 }}>
                <ArrowRight className="w-4 h-4" />
              </motion.div>
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="mt-8 pt-8 border-t border-line space-y-8"
        >
          {/* Feature 3 — expanded callout */}
          <NetworkConsensusIndicator consensus={packet.networkConsensus} variant="callout" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <SynthesisCell
              Icon={Activity}
              title="Verified Credentials"
              body={packet.synthesis.verifiedCredentials}
            />
            <SynthesisCell
              Icon={AlertCircle}
              title="Identified Gaps"
              body={packet.synthesis.identifiedGaps}
            />
            <SynthesisCell Icon={Clock} title="Timeline" body={packet.synthesis.timeline} />
          </div>
        </motion.div>
      )}
    </motion.article>
  );
}

function StatusChip({ status }: { status: DemoPacket["status"] }) {
  const meta =
    status === "READY"
      ? { Icon: CheckCircle2, classes: "border-green-500 text-green-600 dark:text-green-400 bg-green-500/10" }
      : status === "PARTIAL"
        ? { Icon: Clock, classes: "border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-500/10" }
        : { Icon: AlertCircle, classes: "border-red-500 text-red-600 dark:text-red-400 bg-red-500/10" };
  const { Icon, classes } = meta;
  return (
    <span
      className={cn(
        "flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border",
        classes,
      )}
    >
      <Icon className="w-3 h-3" />
      {status}
    </span>
  );
}

function SynthesisCell({
  Icon,
  title,
  body,
}: {
  Icon: typeof Activity;
  title: string;
  body: string;
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-[10px] font-bold uppercase tracking-widest opacity-40 flex items-center gap-2">
        <Icon className="w-3 h-3" /> {title}
      </h4>
      <p className="font-mono text-xs leading-relaxed opacity-80">{body}</p>
    </div>
  );
}
