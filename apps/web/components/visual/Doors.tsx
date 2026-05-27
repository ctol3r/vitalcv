import Link from 'next/link';
import * as React from 'react';

export type DoorProps = {
  href: string;
  role: string;
  name: string;
  glyph: string;
  desc: string;
  uses: string[];
  cta: string;
};

/**
 * Role-door card. Three of these line up below the hero on `/`.
 *
 * chat22 fix #8 — destinations must be DISTINCT:
 *   Clinician → /passport?npi=...
 *   Reviewer  → /sign-in (then to passport with reviewer role)
 *   Operator  → /status
 *
 * (vs. the prototype which had Reviewer also pointing at the passport,
 * differing only by &role=verifier; the QA correctly flagged that as
 * indistinguishable.)
 */
export function Door({ href, role, name, glyph, desc, uses, cta }: DoorProps) {
  return (
    <Link href={href} className="vs-door">
      <div className="vs-door-hd">
        <span className="vs-door-ic">{glyph}</span>
        <div>
          <div className="vs-door-role">{role}</div>
          <div className="vs-door-nm">{name}</div>
        </div>
      </div>
      <p className="vs-door-desc">{desc}</p>
      <div className="vs-door-uses">
        {uses.map((use) => (
          <span key={use}>{use}</span>
        ))}
      </div>
      <div className="vs-door-cta">{cta}</div>
    </Link>
  );
}

export function Doors({ children }: { children: React.ReactNode }) {
  return <div className="vs-doors">{children}</div>;
}
