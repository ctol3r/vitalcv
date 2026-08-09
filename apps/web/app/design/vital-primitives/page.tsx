import type { Metadata } from 'next';

import {
  VitalAction,
  VitalFrostPanel,
  VitalGhostAction,
  VitalPill,
  VitalSceneFrame,
} from '@/components/vital';

/**
 * /design/vital-primitives — the D-02 component harness.
 *
 * The scene primitives in every reviewable state, on both registers, so a
 * design review looks at one page instead of hunting call sites. Gated by the
 * /design layout (404 in canonical production), noindex, self-chromed like
 * every /design reference except z1-home.
 *
 * Hover and focus are live states — tab through the page to review them; the
 * matrix below renders what the server can honestly render (normal, disabled,
 * pending, both registers). Reduced-motion parity is trivial here: nothing on
 * this page moves at all.
 */
export const metadata: Metadata = {
  title: 'Vital scene primitives — design reference',
  robots: { index: false, follow: false },
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[180px_minmax(0,1fr)] items-center gap-6 border-t border-[var(--vt-scene-line)] py-5">
      <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--vt-scene-text-secondary)]">
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-4">{children}</div>
    </div>
  );
}

function PaperRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[180px_minmax(0,1fr)] items-center gap-6 border-t border-[var(--vt-scene-paper-line)] py-5">
      <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--vt-scene-paper-text-secondary)]">
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-4">{children}</div>
    </div>
  );
}

export default function VitalPrimitivesHarness() {
  return (
    <main className="min-h-screen bg-[var(--vt-scene-canvas)]">
      {/* ── the dark scene register ─────────────────────────────────────── */}
      <VitalSceneFrame as="section" aria-label="Scene register" className="px-8 py-12">
        <h1 className="text-[24px] font-semibold text-[var(--vt-scene-text)]">
          Vital scene primitives
        </h1>
        <p className="mt-1 max-w-xl text-[13px] text-[var(--vt-scene-text-secondary)]">
          D-02 reference — every reviewable state on both registers. Tab through for focus;
          hover for press. Design reference only; not a production surface.
        </p>

        <div className="mt-10 max-w-3xl">
          <Row label="Action / rest">
            <VitalAction label="Start with your NPI" />
            <VitalAction label="Start with your NPI" size="lg" />
          </Row>
          <Row label="Action / link">
            <VitalAction label="Keep this record" href="/onboarding" />
          </Row>
          <Row label="Action / pending">
            <VitalAction label="Start with your NPI" pending pendingLabel="Checking the registry…" />
          </Row>
          <Row label="Action / disabled">
            <VitalAction label="Start with your NPI" disabled />
          </Row>
          <Row label="Ghost">
            <VitalGhostAction label="Check another NPI" />
            <VitalGhostAction label="Replay" size="lg" />
            <VitalGhostAction label="Disabled" disabled />
          </Row>
          <Row label="Pill">
            <VitalPill label="NPPES" />
            <VitalPill label="Your approval" />
            <VitalPill label="State board record" />
          </Row>
        </div>

        {/* the frost panel over the one glow — the material demo */}
        <VitalSceneFrame glow className="mt-12 max-w-3xl px-2 py-8" aria-label="Frost over glow">
          <VitalFrostPanel as="figure" aria-label="Frost panel demonstration" className="p-6">
            <p className="text-[14px] font-semibold text-[var(--vt-scene-text)]">
              Frost panel over the scene glow
            </p>
            <p className="mt-1 max-w-md text-[12px] text-[var(--vt-scene-text-secondary)]">
              Hairline and translucency carry the elevation — no shadow. Frost is chrome;
              nothing inside it may be the only rendering of a state.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <VitalAction label="Primary on frost" />
              <VitalGhostAction label="Ghost on frost" />
            </div>
          </VitalFrostPanel>
        </VitalSceneFrame>
      </VitalSceneFrame>

      {/* ── the paper register ──────────────────────────────────────────── */}
      <section
        aria-label="Paper register"
        className="bg-[var(--vt-scene-paper)] px-8 py-12 text-[var(--vt-scene-paper-text)]"
      >
        <h2 className="text-[18px] font-semibold">Paper register — the action inverts</h2>
        <div className="mt-6 max-w-3xl">
          <PaperRow label="Action / rest">
            <VitalAction label="Start with your NPI" register="paper" />
          </PaperRow>
          <PaperRow label="Action / pending">
            <VitalAction
              label="Start with your NPI"
              register="paper"
              pending
              pendingLabel="Checking the registry…"
            />
          </PaperRow>
          <PaperRow label="Ghost">
            <VitalGhostAction label="Check another NPI" register="paper" />
          </PaperRow>
          <PaperRow label="Pill">
            <VitalPill label="NPPES" register="paper" />
          </PaperRow>
        </div>
      </section>
    </main>
  );
}
