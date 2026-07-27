/**
 * Page artifacts — one animated evidence drawing per public page.
 *
 * The founder's mandate: "nearly all pages should have an animated visual."
 * These extend the homepage's artifact grammar (see artifact-motion.css and
 * the CheckRun/Packet artifacts in AskHome) to the other acquisition-path
 * pages. Server-safe pure SVG; mount inside <ArtifactStage> for the
 * play-once-then-rest entry.
 *
 * The honesty grammar is the same everywhere and is pinned by
 * page-artifacts.test.tsx: <text> carries PART names only — never a source
 * name, a state word, or a freshness word. Value-shaped marks are redacted
 * bars; the shape of an answer without fabricating one.
 */

import * as React from 'react';

/**
 * /employers — the reviewer's decision surface. A packet arrives, claim rows
 * carry their meta lines, and the three actions a reviewer actually has
 * (recognize / request / advance) wait at the bottom. The decision is
 * visibly the reviewer's — three open slots, none pre-selected.
 */
export function DecisionArtifact() {
  return (
    <svg
      viewBox="0 0 720 400"
      className="ask-art ask-art--wide"
      role="img"
      aria-label="A consented packet arriving in a reviewer's worklist: claim rows with their sources and times, and three reviewer actions — recognize, request, advance — none pre-selected"
    >
      {/* the packet, small, arriving from the left */}
      <rect x="40" y="80" width="150" height="200" rx="4" className="ask-art-paper ask-art-step-1" />
      <line x1="60" y1="112" x2="170" y2="112" className="ask-art-rule ask-art-step-1" />
      {[136, 158].map((y) => (
        <line key={y} x1="60" y1={y} x2={y === 158 ? 130 : 170} y2={y} className="ask-art-line ask-art-step-1" />
      ))}
      <circle cx="158" cy="248" r="14" className="ask-art-seal ask-art-step-1" />
      <text x="60" y="72" className="ask-art-label ask-art-step-1">
        one packet
      </text>
      <path d="M190 180 H250" className="ask-art-rule ask-art-flow ask-art-step-2" />
      {/* the worklist surface */}
      <rect x="250" y="36" width="430" height="328" rx="4" className="ask-art-paper-2 ask-art-step-2" />
      <text x="274" y="28" className="ask-art-label ask-art-step-2">
        your worklist
      </text>
      {/* claim rows */}
      {[
        { y: 76, step: 3 },
        { y: 136, step: 3 },
        { y: 196, step: 4 },
      ].map((r, i) => (
        <g key={i}>
          <line x1="274" y1={r.y} x2="560" y2={r.y} className={`ask-art-line ask-art-step-${r.step}`} />
          <line x1="274" y1={r.y + 20} x2="450" y2={r.y + 20} className={`ask-art-meta ask-art-step-${r.step}`} />
          <circle cx="628" cy={r.y + 8} r="12" className={`ask-art-seal ask-art-step-${r.step}`} />
        </g>
      ))}
      {/* the three actions — open slots, the reviewer's to take */}
      {[
        { x: 274, label: 'recognize' },
        { x: 414, label: 'request' },
        { x: 554, label: 'advance' },
      ].map((a) => (
        <g key={a.label}>
          <rect x={a.x} y={288} width={112} height={34} rx={17} className="ask-art-slot ask-art-step-5" />
          <text x={a.x + 56} y={309} textAnchor="middle" className="ask-art-label ask-art-step-5">
            {a.label}
          </text>
        </g>
      ))}
      <text x="274" y="352" className="ask-art-note ask-art-step-6">
        your decision, your committee
      </text>
    </svg>
  );
}

/**
 * /trust — inspectability itself. One claim, the chain it hangs from
 * (its source, the receipt), and the open door at the end: anyone can
 * check. The flow draws left-to-right because that is the product's whole
 * argument — a claim travels WITH its provenance.
 */
