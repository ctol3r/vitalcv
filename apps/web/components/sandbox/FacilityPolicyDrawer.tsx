"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Building2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Lock,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/components/sandbox/lib/utils";
import {
  DEMO_FACILITY_POLICIES,
  requirementsByScope,
  type FacilityPolicy,
  type FacilityPolicyRequirement,
  type PolicyScope,
} from "@/components/sandbox/lib/acceptance-graph";

export interface FacilityPolicyDrawerProps {
  open: boolean;
  onClose: () => void;
  clinicianName?: string;
  npi?: string;
  policies?: FacilityPolicy[];
  defaultFacilityId?: string;
}

const SCOPE_META: Record<PolicyScope, { label: string; hint: string }> = {
  FEDERAL: { label: "Federal", hint: "Federal registries (OIG, NPDB, SAM.gov)" },
  STATE: { label: "State", hint: "State medical board & CSR" },
  LOCAL: { label: "Local · Facility Bylaws", hint: "Medical Staff / P&P requirements — facility-specific" },
};

/**
 * Facility Policy Alignment (Feature 2) — maps the clinician's global
 * passport against a facility's Medical Staff bylaws. Fed/State rows keep
 * their semantic verification color (green/amber/red). Local rows render
 * with a Lock icon and muted outline so the credentialing manager can
 * immediately separate "national blocker" from "this-hospital's paperwork".
 */
