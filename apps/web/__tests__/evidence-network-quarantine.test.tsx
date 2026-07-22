/**
 * evidence-network-quarantine.test.tsx — SHD-0.3 (P0).
 *
 * The public /evidence-network route previously mounted the explorable
 * force-directed graph: a synthetic clinician roster ("Dr. …" nodes) plus
 * physics/debug controls. That must never return to public reach. This suite
 * pins the quarantine:
 *   - no synthetic clinician-like name (derived from the ACTUAL dataset, so a
 *     roster edit cannot dodge the guard) renders on the public page;
 *   - no graph physics/debug control vocabulary renders;
 *   - the page source imports no career-graph component and the old client
 *     mount is gone;
 *   - the page states plainly that it shows the evidence MODEL, not people;
 *   - honest access-gated language survives; no bare "Verified".
 *
 * The interactive graph remains legitimate ONLY on signed-in product surfaces
 * (e.g. /clinician/graph) — that is intentionally out of scope here.
 */

import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import EvidenceNetworkPage from '@/app/evidence-network/page';

const APP_DIR = path.resolve(process.cwd(), 'app');
const PAGE_SOURCE = fs.readFileSync(
  path.join(APP_DIR, 'evidence-network/page.tsx'),
  'utf8',
);
// Synthetic roster moved to a test fixture (C2): it used to sit in
// `components/career-graph/data.ts`, importable from product code. This guard
// still reads it as the SOURCE of names to prove none of them render.
const GRAPH_DATA_SOURCE = fs.readFileSync(
  path.resolve(process.cwd(), '__tests__/fixtures/career-graph-roster.ts'),
  'utf8',
);

const html = renderToStaticMarkup(<EvidenceNetworkPage />);

/** Every synthetic clinician-like name in the graph dataset, both quote styles. */
function syntheticRosterNames(): string[] {
  const names: string[] = [];
  const re = /name:\s*(['"])(Dr\.[^'"]+)\1/g;
  for (let m = re.exec(GRAPH_DATA_SOURCE); m; m = re.exec(GRAPH_DATA_SOURCE)) {
    names.push(m[2]);
  }
  return names;
}

describe('SHD-0.3 — public /evidence-network quarantine', () => {
  it('the synthetic roster extraction itself works (guard cannot silently rot)', () => {
    const names = syntheticRosterNames();
    // The dataset ships a roster; if it shrinks to nothing the regex broke.
    expect(names.length).toBeGreaterThanOrEqual(10);
    expect(names).toContain('Dr. A. Okafor');
  });

  it('renders no synthetic clinician-like identity from the graph dataset', () => {
    for (const name of syntheticRosterNames()) {
      const surname = name.split(/\s+/).pop() as string;
      expect(html, `full name "${name}" leaked`).not.toContain(name);
      expect(html, `surname "${surname}" leaked`).not.toContain(surname);
    }
    // Belt and suspenders: no person-like honorific renders at all.
    expect(html).not.toMatch(/Dr\.\s/);
  });

  it('renders no graph physics/debug control vocabulary', () => {
    for (const control of [
      'Repel force',
      'Link force',
      'Center force',
      'Link distance',
      'Node size',
      'force-directed',
      'Loading the network',
    ]) {
      expect(html, `control "${control}" leaked`).not.toContain(control);
    }
  });

  it('imports no career-graph component; the old client mount is deleted', () => {
    expect(PAGE_SOURCE).not.toContain('career-graph');
    expect(PAGE_SOURCE).not.toContain('EvidenceNetworkMount');
    expect(
      fs.existsSync(path.join(APP_DIR, 'evidence-network/EvidenceNetworkMount.tsx')),
    ).toBe(false);
  });

  it('states plainly that it describes the model, never real people', () => {
    expect(html).toContain('data-evidence-model-disclaimer');
    expect(html).toContain(
      'does not show live clinician relationships, real people, or completed',
    );
    // The route is a transparency surface, not a claim of live records.
    expect(html).toContain('evidence model');
  });

  it('keeps the honest source boundaries and canonical vocabulary', () => {
    expect(html).toContain('access-gated');
    // The canonical provenance legend renders as vocabulary (not results).
    expect(html).toContain('data-provenance-legend');
    expect(html).toContain('data-provenance-state="checked"');
    expect(html).toContain('data-provenance-state="revoked"');
    // Head-start boundary language survives.
    expect(html).toContain('head start');
    expect(html).toMatch(/hiring authority remain|review remains|remain with the institution/);
  });

  it('never renders the bare status word "Verified"', () => {
    expect(/>\s*Verified\s*</.test(html)).toBe(false);
  });

  // SHD-2.3: the abstract evidence-model visual — system concepts only.
  it('renders the evidence-model map as a decorative, concept-only diagram', () => {
    expect(html).toContain('data-evidence-model-map');
    expect(html).toContain('role="img"'); // summarised for assistive tech
    // The map is a diagram of concepts, explicitly not people.
    expect(html).toMatch(/system concepts only — no clinicians/i);
    // Concept legend labels, not identities.
    expect(html).toContain('Consented proof packet');
    expect(html).toContain('Bounded employer Recognition');
    // The topology carries no <canvas> and no synthetic identity.
    expect(html).not.toContain('<canvas');
  });
});
