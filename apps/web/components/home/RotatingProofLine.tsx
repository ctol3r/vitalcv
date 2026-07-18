import * as React from 'react';

/**
 * RotatingProofLine — a kinetic "reusable evidence" beat (Chris, 2026-07-18),
 * built on the UIverse word-cycler loader (kennyotsu, MIT): "Carry your
 * {identity → licensure → specialty → recognition} forward." The rotating
 * column is decorative — the sr-only phrase is the honest, complete meaning, so
 * screen readers and no-motion users get a real sentence, not a stream of
 * words. The words are actual evidence lanes VitalCV carries; nothing here
 * asserts an outcome.
 */

// Four distinct lanes + the first repeated, so the CSS loop wraps seamlessly.
const WORDS = ['identity', 'licensure', 'specialty', 'recognition', 'identity'] as const;

export function RotatingProofLine() {
  return (
    <section
      data-home-proof-cycle=""
      aria-label="Carry your source-backed evidence forward"
      className="mt-14 flex justify-center"
    >
      <p className="proofcycle">
        <span>Carry your</span>
        <span className="proofcycle-words" aria-hidden="true">
          {WORDS.map((word, i) => (
            <span key={i} className="proofcycle-word">{word}</span>
          ))}
        </span>
        <span>forward.</span>
        <span className="sr-only">Carry your source-backed evidence forward.</span>
      </p>
    </section>
  );
}

export default RotatingProofLine;