export default function FacilityPolicyDrawer({
  open,
  onClose,
  clinicianName,
  npi,
  policies = DEMO_FACILITY_POLICIES,
  defaultFacilityId,
}: FacilityPolicyDrawerProps) {
  const [facilityId, setFacilityId] = useState<string>(defaultFacilityId ?? policies[0]?.facilityId ?? "");

  useEffect(() => {
    if (defaultFacilityId) setFacilityId(defaultFacilityId);
  }, [defaultFacilityId]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const policy = useMemo(
    () => policies.find((p) => p.facilityId === facilityId) ?? policies[0],
    [policies, facilityId],
  );

  if (!policy) return null;

  const grouped = requirementsByScope(policy);
  const missingLocal = grouped.LOCAL.filter((r) => r.status === "MISSING").length;
  const metLocal = grouped.LOCAL.filter((r) => r.status === "MET").length;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm"
          />
          <motion.aside
            role="dialog"
            aria-modal
            aria-label="Facility policy alignment"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.32, ease: [0.25, 1, 0.3, 1] }}
            className="fixed right-0 top-0 z-50 h-full w-full max-w-[640px] flex flex-col bg-bg border-l border-line shadow-[0_0_60px_rgba(0,0,0,0.45)]"
          >
            <header className="border-b border-line px-6 py-5 flex items-start justify-between gap-4">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 opacity-40">
                  <Building2 className="w-3 h-3" />
                  <span className="text-[10px] font-bold uppercase tracking-widest font-mono">
                    Local Policy Alignment
                  </span>
                </div>
                <h3 className="text-2xl font-bold tracking-tighter uppercase truncate">
                  {policy.facilityName}
                </h3>
                {clinicianName && (
                  <p className="text-[10px] font-mono opacity-50 truncate">
                    Packet · {clinicianName}
                    {npi && <> · NPI {npi}</>}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close policy alignment"
                className="shrink-0 p-2 border border-line hover:bg-ink/5 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </header>

            {/* Facility selector */}
            <div className="border-b border-line px-6 py-4 flex items-center gap-3">
              <label
                htmlFor="facility-policy-select"
                className="text-[9px] font-bold uppercase tracking-widest opacity-40 shrink-0"
              >
                Map against
              </label>
              <div className="relative flex-1">
                <select
                  id="facility-policy-select"
                  value={facilityId}
                  onChange={(e) => setFacilityId(e.target.value)}
                  className="w-full appearance-none bg-transparent border-b border-line py-2 pr-8 text-xs font-mono focus:outline-none focus:border-ink transition-colors"
                >
                  {policies.map((p) => (
                    <option key={p.facilityId} value={p.facilityId}>
                      {p.facilityName}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="w-3 h-3 absolute right-0 top-1/2 -translate-y-1/2 opacity-40 pointer-events-none"
                  aria-hidden="true"
                />
              </div>
            </div>

            {/* Bylaws summary + counters */}
            <div className="border-b border-line px-6 py-4 space-y-3">
              <p className="text-[11px] font-mono leading-relaxed opacity-70">{policy.bylawSummary}</p>
              <div className="grid grid-cols-3 gap-2 text-[9px] font-mono uppercase tracking-widest">
                <Counter label="Local MET" value={metLocal} tone="neutral" />
                <Counter label="Local MISSING" value={missingLocal} tone="alert" />
                <Counter
                  label="Fed+State"
                  value={grouped.FEDERAL.length + grouped.STATE.length}
                  tone="neutral"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {(Object.keys(SCOPE_META) as PolicyScope[]).map((scope) => {
                const list = grouped[scope];
                if (list.length === 0) return null;
                return (
                  <section key={scope} className="border-b border-line/60">
                    <div className="px-6 py-3 bg-ink/5 flex items-baseline justify-between">
                      <div>
                        <h4 className="text-[10px] font-bold uppercase tracking-widest font-mono">
                          {SCOPE_META[scope].label}
                        </h4>
                        <p className="text-[9px] font-mono opacity-40 mt-0.5">{SCOPE_META[scope].hint}</p>
                      </div>
                      <span className="text-[9px] font-mono opacity-40 tabular-nums">
                        {list.length} item{list.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <ul className="divide-y divide-line/40">
                      {list.map((req) => (
                        <RequirementRow key={req.id} req={req} />
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>

            <footer className="border-t border-line px-6 py-4 text-[9px] font-mono opacity-30 uppercase tracking-widest flex items-center justify-between">
              <span>live mapping · bylaws v{policy.requirements.length}</span>
              <span>local !== federal · separation enforced</span>
            </footer>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function Counter({ label, value, tone }: { label: string; value: number; tone: "neutral" | "alert" }) {
  return (
    <div
      className={cn(
        "border px-2 py-1.5",
        tone === "alert" && value > 0
          ? "border-indigo-500/40 dark:border-indigo-400/30 bg-slate-500/10 dark:bg-slate-400/5"
          : "border-line",
      )}
    >
      <div className="opacity-40">{label}</div>
      <div className="text-lg font-bold font-mono tabular-nums tracking-tight">
        {String(value).padStart(2, "0")}
      </div>
    </div>
  );
}

function RequirementRow({ req }: { req: FacilityPolicyRequirement }) {
  if (req.scope === "LOCAL") return <LocalRequirementRow req={req} />;
  return <FedStateRequirementRow req={req} />;
}

/**
 * Fed/State rows keep the existing verification vocabulary (green/amber/red)
 * because the credentialing manager already reads those colors as "this is
 * a national-level verification state".
 */
function FedStateRequirementRow({ req }: { req: FacilityPolicyRequirement }) {
  const statusMeta =
    req.status === "MET"
      ? { Icon: CheckCircle2, color: "text-green-600 dark:text-green-400" }
      : req.status === "PENDING"
        ? { Icon: Clock, color: "text-amber-600 dark:text-amber-400" }
        : { Icon: AlertCircle, color: "text-red-600 dark:text-red-400" };
  const { Icon, color } = statusMeta;
  return (
    <li className="flex items-start gap-3 px-6 py-3">
      <Icon className={cn("w-4 h-4 shrink-0 mt-0.5", color)} aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-bold tracking-tight truncate">{req.label}</span>
          <span className={cn("text-[9px] font-mono uppercase tracking-widest shrink-0", color)}>
            {req.status}
          </span>
        </div>
        {req.sourceClause && (
          <div className="text-[10px] font-mono opacity-40 mt-0.5">{req.sourceClause}</div>
        )}
      </div>
    </li>
  );
}

/**
 * LOCAL requirements render with a Lock icon + muted outline. Crucially
 * they never use red — the visual language has to say "this is paperwork
 * for this hospital, not a national red flag".
 */
function LocalRequirementRow({ req }: { req: FacilityPolicyRequirement }) {
  const isMissing = req.status === "MISSING";
  const isPending = req.status === "PENDING";

  return (
    <li className={cn("flex items-start gap-3 px-6 py-3 transition-colors", isMissing && "bg-ink/5")}>
      <div
        className={cn(
          "shrink-0 mt-0.5 w-5 h-5 border flex items-center justify-center",
          isMissing
            ? "border-indigo-500/40 dark:border-indigo-400/30 text-indigo-600 dark:text-indigo-400"
            : isPending
              ? "border-line text-ink/50"
              : "border-green-600/40 text-green-600 dark:text-green-400",
        )}
        aria-hidden="true"
      >
        {isMissing ? <Lock className="w-3 h-3" /> : isPending ? <Clock className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={cn("text-sm font-bold tracking-tight truncate", isMissing && "text-slate-700 dark:text-slate-300")}>
            {req.label}
          </span>
          <span
            className={cn(
              "text-[9px] font-mono uppercase tracking-widest shrink-0 border px-1.5 py-0.5",
              isMissing
                ? "border-indigo-500/40 dark:border-indigo-400/30 text-indigo-600 dark:text-indigo-400"
                : isPending
                  ? "border-line opacity-60"
                  : "border-green-600/40 text-green-600 dark:text-green-400",
            )}
          >
            {isMissing ? "Local Requirement" : req.status}
          </span>
        </div>
        {req.sourceClause && <div className="text-[10px] font-mono opacity-40 mt-0.5">{req.sourceClause}</div>}
      </div>
    </li>
  );
}
