import Link from 'next/link';

import {
  CV_SECTION_LABEL,
  DEMO_CV_ENTRIES,
  branchName,
  type CvSection,
} from '@/lib/career-garden/demoData';
import { GARDEN_HREF_FOR, type GardenMount } from '@/lib/career-garden/nav';

import { GardenStamp } from '../GardenStamp';
import { CursorContextBinding } from '../GardenWorkspaceProvider';
import { SessionCvAdditions } from '../SessionState';

const SECTION_ORDER: CvSection[] = ['experience', 'teaching', 'research', 'publications', 'service'];

/**
 * The Living CV — blooms with visible provenance. Every line says where it
 * came from in plain language under "Show origin" (a details element, so it
 * works with JS off). Lines approved from notes this session appear inline,
 * labeled and removable. Editing the durable profile stays on the existing
 * surface at /clinician/profile — this page never forks that record.
 */
export function LivingCvSurface({ selectedId, mount }: { selectedId?: string; mount: GardenMount }) {
  const hrefFor = GARDEN_HREF_FOR[mount];
  const selected = DEMO_CV_ENTRIES.find((e) => e.id === selectedId);

  return (
    <div className="space-y-8">
      {selected ? (
        <CursorContextBinding context={{ type: 'cv', id: selected.id, label: selected.headline }} />
      ) : null}

      <header>
        <h2 className="mz-h2">Living CV</h2>
        <p className="mz-body mt-2" style={{ color: 'var(--ink-600)' }}>
          A CV that grows with you instead of being rewritten the night before a deadline. Every line carries its
          provenance; nothing is added without your say-so.
        </p>
        <p className="mz-small mt-2" style={{ color: 'var(--vt-text-muted)' }}>
          Your durable profile lives in{' '}
          <Link href="/clinician/profile" className="underline underline-offset-4">
            Profile
          </Link>{' '}
          and your credential record in the{' '}
          <Link href="/holder" className="underline underline-offset-4">
            Wallet
          </Link>
          . This garden view drafts lines for them — it never replaces them.
        </p>
      </header>

      {SECTION_ORDER.map((section) => {
        const entries = DEMO_CV_ENTRIES.filter((e) => e.section === section);
        return (
          <section key={section} aria-labelledby={`cv-${section}`}>
            <h3 id={`cv-${section}`} className="mz-eyebrow">
              {CV_SECTION_LABEL[section]}
            </h3>
            <ul className="mt-2">
              {entries.map((entry) => (
                <li
                  key={entry.id}
                  id={entry.id}
                  className="border-b border-[var(--rule-soft)] py-4 last:border-0"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="mz-body font-medium" style={{ color: 'var(--ink-900)' }}>
                      {entry.headline}
                    </p>
                    <div className="flex items-center gap-2">
                      <GardenStamp provenance={entry.provenance} />
                      <Link
                        href={hrefFor('cv', { entry: entry.id })}
                        className="mz-small underline underline-offset-4"
                        aria-label={`Focus ${entry.headline} for the Cursor`}
                      >
                        Focus
                      </Link>
                    </div>
                  </div>
                  <p className="mz-body mt-1">{entry.detail}</p>
                  <details className="mt-2">
                    <summary className="mz-small cursor-pointer" style={{ color: 'var(--ink-600)' }}>
                      Show origin
                    </summary>
                    <ul className="mt-1.5 space-y-1 pl-4">
                      {entry.origin.map((line) => (
                        <li key={line} className="mz-small">
                          {line}
                        </li>
                      ))}
                      {entry.branchIds.length > 0 ? (
                        <li className="mz-small" style={{ color: 'var(--vt-text-muted)' }}>
                          Branch: {entry.branchIds.map(branchName).join(', ')}
                        </li>
                      ) : null}
                    </ul>
                  </details>
                </li>
              ))}
              <SessionCvAdditions section={section} />
              {entries.length === 0 ? (
                <li className="mz-small py-4" style={{ color: 'var(--vt-text-muted)' }}>
                  Nothing here yet — grow a seed from your notes when one is ready.
                </li>
              ) : null}
            </ul>
          </section>
        );
      })}

      <footer className="mz-inset p-4">
        <p className="mz-body">
          New lines start as seeds.{' '}
          <Link href={hrefFor('notes')} className="underline underline-offset-4">
            Grow one from your notes
          </Link>{' '}
          — you review and approve every draft before it appears here.
        </p>
      </footer>
    </div>
  );
}
