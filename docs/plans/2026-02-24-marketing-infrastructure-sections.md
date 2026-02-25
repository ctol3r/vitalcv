# Marketing Infrastructure Sections Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Insert three new marketing sections (Artifact Engine, PSV Acceleration, Trust Transfer Moat) into the homepage, fix phantom CSS variables, and maintain the existing design system rhythm.

**Architecture:** Single-file edit to `apps/web/app/page.tsx`. Fix all `var(--warm-charcoal)` → `foreground`, `var(--cloud-dancer)` → `background`, `var(--mist-blue)` → `accent` mappings (these custom properties were never defined in globals.css). Add three sections using the established `SectionHeading` + `GlassCard` pattern. No new components — marketing pages change fast and benefit from locality.

**Tech Stack:** Next.js 15 (App Router), Tailwind CSS v4, Lucide React icons, existing GlassCard + SectionHeading helpers.

---

## Background: Phantom CSS Variable Bug

The current `page.tsx` references three CSS custom properties that don't exist:
- `var(--warm-charcoal)` → should be `var(--foreground)` (defined as oklch(0.22 0.01 60) in globals.css)
- `var(--cloud-dancer)` → should be `var(--background)` (defined as oklch(0.957 0.008 90))
- `var(--mist-blue)` → should be `var(--accent)` (defined as oklch(0.855 0.032 230))

These map to the same design intent (the CSS comments confirm: `--background` = "Cloud Dancer", `--foreground` = "Warm Charcoal", `--accent` = "Mist Blue"). The current page renders with browser fallbacks wherever these phantom variables are used.

## Section Placement

Current order: Nav → Hero → Problem → Solution → How It Works → ROI → Security → Portals → Footer

New order: Nav → Hero → Problem → Solution → How It Works → **Artifact Engine** → **PSV Acceleration** → ROI → **Trust Transfer Moat** → Security → Portals → Footer

Rationale:
- Artifact Engine follows How It Works (it explains WHAT the engine produces)
- PSV Acceleration follows Artifact Engine (it explains the SPEED benefit)
- Trust Transfer Moat follows ROI (after showing impact, explain WHY this is defensible)

---

### Task 1: Fix phantom CSS variables across page.tsx

**Files:**
- Modify: `apps/web/app/page.tsx` (all lines referencing `--warm-charcoal`, `--cloud-dancer`, `--mist-blue`)

**Step 1: Replace all phantom variable references**

Find and replace across the entire file:

| Find | Replace With |
|------|-------------|
| `var(--warm-charcoal)` | `var(--foreground)` |
| `var(--cloud-dancer)` | `var(--background)` |
| `var(--mist-blue)` | `var(--accent)` |

These are used ~30 times throughout the file. Use `replace_all` for each pattern.

**Step 2: Verify no phantom variables remain**

Run: `grep -c "warm-charcoal\|cloud-dancer\|mist-blue" apps/web/app/page.tsx`
Expected: `0`

**Step 3: Verify build still passes**

Run: `cd /Users/christoler/vitalcv && pnpm turbo build --filter=@vitalcv/web`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add apps/web/app/page.tsx
git commit -m "fix(marketing): replace phantom CSS variables with actual design tokens"
```

---

### Task 2: Add Lucide icon imports for new sections

**Files:**
- Modify: `apps/web/app/page.tsx` (import block, lines 4-15)

**Step 1: Add new icons to the existing Lucide import**

Add these icons to the existing `lucide-react` import:
- `Database` (for Artifact Engine — represents structured data/registries)
- `Zap` (for PSV Acceleration — represents speed)
- `Fingerprint` (for Trust Transfer — represents unique identity/portability)
- `RefreshCw` (for PSV Acceleration — represents cycle reduction)
- `PackageCheck` (for Artifact Engine — represents bundled artifacts)
- `Share2` (for Trust Transfer — represents transfer/portability)

The import should include all existing icons plus the new ones, sorted alphabetically.

**Step 2: Verify no TypeScript errors**

Run: `cd /Users/christoler/vitalcv && pnpm turbo build --filter=@vitalcv/web`
Expected: Build succeeds (unused imports are fine in Next.js)

**Step 3: Commit**

```bash
git add apps/web/app/page.tsx
git commit -m "chore(marketing): add Lucide icons for new infrastructure sections"
```

---

### Task 3: Insert Artifact Engine section

**Files:**
- Modify: `apps/web/app/page.tsx` (insert after "How It Works" section, before ROI section)

**Step 1: Insert the Artifact Engine section**

Insert this JSX after the closing `</section>` of "How It Works" (after line 216) and before the ROI section comment:

```tsx
      {/* ──── Artifact Engine ────────────────────────── */}
      <section className="py-20 px-6">
        <SectionHeading
          eyebrow="The Engine"
          title="The VitalCV Artifact Engine"
          subtitle="Every credential produces a deterministic, timestamped artifact bundle — structured for instant verification and audit."
        />
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: Database,
              title: 'Primary Source Queries',
              desc: 'Licenses, boards, DEA, sanctions — queried directly from authoritative registries. No intermediaries.',
            },
            {
              icon: PackageCheck,
              title: 'Deterministic Artifact Bundle',
              desc: 'Timestamped response snapshots, methodology versioning, and tamper-evident hashing. Every artifact is reproducible.',
            },
            {
              icon: ShieldCheck,
              title: 'Independent Cross-Check',
              desc: 'Verifiers validate authenticity without repeating full primary source verification. Trust the artifact, not the process.',
            },
          ].map((item) => (
            <GlassCard key={item.title}>
              <GlassCardContent className="py-8 px-6">
                <div className="w-10 h-10 rounded-xl bg-[var(--trust-green)]/10 text-[var(--trust-green)] flex items-center justify-center mb-4">
                  <item.icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {item.desc}
                </p>
              </GlassCardContent>
            </GlassCard>
          ))}
        </div>
      </section>
