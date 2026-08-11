/**
 * governance-citability.test.ts — Wave 1080.
 *
 * EC-21 makes the Experience Constitution citable law: "cite the number", and
 * every locked EC-20 row derives its value from the UX-01 verdict. That only
 * works if the documents it cites are in the repository. They were not.
 *
 * `design-lab/homepage-reset/DECISION.md` — the source of every locked EC-20
 * value, and the file EC-20 names directly — was untracked. It existed on one
 * machine. Nobody else could read the authority the constitution rests on, and
 * a single lost working tree would have taken the founder's verdict with it.
 * Two further citations pointed at paths that do not exist at all.
 *
 * A governance document that cites a file nobody can open is not law, it is a
 * claim about law. This test is what makes citability a property the repo
 * actually has rather than one it asserts: every path a governance document
 * mentions must resolve to something committed.
 */
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

const REPO_ROOT = resolve(__dirname, '../../..');

/** Documents whose citations are load-bearing for design governance. */
const GOVERNANCE_DOCS = [
  'docs/design/VITALCV_EXPERIENCE_CONSTITUTION.md',
  'docs/design/PARKED_VISUAL_ERAS.md',
  'design-lab/homepage-reset/DECISION.md',
  // CLAUDE.md is loaded into every session, so a dead path here misleads more
  // readers than a dead path anywhere else in the repo — and it cites by
  // markdown link rather than by backtick, which the CITATION pattern alone
  // does not see. Added with the 2026-08 IP constraints, whose whole value is
  // that a builder can open the note behind them.
  'CLAUDE.md',
  'docs/strategy/README.md',
];

/**
 * Every file tracked by git. Committed is the bar, not merely present on disk —
 * "it works on my machine" is precisely the failure this catches.
 */
const trackedFiles = execFileSync('git', ['ls-files'], {
  cwd: REPO_ROOT,
  encoding: 'utf8',
  maxBuffer: 32 * 1024 * 1024,
})
  .split('\n')
  .filter(Boolean);

const trackedSet = new Set(trackedFiles);
const trackedByBasename = new Set(trackedFiles.map((f) => basename(f)));

/**
 * Backticked paths that look like repo files. Prose in these documents also
 * backticks CSS values, tokens and identifiers, so this deliberately matches
 * only strings carrying a file extension we care about.
 */
const CITATION = /`([A-Za-z0-9_./-]+\.(?:md|html|json|ts|tsx|css|mjs))`/g;

/**
 * Markdown-link citations — `[label](docs/path.md)`.
 *
 * CLAUDE.md and docs/strategy/README.md cite almost entirely this way, so the
 * backtick pattern above sees none of it. Anchors and URLs are excluded: a
 * `#section` fragment is not a file, and an http(s) link is not ours to resolve.
 */
