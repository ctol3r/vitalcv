// VitalCV · Trust Surfaces · Priority 3 · Replay Memory
// Holder-facing. Renders previous checks as EVIDENCE — chain-linked, not analytics.

import * as React from "react";
import type { Lineage, ChainNode, ReplayCheck } from "@/lib/trust/types";
import { lineageWhen } from "@/lib/trust/format";
import { LineageFooter } from "@/components/trust/LineageHeader";
import { SurfaceHeader, SurfaceControlFooter, type SurfaceControl } from "@/components/trust/SurfaceHeader";
import { ChainStrip } from "@/components/trust/ChainStrip";
import { SectionHeader, IdRender } from "@/components/trust/primitives";

// === STUB ====================================================================
async function getReplayMemory() {
  const now = new Date();
  const w = lineageWhen(new Date(now.getTime() - 10_000).toISOString(), now);
  const lineage: Lineage = {
    state: "signed",
    object: "Replay memory · Mira Chen, MD",
    objectSub: "14 checks · 14 receipts · 0 gaps",
    ownership: "subject",
    checkedAtIso: w.checkedAtIso,
    checkedAgo: w.checkedAgo,
    channel: "clinician.vitalcv.health",
    replay: "anchored",
    runId: "7a2c…b8d3",
  };

  const chain: ChainNode[] = [
    { hash: "7a2c…b8d3", isHead: true },
    { hash: "9d11…3e4a" },
    { hash: "4b00…f1c2" },
    { hash: "2a17…0e8b" },
    { hash: "f1c2…2a17" },
  ];

  const checks: ReplayCheck[] = [
    { whenIso: w.checkedAtIso, whenAgo: "10 s ago", what: "Full passport refresh", whatSub: "4 sources · 1 degraded (PECOS) · run 7a2c…b8d3", receiptId: "#48,214", prevHash: "9d11…", current: true },
    { whenIso: "May 04 09:14Z", whenAgo: "7 d ago", what: "Scheduled weekly refresh", whatSub: "4 sources live · all confirmed · run 9d11…3e4a", receiptId: "#48,108", prevHash: "4b00…" },
    { whenIso: "Apr 27 09:14Z", whenAgo: "14 d ago", what: "DEA renewal observed", whatSub: "status went renewed → confirmed", receiptId: "#47,891", prevHash: "2a17…" },
    { whenIso: "Apr 20 09:14Z", whenAgo: "21 d ago", what: "Scheduled weekly refresh", whatSub: "PECOS unreachable for 4 m 12 s · degradation recorded", receiptId: "#47,612", prevHash: "f1c2…", degraded: true },
    { whenIso: "Apr 13 09:14Z", whenAgo: "28 d ago", what: "CE hours updated", whatSub: "holder upload · 26 → 32 hrs · cycle 2024–2026", receiptId: "#47,224", prevHash: "8c91…" },
  ];

  const control: SurfaceControl = {
    form: "VC-REPLAY-v1",
    title: "Replay memory",
    classification: "HOLDER-BOUND · SIGNED",
    effective: w.checkedAtIso,
    revision: "rev 11 · 2026-05-11",
    controlledBy: "did:web:vitalcv.health",
    state: "signed",
  };

  return { control, lineage, chain, checks };
}
// =============================================================================

export default async function ReplayPage() {
  const { control, lineage, chain, checks } = await getReplayMemory();

  return (
    <>
      <SurfaceHeader control={control} lineage={lineage} />

      <SectionHeader n="01" title="Continuity" ey="chain-linked · 0 gaps" />
      <ChainStrip nodes={chain} meta="14 receipts · 0 gaps · holder-controlled retention" />

      <SectionHeader n="02" title="Previous checks" ey="every prior check is replayable" />
      <div className="t-facts">
        <div className="h" style={{ gridTemplateColumns: "120px 1fr 140px 140px" }}>
          <div className="c">When</div>
          <div className="c">What</div>
          <div className="c">Receipt</div>
          <div className="c">Prev hash</div>
        </div>
        {checks.map((c) => (
          <div
            key={c.receiptId}
            className="r"
            style={{
              gridTemplateColumns: "120px 1fr 140px 140px",
              background: c.current ? "var(--ink-50)" : c.degraded ? "var(--ink-50)" : undefined,
            }}
          >
            <div className="c">
              <span className="t-when">
                {c.whenIso}
                <span className="sub">{c.whenAgo}</span>
              </span>
            </div>
            <div className="c">
              <span className="claim">
                {c.what}
                <span className="sub">{c.whatSub}</span>
              </span>
            </div>
            <div className="c">
              <span className="rcpt">{c.receiptId}</span>
            </div>
            <div className="c">
              <IdRender value={c.prevHash} />
            </div>
          </div>
        ))}
      </div>

      <LineageFooter lineage={lineage} />

      <SurfaceControlFooter
        control={control}
        lineage={lineage}
        verifyUrl="verify.vitalcv.health/replay"
        pageOf={{ n: 1, of: 1 }}
      />
    </>
  );
}