```

**Step 2: Verify build**

Run: `cd /Users/christoler/vitalcv && pnpm turbo build --filter=@vitalcv/web`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add apps/web/app/page.tsx
git commit -m "feat(marketing): add Artifact Engine section"
```

---

### Task 4: Insert PSV Acceleration section

**Files:**
- Modify: `apps/web/app/page.tsx` (insert after Artifact Engine, before ROI)

**Step 1: Insert the PSV Acceleration section**

Insert after the Artifact Engine section:

```tsx
      {/* ──── PSV Acceleration ───────────────────────── */}
      <section className="py-20 px-6 bg-foreground/[0.02]">
        <SectionHeading
          eyebrow="Speed"
          title="PSV Window Acceleration"
          subtitle="Artifact timestamps, expiration monitoring, and NCQA audit expectations — aligned into a single portable credential package."
        />
        <div className="max-w-3xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <GlassCard weight="heavy">
              <GlassCardContent className="py-10 px-6 text-center">
                <div className="w-12 h-12 rounded-2xl bg-[var(--trust-red)]/10 text-[var(--trust-red)] flex items-center justify-center mx-auto mb-4">
                  <RefreshCw className="h-6 w-6" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                  Without VitalCV
                </p>
                <p className="font-fraunces text-3xl font-semibold text-foreground">
                  90–180 days
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Redundant re-verification cycles
                </p>
              </GlassCardContent>
            </GlassCard>

            <GlassCard weight="heavy">
              <GlassCardContent className="py-10 px-6 text-center">
                <div className="w-12 h-12 rounded-2xl bg-[var(--trust-green)]/10 text-[var(--trust-green)] flex items-center justify-center mx-auto mb-4">
                  <Zap className="h-6 w-6" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                  With VitalCV
                </p>
                <p className="font-fraunces text-3xl font-semibold text-foreground">
                  Days, not months
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Immediate artifact validation + accelerated start
                </p>
              </GlassCardContent>
            </GlassCard>
          </div>
        </div>
      </section>
```

**Step 2: Verify build**

Run: `cd /Users/christoler/vitalcv && pnpm turbo build --filter=@vitalcv/web`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add apps/web/app/page.tsx
git commit -m "feat(marketing): add PSV Acceleration section"
```

---

### Task 5: Insert Trust Transfer Moat section

**Files:**
- Modify: `apps/web/app/page.tsx` (insert after ROI, before Security)

**Step 1: Insert the Trust Transfer Moat section**

Insert after the ROI section's closing `</section>` and before the Security section comment:

```tsx
      {/* ──── Trust Transfer Moat ────────────────────── */}
      <section className="py-20 px-6">
        <SectionHeading
          eyebrow="The Moat"
          title="Trust Transfer Is the Moat"
          subtitle="Credentials are verified once and accepted across systems. VitalCV doesn't replace primary source verification — it eliminates redundant repetition."
        />
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: Fingerprint,
              title: 'Clinician-Controlled',
              desc: 'Portable across organizations. Clinicians carry their verified trust state wherever they practice.',
            },
            {
              icon: ShieldCheck,
              title: 'Verifier-Validated',
              desc: 'Independently cross-checkable. Any employer can validate without repeating the full PSV cycle.',
            },
            {
              icon: Share2,
              title: 'Audit-Ready',
              desc: 'Structured to satisfy NCQA, CMS, and Joint Commission compliance frameworks out of the box.',
            },
          ].map((item) => (
            <GlassCard key={item.title}>
              <GlassCardContent className="py-8 px-6">
                <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center mb-4">
                  <item.icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {item.desc}
                </p>
              </GlassCardContent>
            </GlassCard>
          ))}
        </div>
      </section>
```

**Step 2: Verify build**

Run: `cd /Users/christoler/vitalcv && pnpm turbo build --filter=@vitalcv/web`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add apps/web/app/page.tsx
git commit -m "feat(marketing): add Trust Transfer Moat section"
```

---

### Task 6: Final verification and push

**Step 1: Full build check**

Run: `cd /Users/christoler/vitalcv && pnpm turbo build --filter=@vitalcv/web`
Expected: Build succeeds with no errors

**Step 2: Verify section count in page**

Run: `grep -c '──── ' apps/web/app/page.tsx`
Expected: `12` (Nav, Hero, Problem, Solution, How It Works, Artifact Engine, PSV Acceleration, ROI, Trust Transfer Moat, Security, Portals, Footer)

**Step 3: Push**

```bash
git push origin feature/marketing-gateway
```
