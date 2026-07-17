/**
 * PR J2 — the privacy contract on clinician discovery decisions.
 *
 * "No employer can see private swipe decisions" is a product guarantee, so it
 * is enforced here as a structural test rather than left to a comment and good
 * intentions. This scans the real source tree: every file that queries the
 * OpportunityAction log must live in the clinician's own namespace and must
 * scope its reads to the authenticated Clerk user.
 *
 * If a future change adds an employer-facing reader — a dashboard "who viewed
 * this role", a recruiter funnel, an analytics rollup — this test fails and
 * names the file. That is the intent.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = new URL('..', import.meta.url).pathname
const REPO_ROOT = new URL('../../..', import.meta.url).pathname

const SCAN_ROOTS = [join(WEB_ROOT, 'app'), join(WEB_ROOT, 'lib'), join(WEB_ROOT, 'components')]
const BACKEND_ROOT = join(REPO_ROOT, 'apps/api/backend/src')

const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', 'build', 'coverage', '_archive', 'generated'])

function walk(dir: string): string[] {
  let out: string[] = []
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      out = out.concat(walk(full))
    } else if (/\.(ts|tsx)$/.test(full) && !/\.(test|spec)\.tsx?$/.test(full)) {
      out.push(full)
    }
  }
  return out
}

/** Every non-test source file that touches the decision log. */
function filesQueryingTheLog(roots: string[]): string[] {
  const hits: string[] = []
  for (const root of roots) {
    for (const file of walk(root)) {
      const src = readFileSync(file, 'utf8')
      if (/prisma\s*\.\s*opportunityAction\s*\./.test(src)) {
        hits.push(relative(REPO_ROOT, file))
      }
    }
  }
  return hits.sort()
}

describe('clinician discovery decisions are private', () => {
  const readers = filesQueryingTheLog(SCAN_ROOTS)

  it('only the clinician’s own MATCHA routes query the decision log', () => {
    expect(readers).toEqual([
      'apps/web/app/api/matcha/deck/signal/route.ts',
      'apps/web/app/api/matcha/deck/signals/route.ts',
      'apps/web/app/api/matcha/opportunity-actions/route.ts',
      'apps/web/app/api/matcha/opportunity/[id]/action/route.ts',
    ])
  })

  it('no employer, verifier, recruiter, or admin surface queries the decision log', () => {
    const forbidden = readers.filter((f) =>
      /\/(employer|verifier|recruiter|admin|candidates|ops|analytics)\//.test(f),
    )
    expect(forbidden).toEqual([])
  })

  it('the API backend — which serves employer surfaces — cannot read the log at all', () => {
    expect(filesQueryingTheLog([BACKEND_ROOT])).toEqual([])
  })

  it('every reader scopes its query to the authenticated Clerk user', () => {
    for (const file of readers) {
      const src = readFileSync(join(REPO_ROOT, file), 'utf8')
      // Identity must come from auth(), never a caller-supplied header.
      expect(src, `${file} must derive identity from Clerk auth()`).toMatch(
        /const\s*\{\s*userId\s*\}\s*=\s*await\s+auth\(\)/,
      )
      expect(src, `${file} must not trust an x-clerk-user-id header`).not.toMatch(
        /headers\(\)[\s\S]{0,80}x-clerk-user-id/i,
      )
      // Any read of the log must be filtered by that user.
      const reads = src.match(/prisma\.opportunityAction\.(findMany|findFirst|findUnique)\(/g) ?? []
      if (reads.length > 0) {
        expect(src, `${file} must filter reads by clerkUserId`).toMatch(/clerkUserId/)
      }
    }
  })

  it('the deck never sends decisions to an employer-facing endpoint', () => {
    const transportDir = join(WEB_ROOT, 'components/matcha-deck')
    for (const file of walk(transportDir)) {
      const src = readFileSync(file, 'utf8')
      const endpoints = [...src.matchAll(/fetch\(\s*['"`]([^'"`]+)['"`]/g)].map((m) => m[1])
      for (const endpoint of endpoints) {
        expect(endpoint, `${relative(REPO_ROOT, file)} posts to a non-clinician endpoint`).toMatch(
          /^\/api\/matcha\//,
        )
      }
    }
  })
})
