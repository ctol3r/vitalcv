import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import {
  OPERATIONAL_STATUSES,
  OPERATIONAL_STATUS_DESCRIPTORS,
  describeOperationalStatus,
  listOperationalStatuses,
} from '@/lib/trust/operational-status';
import {
  assertOperationalClaimEvidence,
  auditEvidenceCoverage,
  defineOperationalClaim,
} from '@/lib/trust/assertOperationalClaimEvidence';

// ── Status taxonomy ────────────────────────────────────────────────────────

describe('operational-status taxonomy · closed set', () => {
  it('exposes exactly six canonical statuses', () => {
    expect([...OPERATIONAL_STATUSES].sort()).toEqual(
      [
        'implemented',
        'institution_owned',
        'operator_assisted',
        'pilot_target',
        'planned',
        'unsupported',
      ].sort(),
    );
  });

  it('every status has meaning / uiSemantics / truthContractGuidance / escalation', () => {
    for (const s of listOperationalStatuses()) {
      const d = describeOperationalStatus(s);
      expect(d.meaning.length).toBeGreaterThan(0);
      expect(d.uiSemantics.length).toBeGreaterThan(0);
      expect(d.truthContractGuidance.length).toBeGreaterThan(0);
      expect(d.escalation.length).toBeGreaterThan(0);
    }
  });

  it('"implemented" requires evidence per the doctrine', () => {
    const d = OPERATIONAL_STATUS_DESCRIPTORS.implemented;
    expect(d.truthContractGuidance).toMatch(/banned phrases/i);
  });

  it('"unsupported" forbids implying availability under any qualifier', () => {
    const d = OPERATIONAL_STATUS_DESCRIPTORS.unsupported;
    expect(d.truthContractGuidance).toMatch(/never imply availability/i);
  });
});

// ── Evidence-bound claim helper ────────────────────────────────────────────

describe('assertOperationalClaimEvidence · evidence requirement', () => {
  it('flags "implemented" claims without evidence as evidenceRequired', () => {
    const c = assertOperationalClaimEvidence({
      capability: 'NPI resolution',
      status: 'implemented',
    });
    expect(c.evidenceRequired).toBe(true);
    expect(c.hasEvidence).toBe(false);
  });

  it('flags "operator_assisted" claims without evidence as evidenceRequired', () => {
    const c = assertOperationalClaimEvidence({
      capability: 'Tunnel host pinning',
      status: 'operator_assisted',
    });
    expect(c.evidenceRequired).toBe(true);
  });

  it('does not require evidence for institution_owned / pilot_target / planned / unsupported', () => {
    for (const status of [
      'institution_owned',
      'pilot_target',
      'planned',
      'unsupported',
    ] as const) {
      const c = assertOperationalClaimEvidence({
        capability: 'X',
        status,
      });
      expect(c.evidenceRequired).toBe(false);
    }
  });

  it('passes evidence through unchanged when supplied', () => {
    const c = assertOperationalClaimEvidence({
      capability: 'NPI resolution',
      status: 'implemented',
      evidence: 'apps/web/app/api/resolve-npi/route.ts',
    });
    expect(c.evidence).toBe('apps/web/app/api/resolve-npi/route.ts');
    expect(c.hasEvidence).toBe(true);
  });

  it('treats empty / whitespace evidence as absent', () => {
    const c = assertOperationalClaimEvidence({
      capability: 'X',
      status: 'implemented',
      evidence: '   ',
    });
    expect(c.hasEvidence).toBe(false);
  });
});

