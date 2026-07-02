// VitalCV · Trust Surfaces · Priority 5 · Trust State Register
// System self-view. Shows live state for signed / degraded / anonymous /
// issuer-unavailable / replay-continuity / ownership-continuity.

import * as React from "react";
import type { Lineage, SignerContinuity, FailureBannerData } from "@/lib/trust/types";
import { lineageWhen } from "@/lib/trust/format";
import { LineageFooter } from "@/components/trust/LineageHeader";
import { SurfaceHeader, SurfaceControlFooter, type SurfaceControl } from "@/components/trust/SurfaceHeader";
import { SignaturePanel } from "@/components/trust/SignaturePanel";
import { FailureBanner } from "@/components/trust/FailureBanner";
import { SectionHeader, IdRender } from "@/components/trust/primitives";

// === STUB ====================================================================
async function getTrustState() {
  const now = new Date();
  const w = lineageWhen(new Date(now.getTime() - 10_000).toISOString(), now);

  const lineage: Lineage = {
    state: "signed",
    object: "Trust state · VitalCV runtime",
    objectSub: "signer · sources · replay · ownership",
    ownership: "delegated",
    checkedAtIso: w.checkedAtIso,
    checkedAgo: w.checkedAgo,
    channel: "trust.vitalcv.health",
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

  const banners: FailureBannerData[] = [
    {
      mode: "D",
      title: "OIG-LEIE · no adverse findings",
      cause: "Federal exclusion list returned 0 records · this is success, not absence of data",
      owner: "no one · system worked",
      cta: { label: "Receipt #48,215", href: "/receipt/48215" },
    },
    {
      mode: "A",
      title: "PECOS · degraded",
      cause: "Upstream p95 5.8 s · last value rendered with stale-flag · receipt records degraded=true",
      owner: "upstream · CMS",
      cta: { label: "Retry now" },
    },
    {
      mode: "B",
      title: "DEA full registration · sign-in required",
      cause: "Lane gated to subject-authenticated sessions · no claim asserted in anonymous mode",
      owner: "policy",
      cta: { label: "Sign in →", href: "/login" },
    },
    {
      mode: "C",
      title: "Wallet API · 12 m outage",
      cause: "VitalCV-side · existing signed receipts unaffected · verifiable offline against did:web",
      owner: "VitalCV · inc-2026-0511-c",
      cta: { label: "status.vitalcv.health" },
    },
    {
      mode: "E",
      title: "Issuer signing key · all systems nominal",
      cause: "key 4f2a active · backup 8c91 armed · quorum 3 of 5 available · no rotation pending",
      owner: "VitalCV · keyholder quorum",
    },
  ];

  const control: SurfaceControl = {
    form: "VC-TRUST-STATE-v1",
    title: "Trust state register",
    classification: "PUBLIC · SIGNED",
    effective: w.checkedAtIso,
    revision: "rev 11 · 2026-05-11",
    controlledBy: "did:web:vitalcv.health",
    state: "signed",
  };

  return { control, lineage, signer, banners };
}
// =============================================================================

export default async function TrustPage() {
  const { control, lineage, signer, banners } = await getTrustState();

  return (
    <>
      <SurfaceHeader control={control} lineage={lineage} />

      <SectionHeader n="01" title="Issuer continuity" ey="the signing path is the trust path" />
      <SignaturePanel signer={signer} />

      <SectionHeader
        n="02"
        title="Operational state · five failure modes"
        ey="never collapsed into &lsquo;something went wrong&rsquo;"
      />
      <div style={{ display: "grid", gap: 12 }}>
        {banners.map((b) => (
          <FailureBanner key={b.mode + b.title} data={b} />
        ))}
      </div>

      <LineageFooter lineage={lineage} />

      <SurfaceControlFooter
        control={control}
        lineage={lineage}
        verifyUrl="verify.vitalcv.health/state"
        pageOf={{ n: 1, of: 1 }}
      />
    </>
  );
}