const LINK_CITATION = /\]\((?!https?:)([A-Za-z0-9_./-]+\.(?:md|html|json|ts|tsx|css|mjs))(?:#[^)]*)?\)/g;

/**
 * Citations this test cannot resolve and should not pretend to. Each needs a
 * reason — an unexplained exemption is how a guard quietly stops guarding.
 */
const ALLOWED_UNRESOLVED = new Map<string, string>([
  // The original filename of the competitive mandate, quoted inside the entry
  // that corrects the "recorded missing" note. The live document is
  // docs/strategy/competitive-mandate.md, which the same entry cites and this
  // sweep resolves — the old name is quoted history, not a live citation.
  [
    'VitalCV_Competitive_Mandate_and_Claude_Code_Waves_2026-07-21.md',
    'superseded filename, quoted in the entry that corrects it; the live path is cited alongside',
  ],
  // Planned by UX-16 and not yet built. Permitted because the citation says so
  // in the same sentence and names the script that enforces EC-3 today; an
  // unlabelled forward reference is exactly what EC-23 got wrong.
  [
    'scripts/copy-rules.json',
    'UX-16 forward reference, explicitly marked as not existing; current enforcement is scripts/check-public-claims.ts',
  ],
  // Deleted in c6a693641, not parked on disk. PARKED_VISUAL_ERAS now names the
  // retiring commit so they stay recoverable from history.
  ...(['header-journey', 'liquid-menu', 'film-journey-rail'].map((name) => [
    `${name}.spec.ts`,
    'retired chrome spec, deleted in c6a693641; recoverable from git history, which the citation names',
  ]) as Array<[string, string]>),
]);

describe('governance documents cite files that exist in the repository', () => {
  it.each(GOVERNANCE_DOCS)('%s is itself tracked', (doc) => {
    expect(
      trackedSet.has(doc),
      `${doc} is not committed — a governance document that lives on one machine cannot be cited`,
    ).toBe(true);
  });

  it.each(GOVERNANCE_DOCS)('every path cited by %s resolves', (doc) => {
    const source = readFileSync(resolve(REPO_ROOT, doc), 'utf-8');
    const cited = [
      ...[...source.matchAll(CITATION)].map((m) => m[1]),
      ...[...source.matchAll(LINK_CITATION)].map((m) => m[1]),
    ];
    expect(cited.length).toBeGreaterThan(0);

    const unresolved = [...new Set(cited)].filter((path) => {
      if (ALLOWED_UNRESOLVED.has(path)) return false;
      // Accept an exact repo-relative path, or a bare filename that is
      // unambiguous within the repo — governance prose cites both ways.
      return !trackedSet.has(path) && !trackedByBasename.has(basename(path));
    });

    expect(
      unresolved,
      `${doc} cites path(s) that are not committed:\n  ${unresolved.join('\n  ')}`,
    ).toEqual([]);
  });

  it('keeps the UX-01 verdict — the source of every locked EC-20 value — committed', () => {
    // Named explicitly rather than left to the sweep above. This is the file
    // the constitution rests on; if it ever leaves the repo again, the failure
    // should say so in those words.
    expect(trackedSet.has('design-lab/homepage-reset/DECISION.md')).toBe(true);

    const verdict = readFileSync(
      resolve(REPO_ROOT, 'design-lab/homepage-reset/DECISION.md'),
      'utf-8',
    );
    expect(verdict).toMatch(/DIRECTION B GO, WITH AMENDMENTS/i);
    expect(verdict).toMatch(/FINAL/);
  });

  it('keeps the rejected directions parked rather than deleted', () => {
    // EC-22: parked eras return only by amendment, which requires them to
    // still exist. PARKED_VISUAL_ERAS points at these prototypes.
    for (const direction of ['direction-a', 'direction-b', 'direction-c']) {
      expect(
        trackedSet.has(`design-lab/homepage-reset/${direction}/index.html`),
        `${direction} is parked by PARKED_VISUAL_ERAS but its prototype is not committed`,
      ).toBe(true);
    }
  });

  it('leaves no unresolved brand decision in the EC-20 table', () => {
    // W1080's closure criterion. A row may defer its VALUES to a later wave —
    // several legitimately do — but it must name the wave that owns it and the
    // constraint it decides within. A bare "PENDING" names neither, and reads
    // as an open question when the constitution says there are none.
    const constitution = readFileSync(
      resolve(REPO_ROOT, 'docs/design/VITALCV_EXPERIENCE_CONSTITUTION.md'),
      'utf-8',
    );
    const tableRows = constitution
      .split('\n')
      .filter((line) => line.startsWith('|') && /\|\s*(LOCKED|PENDING|SET AT|DEFERRED)/i.test(line));

    expect(tableRows.length).toBeGreaterThan(10);

    const bare = tableRows.filter((row) => /\|\s*PENDING[^|]*\|?\s*$/i.test(row.trimEnd()));
    expect(
      bare.map((r) => r.split('|')[1]?.trim()),
      'EC-20 row(s) still marked bare PENDING — name the owning wave and the deciding constraint',
    ).toEqual([]);
  });
});