export function ReceiptArtifact() {
  return (
    <svg
      viewBox="0 0 720 300"
      className="ask-art ask-art--wide"
      role="img"
      aria-label="One claim connected to its named source and its receipt, ending at an open verification door: anyone can check the chain themselves"
    >
      {/* the claim */}
      <rect x="40" y="110" width="170" height="80" rx="4" className="ask-art-paper ask-art-step-1" />
      <line x1="62" y1="142" x2="188" y2="142" className="ask-art-line ask-art-step-1" />
      <line x1="62" y1="162" x2="150" y2="162" className="ask-art-meta ask-art-step-1" />
      <text x="62" y="102" className="ask-art-label ask-art-step-1">
        a claim
      </text>
      {/* its source */}
      <path d="M210 150 H268" className="ask-art-rule ask-art-flow ask-art-step-2" />
      <rect x="268" y="110" width="170" height="80" rx="4" className="ask-art-paper-2 ask-art-step-2" />
      <line x1="290" y1="142" x2="416" y2="142" className="ask-art-line ask-art-step-2" />
      <line x1="290" y1="162" x2="380" y2="162" className="ask-art-meta ask-art-step-2" />
      <text x="290" y="102" className="ask-art-label ask-art-step-2">
        its source + when
      </text>
      {/* the receipt */}
      <path d="M438 150 H496" className="ask-art-rule ask-art-flow ask-art-step-3" />
      <circle cx="530" cy="150" r="26" className="ask-art-seal ask-art-step-3" />
      <path d="M517 150 l9 9 l17 -20" className="ask-art-tick ask-art-step-3" />
      <text x="506" y="196" className="ask-art-label ask-art-step-3">
        receipt
      </text>
      {/* the open door */}
      <path d="M556 150 H614" className="ask-art-rule ask-art-flow ask-art-step-4" />
      <rect x="614" y="118" width="66" height="64" rx="4" className="ask-art-gap ask-art-step-4" />
      <text x="647" y="206" textAnchor="middle" className="ask-art-label ask-art-step-4">
        anyone
      </text>
      <text x="360" y="260" textAnchor="middle" className="ask-art-note ask-art-step-5">
        check the chain yourself — no account, no permission
      </text>
    </svg>
  );
}

/**
 * /pilot — what the pilot measures. A timeline from offer to start with the
 * at-risk span bracketed. No numbers anywhere: the pilot exists to measure
 * this, and the drawing must not pre-announce a result the product has not
 * earned (projection-vs-measurement rule).
 */
export function MeasureArtifact() {
  return (
    <svg
      viewBox="0 0 720 300"
      className="ask-art ask-art--wide"
      role="img"
      aria-label="A timeline from accepted offer to first day, with the at-risk span in between bracketed as the thing the pilot measures — no numbers, because none have been measured yet"
    >
      {/* the timeline */}
      <line x1="60" y1="150" x2="660" y2="150" className="ask-art-rule ask-art-step-1" />
      {/* offer accepted */}
      <circle cx="100" cy="150" r="8" className="ask-art-seal ask-art-step-1" />
      <text x="100" y="188" textAnchor="middle" className="ask-art-label ask-art-step-1">
        offer accepted
      </text>
      {/* the packet lands early */}
      <rect x="164" y="96" width="64" height="40" rx="3" className="ask-art-paper-2 ask-art-step-2" />
      <line x1="174" y1="112" x2="218" y2="112" className="ask-art-meta ask-art-step-2" />
      <line x1="196" y1="136" x2="196" y2="150" className="ask-art-rule ask-art-step-2" />
      <text x="196" y="88" textAnchor="middle" className="ask-art-label ask-art-step-2">
        packet shared
      </text>
      {/* the at-risk span, bracketed */}
      <path d="M240 206 v14 h360 v-14" className="ask-art-gap ask-art-step-3" />
      <text x="420" y="244" textAnchor="middle" className="ask-art-label ask-art-step-3">
        days at risk
      </text>
      {/* first day */}
      <circle cx="620" cy="150" r="8" className="ask-art-seal ask-art-step-4" />
      <path d="M614 150 l4 4 l8 -9" className="ask-art-tick ask-art-step-4" />
      <text x="620" y="188" textAnchor="middle" className="ask-art-label ask-art-step-4">
        first day
      </text>
      <text x="360" y="282" textAnchor="middle" className="ask-art-note ask-art-step-5">
        the pilot measures this span — before and after
      </text>
    </svg>
  );
}