describe('auditEvidenceCoverage · CI guard', () => {
  it('returns the empty list when every required claim has evidence', () => {
    const claims = [
      defineOperationalClaim({
        capability: 'A',
        status: 'implemented',
        evidence: 'apps/web/x.ts',
      }),
      defineOperationalClaim({
        capability: 'B',
        status: 'pilot_target',
      }),
    ];
    expect(auditEvidenceCoverage(claims)).toEqual([]);
  });

  it('returns the failing claims when evidence is missing', () => {
    const ok = defineOperationalClaim({
      capability: 'A',
      status: 'implemented',
      evidence: 'apps/web/x.ts',
    });
    const failing = defineOperationalClaim({
      capability: 'B',
      status: 'operator_assisted',
    });
    const audit = auditEvidenceCoverage([ok, failing]);
    expect(audit).toHaveLength(1);
    expect(audit[0].capability).toBe('B');
  });
});

// ── Boundary doc presence ──────────────────────────────────────────────────

describe('operational-capability-boundaries doc', () => {
  const docPath = path.resolve(
    __dirname,
    '..',
    '..',
    '..',
    'docs',
    'ops',
    'operational-capability-boundaries.md',
  );

  it('ships at docs/ops/operational-capability-boundaries.md', () => {
    expect(fs.existsSync(docPath)).toBe(true);
  });

  it('declares all six statuses', () => {
    const md = fs.readFileSync(docPath, 'utf8');
    for (const s of OPERATIONAL_STATUSES) {
      expect(md).toContain(`\`${s}\``);
    }
  });

  it('lists banned phrases (CLAUDE.md truth contract surface)', () => {
    const md = fs.readFileSync(docPath, 'utf8');
    expect(md).toMatch(/HIPAA compliant/);
    expect(md).toMatch(/SOC2 certified/);
    expect(md).toMatch(/instant verification/);
    expect(md).toMatch(/immutable ledger/);
  });
});

// ── Rendered-route truth audit ─────────────────────────────────────────────

describe('rendered-route truth audit · banned phrase grep', () => {
  // Scans production code under apps/web/{app,components} for banned
  // phrases. Strips line and block comments first so that documentation
  // about banned phrases is not itself a violation.
  //
  // Test files and the _archive/ tree are exempt: tests guard against
  // regressions, and archive code is not rendered.

  const ROOTS = [
    path.resolve(__dirname, '..', 'app'),
    path.resolve(__dirname, '..', 'components'),
  ];

  const BANNED_RENDERED_PHRASES = [
    'fully verified',
    'fully automated',
    'cryptographically guaranteed',
    'federally integrated',
    'immutable ledger',
    'military-grade',
    'enterprise-grade encryption',
    'fully compliant',
    'magical onboarding',
    'magical automation',
  ] as const;

  const EXCLUDED_DIR_SUBSTR = [
    `${path.sep}_archive${path.sep}`,
    `${path.sep}__tests__${path.sep}`,
    `${path.sep}node_modules${path.sep}`,
    `${path.sep}.next${path.sep}`,
  ];

  function walk(dir: string, files: string[] = []): string[] {
    if (!fs.existsSync(dir)) return files;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (EXCLUDED_DIR_SUBSTR.some((s) => full.includes(s))) continue;
      if (entry.isDirectory()) {
        walk(full, files);
      } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
        files.push(full);
      }
    }
    return files;
  }

  function stripComments(src: string): string {
    return src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '');
  }

  it('no banned phrase appears in rendered apps/web/{app,components}', () => {
    const hits: { file: string; phrase: string; line: number }[] = [];
    const files = ROOTS.flatMap((r) => walk(r));
    for (const f of files) {
      const stripped = stripComments(fs.readFileSync(f, 'utf8'));
      const lines = stripped.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const lower = lines[i].toLowerCase();
        for (const phrase of BANNED_RENDERED_PHRASES) {
          if (lower.includes(phrase)) {
            hits.push({ file: f, phrase, line: i + 1 });
          }
        }
      }
    }
    if (hits.length > 0) {
      const report = hits
        .map(
          (h) =>
            `  ${path.relative(process.cwd(), h.file)}:${h.line}  ${h.phrase}`,
        )
        .join('\n');
      throw new Error(
        `Truth-contract violations (${hits.length}). Replace with operational-status taxonomy copy.\n${report}`,
      );
    }
    expect(hits).toEqual([]);
  });
});
