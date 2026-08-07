import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

type PublicEntryCopySurface = {
  id: string;
  label: string;
  entryFile: string;
  copySources: string[];
};

const REPO_ROOT = path.resolve(__dirname, '../../..');

function readFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(REPO_ROOT, relativePath), 'utf8');
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFile(relativePath)) as T;
}

function fileExists(relativePath: string): boolean {
  return fs.existsSync(path.resolve(REPO_ROOT, relativePath));
}

function readFilesThatExist(candidates: readonly string[]): string {
  const existing = candidates.filter(fileExists);
  // Fail loudly if the entire surface disappeared — prevents the guard
  // from silently passing if all candidate files are moved/archived.
  expect(existing.length).toBeGreaterThan(0);
  return existing.map(readFile).join('\n');
}

describe('wording safety guards', () => {
  // Candidate UI files to scan for high-risk clearance language. Routes
  // in this list may be archived/moved as the product evolves — missing
  // files are skipped (see readFilesThatExist), but the assertion that
  // at least one candidate reads keeps the guard honest.
  const candidateUiFiles = [
    'apps/web/app/intake/page.tsx',
    'apps/web/app/intake/IntakeContent.tsx',
    'apps/web/app/interview/page.tsx',
    'apps/web/components/employer/VerifierPortal.tsx',
    'apps/web/components/employer/TrustStatePanel.tsx',
    'apps/web/components/review/ReviewClient.tsx',
    'apps/web/components/clinician/intake-types.ts',
  ];

  it('does not include high-risk clearance language in intake/verifier UI copy', () => {
    const combined = readFilesThatExist(candidateUiFiles).toLowerCase();

    expect(combined).not.toContain('you are cleared to start');
    expect(combined).not.toContain('ready to start');
    expect(combined).not.toContain('good standing');
    expect(combined).not.toContain('trust score');
    expect(combined).not.toContain('clear to start');
  });

  it('includes explicit conditional start-ready clarification text', () => {
    const combined = readFilesThatExist(candidateUiFiles);

    const required =
      'PSV complete. Employer acceptance and start attestation still required.';

    expect(combined).toContain(required);
  });
});

