// VitalCV · Trust Surfaces · ChainStrip
// Canon v1 · §05 — replay continuity. Arrow direction always this ← prev.

import * as React from "react";
import type { ChainNode } from "@/lib/trust/types";

export function ChainStrip({
  nodes,
  label = "Replay lineage",
  meta,
  tone = "light",
}: {
  /** ordered head → tail (most recent first) */
  nodes: ChainNode[];
  label?: string;
  meta?: string;
  tone?: "light" | "inverted";
}) {
  return (
    <section className="t-chain" data-tone={tone} aria-label={label}>
      <header className="hd">
        <span>
          <strong>{label}</strong> · chain-linked · RFC 3161 anchored · re-verifiable offline
        </span>
        {meta && <span>{meta}</span>}
      </header>
      <div className="body">
        {nodes.map((n, i) => (
          <React.Fragment key={n.hash + i}>
            <span className="tok" data-now={n.isHead ? "true" : undefined} title={n.hash}>
              {n.hash}
            </span>
            {i < nodes.length - 1 && <span className="arr" aria-hidden>←</span>}
          </React.Fragment>
        ))}
      </div>
    </section>
  );
}
