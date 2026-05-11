/**
 * W4-PR249A — wire ProofManifestPanel into /passport/[id] lockdown.
 *
 * Pins the source-level wiring of the ProofManifestPanel into the
 * passport entity page so the panel surface (shipped in #309) is
 * actually consumed and the loop does not silently regress.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const CLIENT_SRC = readFileSync(
  resolve(__dirname, '../app/passport/[id]/PassportEntityClient.tsx'),
  'utf8',
);

describe('W4-PR249A — ProofManifestPanel is wired into /passport/[id]', () => {
  it('imports ProofManifestPanel from the panel module shipped in #309', () => {
    expect(CLIENT_SRC).toContain("import { ProofManifestPanel } from '@/components/proof/ProofManifestPanel';");
  });

  it('renders the panel inside the page (not commented out)', () => {
    // The panel render call must NOT be inside a comment block.
    const renderMatch = CLIENT_SRC.match(/<ProofManifestPanel[\s\S]*?\/>/);
    expect(renderMatch).not.toBeNull();
  });

  it('wraps the panel in a section with the documented testid + aria-label', () => {
    expect(CLIENT_SRC).toContain('data-testid="passport-proof-manifest-mount"');
    expect(CLIENT_SRC).toContain('aria-label="Proof manifest"');
  });

  it('passes the passport.manifest field structurally (typed as optional unknown)', () => {
    // The cast `(passport as { manifest?: unknown }).manifest` is the
    // truth-contract-correct shape: PassportData on origin/main does
    // not have a manifest field yet, but the panel handles undefined
    // by rendering its `manifestIncomplete=true` ambiguity-visible
    // state. This pin prevents someone from silently swapping in
    // synthesized data.
    expect(CLIENT_SRC).toMatch(/passport\s+as\s+\{\s*manifest\?:\s*unknown\s*\}\)\.manifest/);
  });
});

describe('W4-PR249A — no fake-manifest synthesis', () => {
  it('does NOT pass a hardcoded manifest object to the panel', () => {
    // Forbid passing a literal { ... } object as the manifest prop.
    expect(CLIENT_SRC).not.toMatch(/<ProofManifestPanel\s+manifest=\{\s*\{/);
  });

  it('does NOT pass any well-known mock id (sample / fixture / demo)', () => {
    const renderBlock = CLIENT_SRC.match(/<ProofManifestPanel[\s\S]*?\/>/);
    expect(renderBlock).not.toBeNull();
    const block = renderBlock?.[0] ?? '';
    expect(block).not.toMatch(/sample|fixture|demo|mock/i);
  });
});

describe('W4-PR249A — banned-strings scan on the touched file', () => {
  const BANNED = [
    ['automatically', 'verified'].join(' '),
    ['guaranteed', 'verification'].join(' '),
    ['complete', 'credentialing'].join(' '),
    ['instant', 'credentialing'].join(' '),
    ['legally', 'accepted'].join(' '),
    ['risk', 'transferred'].join(' '),
    ['HIPAA', 'compliant'].join(' '),
    ['SOC2', 'certified'].join(' '),
    ['certified', 'compliant'].join(' '),
  ];
  it.each(BANNED)('PassportEntityClient.tsx does not contain banned phrase: %s', (phrase) => {
    expect(CLIENT_SRC).not.toContain(phrase);
  });
});

describe('W4-PR249A — wiring preserves existing surfaces', () => {
  it('LaneHealthMount section is still rendered', () => {
    expect(CLIENT_SRC).toContain('data-testid="passport-lane-health-mount"');
    expect(CLIENT_SRC).toContain('<LaneHealthMount heading="Source health" />');
  });

  it('Knowledge Inbox section is still rendered', () => {
    expect(CLIENT_SRC).toContain('data-testid="passport-knowledge-inbox-mount"');
    expect(CLIENT_SRC).toContain('<KnowledgeInboxPanel');
  });

  it('PassportWallet at top of layout is still rendered', () => {
    expect(CLIENT_SRC).toContain('<PassportWallet passport={passport} />');
  });
});
