// VitalCV · Trust Surfaces · LineageHeader
// Canon v1 · §02 — renders the binding reading order on every verifier-facing surface.
// OBJECT → OWNERSHIP → CHECKED_AT → CHANNEL → REPLAY → RUN_ID

import * as React from "react";
import type { Lineage } from "@/lib/trust/types";
import { OwnershipBadge, ReplayChip } from "./primitives";

export function LineageHeader({ lineage }: { lineage: Lineage }) {
  return (
    <section
      className="t-lineage"
      data-state={lineage.state}
      aria-label="Trust lineage header"
    >
      <header className="hd">
        <span>
          <strong>Lineage</strong> · object → ownership → checked_at → channel → replay → run_id
        </span>
        <span>state · {lineage.state}</span>
      </header>
      <div className="cells">
        <div className="cell">
          <div className="k">Object</div>
          <div className="v">
            {lineage.object}
            {lineage.objectSub && <span className="sub">{lineage.objectSub}</span>}
          </div>
        </div>
        <div className="cell">
          <div className="k">Ownership</div>
          <div className="v" style={{ paddingTop: 2 }}>
            <OwnershipBadge state={lineage.ownership} />
          </div>
        </div>
        <div className="cell">
          <div className="k">checked_at</div>
          <div className="v">
            {lineage.checkedAtIso}
            <span className="sub">{lineage.checkedAgo}</span>
          </div>
        </div>
        <div className="cell">
          <div className="k">Channel</div>
          <div className="v">
            {lineage.channel}
            <span className="sub">rendered through</span>
          </div>
        </div>
        <div className="cell">
          <div className="k">Replay</div>
          <div className="v" style={{ paddingTop: 2 }}>
            <ReplayChip state={lineage.replay} />
          </div>
        </div>
        <div className="cell">
          <div className="k">run_id</div>
          <div className="v" title={lineage.runId}>
            {lineage.runId}
            <span className="sub">batch · committed</span>
          </div>
        </div>
      </div>
    </section>
  );
}

/** The compact bottom anchor — same primitives, single line, no labels. */
export function LineageFooter({ lineage }: { lineage: Lineage }) {
  return (
    <footer
      className="t-lineage"
      data-state={lineage.state}
      style={{ marginTop: 16 }}
      aria-label="Trust lineage footer (anchor)"
    >
      <div className="cells">
        <div className="cell">
          <div className="k">Object</div>
          <div className="v" style={{ fontSize: 11 }}>{lineage.object}</div>
        </div>
        <div className="cell">
          <div className="k">Ownership</div>
          <div className="v" style={{ paddingTop: 2 }}>
            <OwnershipBadge state={lineage.ownership} />
          </div>
        </div>
        <div className="cell">
          <div className="k">checked_at</div>
          <div className="v" style={{ fontSize: 11 }}>{lineage.checkedAtIso}</div>
        </div>
        <div className="cell">
          <div className="k">Channel</div>
          <div className="v" style={{ fontSize: 11 }}>{lineage.channel}</div>
        </div>
        <div className="cell">
          <div className="k">Replay</div>
          <div className="v" style={{ paddingTop: 2 }}>
            <ReplayChip state={lineage.replay} />
          </div>
        </div>
        <div className="cell">
          <div className="k">run_id</div>
          <div className="v" style={{ fontSize: 11 }}>{lineage.runId}</div>
        </div>
      </div>
    </footer>
  );
}
