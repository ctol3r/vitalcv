// VitalCV · Trust Surfaces · FailureBanner
// Canon v1 · §02 — five distinct surfaces for five modes.
// Mode D (no adverse findings) is SUCCESS — renders solid border, never dashed.

import * as React from "react";
import type { FailureBannerData } from "@/lib/trust/types";

export function FailureBanner({ data }: { data: FailureBannerData }) {
  return (
    <aside className="t-fb" data-mode={data.mode} role="status">
      <Icon mode={data.mode} />
      <div>
        <div className="lb">
          Mode {data.mode} · {data.owner}
        </div>
        <div className="title">{data.title}</div>
        <div style={{ fontSize: 12, marginTop: 4, opacity: 0.85 }}>{data.cause}</div>
      </div>
      {data.cta && (
        <a className="cta" href={data.cta.href ?? "#"}>
          {data.cta.label}
        </a>
      )}
    </aside>
  );
}

function Icon({ mode }: { mode: FailureBannerData["mode"] }) {
  const stroke = mode === "C" || mode === "E" ? "#fff" : "currentColor";
  switch (mode) {
    case "A":
      return (
        <svg width="24" height="24" viewBox="0 0 20 20" fill="none" aria-hidden>
          <path d="M2 10 H18 M10 2 V18" stroke={stroke} strokeWidth="1.4" strokeDasharray="2 2" />
        </svg>
      );
    case "B":
      return (
        <svg width="24" height="24" viewBox="0 0 20 20" fill="none" aria-hidden>
          <circle cx="10" cy="8" r="3.5" stroke={stroke} strokeWidth="1.4" />
          <path d="M5 16 Q10 12 15 16" stroke={stroke} strokeWidth="1.4" fill="none" />
        </svg>
      );
    case "C":
      return (
        <svg width="24" height="24" viewBox="0 0 20 20" fill="none" aria-hidden>
          <rect x="3" y="4" width="14" height="5" stroke={stroke} strokeWidth="1.4" fill="none" />
          <rect x="3" y="11" width="14" height="5" stroke={stroke} strokeWidth="1.4" fill="none" />
          <path d="M15 18 L17 16 M17 18 L15 16" stroke={stroke} strokeWidth="1.4" />
        </svg>
      );
    case "D":
      return (
        <svg width="24" height="24" viewBox="0 0 20 20" fill="none" aria-hidden>
          <circle cx="10" cy="10" r="7" stroke={stroke} strokeWidth="1.4" fill="none" />
          <path d="M6.5 10.5 L9 13 L14 7" stroke={stroke} strokeWidth="1.4" fill="none" strokeLinecap="square" />
        </svg>
      );
    case "E":
      return (
        <svg width="24" height="24" viewBox="0 0 20 20" fill="none" aria-hidden>
          <circle cx="7" cy="7" r="3" stroke={stroke} strokeWidth="1.4" />
          <path d="M9.5 9.5 L17 17" stroke={stroke} strokeWidth="1.4" strokeLinecap="square" />
          <path d="M3 17 L17 3" stroke={stroke} strokeWidth="1.4" />
        </svg>
      );
  }
}
