// VitalCV · Trust Surfaces · Priority 1 · Passport
// Holder passport. Asserts authority — therefore MUST render the signer above the fold
// (Canon §07.03 — closing the largest legitimacy gap).
//
// Wire: replace getPassport() with your real source-of-record fetch.

import * as React from "react";
import type {
  Claim,
  Lineage,
  SignerContinuity,
  Verdict,
  ChainNode,
} from "@/lib/trust/types";
import { lineageWhen } from "@/lib/trust/format";
import { LineageFooter } from "@/components/trust/LineageHeader";
import { SurfaceHeader, SurfaceControlFooter, type SurfaceControl } from "@/components/trust/SurfaceHeader";
import { SignaturePanel } from "@/components/trust/SignaturePanel";
import { ChainStrip } from "@/components/trust/ChainStrip";
import { VerdictBar, OwnershipBadge, IdRender, CheckedAt, TierBadge, TrustChip, SectionHeader } from "@/components/trust/primitives";
import { DegradedRow } from "@/components/trust/DegradedRow";

// === STUB · replace with your trust API call =================================
async function getPassport(npi: string) {
  const now = new Date();
  const checkedAt = new Date(now.getTime() - 10_000).toISOString();
  const w = lineageWhen(checkedAt, now);

  const lineage: Lineage = {
    state: "signed",
    object: `Provider passport · NPI ${npi}`,
    objectSub: "Mira Chen, MD · subject-bound",
    ownership: "subject",
    checkedAtIso: w.checkedAtIso,
    checkedAgo: w.checkedAgo,
    channel: "clinician.vitalcv.health",
    replay: "anchored",
    runId: "7a2c…b8d3",
  };

  const signer: SignerContinuity = {
    did: "did:web:vitalcv.health",
    activeKeyFingerprint: "4f2a · 91c5 · 7e08 · b8d3",
    activeKeyInServiceDays: 190,
    activeKeyRotationDays: 365,
    didDocumentUrl: "/.well-known/did.json",
    statusListUrl: "vitalcv.health/status/v1/list.jsonld",
    backupKeyFingerprint: "8c91 · 0d44",
    backupKeyArmed: true,
    quorumRequired: 5,
    quorumAvailable: 3,
  };

  const chain: ChainNode[] = [
    { hash: "7a2c…b8d3", isHead: true },
    { hash: "9d11…3e4a" },
    { hash: "4b00…f1c2" },
    { hash: "2a17…0e8b" },
  ];

  const claims: Claim[] = [
    {
      object: "CA medical license · A-148293",
      objectSub: "active · no board action",
      ownership: "subject",
      checkedAtIso: w.checkedAtIso,
      checkedAgo: w.checkedAgo,
      source: "CA Medical Board",
      sourceSub: "authoritative · live",
      tier: "T3",
      receiptId: "#48,214",
      receiptHash: "9d11…3e4a",
    },
    {
      object: "DEA registration · BC4821739",
      objectSub: "schedule II–V · expires 2029-04-30",
      ownership: "subject",
      checkedAtIso: "14:31:42Z",
      checkedAgo: "26 s ago",
      source: "DEA CSOS",
      sourceSub: "issuer-signed VC",
      tier: "T4",
      receiptId: "#48,213",
      receiptHash: "7a2c…b8d3",
    },
    {
      object: "OIG-LEIE · no adverse findings",
      objectSub: "exclusion list · 0 records",
      ownership: "subject",
      checkedAtIso: "14:31:55Z",
      checkedAgo: "13 s ago",
      source: "OIG · HHS",
      sourceSub: "federal authority · live",
      tier: "T3",
      receiptId: "#48,215",
      receiptHash: "4b00…f1c2",
      noAdverseFindings: true,
    },
    {
      object: "PECOS enrollment · active",
      objectSub: "last value · upstream degraded",
      ownership: "subject",
      checkedAtIso: "14:29:14Z",
      checkedAgo: "2 m 54 s",
      source: "PECOS · CMS",
      sourceSub: "degraded · p95 5.8 s",
      tier: "T3",
      receiptId: "#48,212",
      receiptHash: "2a17…0e8b",
      degraded: true,
    },
  ];

  const verdict: Verdict = {
    state: "verifiable",
    headline: "Verifiable",
    facts: ["4 of 4 lanes signed", "3 fresh · 1 stale-but-signed", "0 revocations", "0 adverse findings"],
    readTime: "≈ 30 s",
  };

  const control: SurfaceControl = {
    form: `VC-PASSPORT-v1 · npi-${npi}`,
    title: "Provider passport",
    classification: "HOLDER-BOUND · SIGNED",
    effective: w.checkedAtIso,
    revision: "rev 11 · 2026-05-11",
    controlledBy: "did:web:vitalcv.health",
    state: "signed",
  };

  return { control, lineage, signer, chain, claims, verdict };
}
// =============================================================================

export default async function PassportPage({
  params,
}: {
  params: { npi: string };
}) {
  const { control, lineage, signer, chain, claims, verdict } = await getPassport(params.npi);

  return (
    <>
      <SurfaceHeader control={control} lineage={lineage} />

      <div style={{ marginTop: 14 }}>
        <VerdictBar verdict={verdict} />
      </div>

      <SectionHeader n="01" title="Active claims" ey="trust-first column order" />
      <div className="t-facts">
        <div className="h">
          <div className="c">Tier</div>
          <div className="c">Ownership</div>
          <div className="c">checked_at</div>
          <div className="c">Claim</div>
          <div className="c">Source</div>
          <div className="c">Receipt</div>
        </div>
        {claims.map((c) => (
          <DegradedRow key={c.receiptId} degraded={c.degraded}>
            <div className="r">
              <div className="c"><TierBadge tier={c.tier} /></div>
              <div className="c"><OwnershipBadge state={c.ownership} /></div>
              <div className="c"><CheckedAt iso={c.checkedAtIso} relative={c.checkedAgo} /></div>
              <div className="c">
                <span className="claim">
                  {c.object}
                  {c.objectSub && <span className="sub">{c.objectSub}</span>}
                </span>
              </div>
              <div className="c">
                <span className="src">
                  {c.source}
                  {c.sourceSub && <span className="sub">{c.sourceSub}</span>}
                </span>
              </div>
              <div className="c">
                <span className="rcpt">
                  {c.receiptId}
                  <span className="sub">{c.receiptHash}</span>
                </span>
              </div>
            </div>
          </DegradedRow>
        ))}
      </div>

      <SectionHeader n="02" title="Issuer continuity" ey="signer · status list · backup" />
      <SignaturePanel signer={signer} />

      <SectionHeader n="03" title="Replay lineage" ey="chain head 7a2c…b8d3" />
      <ChainStrip nodes={chain} meta="4 receipts · 0 gaps" />

      <LineageFooter lineage={lineage} />

      <SurfaceControlFooter
        control={control}
        lineage={lineage}
        verifyUrl={`verify.vitalcv.health/passport/${params.npi}`}
        pageOf={{ n: 1, of: 1 }}
      />
    </>
  );
}