describe('public surface truth guards — post-release drift prevention', () => {
  const publicEntryCopyManifest = readJson<{ surfaces: PublicEntryCopySurface[] }>(
    'scripts/public-entry-copy-sources.json',
  );

  const publicEntryCopyFiles = Array.from(
    new Set(
      publicEntryCopyManifest.surfaces.flatMap((surface) => [
        surface.entryFile,
        ...surface.copySources,
      ]),
    ),
  );

  /**
   * Public surfaces this wording scan covers, beyond the copy manifest.
   *
   * Every entry must EXIST — see the assertion below. The list previously named
   * `app/interview/page.tsx`, `app/explore/page.tsx` and `app/labs/page.tsx`,
   * none of which are routes any more, plus `marketing/HomeSections.tsx`, which
   * was dead code. `readFilesThatExist` silently skips what is gone, so the
   * scan quietly covered four fewer surfaces than it advertised and no one
   * could tell. A scan list that shrinks in silence is the same failure as a
   * guard pinned to a component nobody serves.
   */
  const candidatePublicSurfaces = Array.from(new Set([
    'apps/web/components/layout/Navbar.tsx',
    // `hero/ReadinessPreview.tsx` stood here until 2026-08-07, when it was
    // deleted as dead code — no route rendered it, so the scan was covering a
    // surface no visitor could see. The entry is DROPPED rather than replaced:
    // its live successor (`app/holder/readiness/ReadinessSurface.tsx`) is
    // already swept via the copy-manifest guards in apps/web.
    // The public opportunities board. `ExploreClient.tsx` used to stand here;
    // #999 retired it and split the surface across a page and three components,
    // so the entry is REPLACED rather than dropped — dropping it would shrink
    // this scan by one public surface, which is exactly the silent erosion the
    // assertion below exists to catch.
    'apps/web/app/explore/page.tsx',
    'apps/web/components/explore/board/BoardClient.tsx',
    'apps/web/components/explore/board/BoardResultRow.tsx',
    'apps/web/components/explore/board/BoardFilterPanel.tsx',
    ...publicEntryCopyFiles,
  ]));

  function readPublic(): string {
    return readFilesThatExist(candidatePublicSurfaces);
  }

  it('scans every surface it claims to scan', () => {
    // The scan is only as good as this list, and `readFilesThatExist` skips
    // what is gone WITHOUT complaining. Without this assertion the coverage can
    // shrink to nothing one deleted file at a time and every wording test below
    // still passes — vacuously.
    const missing = candidatePublicSurfaces.filter(
      (rel) => !fs.existsSync(path.join(REPO_ROOT, rel)),
    );
    expect(missing, `scan list names files that do not exist: ${missing.join(', ')}`).toEqual([]);
  });

  it('tracks canonical homepage and developer-shell copy sources', () => {
    const surfaceIds = publicEntryCopyManifest.surfaces.map((surface) => surface.id);
    expect(surfaceIds).toEqual(expect.arrayContaining(['homepage', 'developer-shell']));

    const homepage = publicEntryCopyManifest.surfaces.find(
      (surface) => surface.id === 'homepage',
    );
    const developerShell = publicEntryCopyManifest.surfaces.find(
      (surface) => surface.id === 'developer-shell',
    );

    expect(homepage?.entryFile).toBe('apps/web/app/page.tsx');
    // These pinned a manifest that had gone stale, which is why it stayed
    // stale: correcting it broke this test, so nobody did. The old list named
    // HeroWithAuthPrompt, PublicTruthSections and HomeSections — all three dead
    // code with zero importers, none of them rendered by `/` after the homepage
    // became the film. Pin the surface's SHAPE, and let
    // scripts/report-public-entry-copy-sources.js enforce that each entry is
    // real and live; a hard-coded list here can only ever re-freeze whatever
    // was true the day it was written.
    expect(homepage?.copySources?.length ?? 0).toBeGreaterThan(0);
    expect(homepage?.copySources).toEqual(
      expect.arrayContaining(['apps/web/components/home/film/HorizontalCareerFilm.tsx']),
    );
    expect(developerShell?.entryFile).toBe('apps/web/app/docs/page.tsx');
    expect(developerShell?.copySources).toEqual(
      expect.arrayContaining(['apps/api/backend/src/services/search/searchIndex.ts']),
    );
  });

  it('does not contain verified-overclaiming strings on public surfaces', () => {
    const combined = readPublic().toLowerCase();

    expect(combined).not.toContain('real verified readiness');
    expect(combined).not.toContain('verified readiness');
    expect(combined).not.toContain('primary sources verify you');
    expect(combined).not.toContain('full primary source verification');
    expect(combined).not.toContain('unlock your verified');
    expect(combined).not.toContain('already cleared for');
    expect(combined).not.toContain('open interview preview');
    expect(combined).not.toContain('build with the trust protocol');
    expect(combined).not.toContain('build with the vitalcv trust protocol');
  });

  it('does not use "Get Verified" as a nav or CTA label on public surfaces', () => {
    const combined = readPublic();

    // "Get Verified" is an overclaim — nav should say "Get Ready" or "Get Started"
    expect(combined).not.toContain('>Get Verified<');
    expect(combined).not.toContain('"Get Verified"');
    expect(combined).not.toContain("'Get Verified'");
    expect(combined).not.toContain('label="Get Verified"');
  });

  it('interview blocked state does not imply verified readiness', () => {
    const interviewPath = 'apps/web/app/interview/page.tsx';
    if (!fileExists(interviewPath)) return;
    const interviewSrc = readFile(interviewPath).toLowerCase();

    expect(interviewSrc).not.toContain('real verified readiness');
    expect(interviewSrc).not.toContain('verified readiness');
  });
});
