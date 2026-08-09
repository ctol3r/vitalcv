import Link from 'next/link';

import { Reveal } from '@/components/motion/Reveal';
import {
  DEMO_BRANCHES,
  DEMO_ROOTS,
  DEMO_SEASON_EVENTS,
  DEMO_TEND_ITEMS,
  DEMO_TODAY_TASKS,
} from '@/lib/career-garden/demoData';
import {
  deriveActivity,
  deriveTodayTasks,
  type GardenData,
} from '@/lib/career-garden/gardenViews';
import { GARDEN_HREF_FOR, type GardenHrefFor, type GardenMount } from '@/lib/career-garden/nav';

/**
 * Garden home: a calm review surface, not a dashboard. Today's few tasks,
 * the five beds as quiet structure, recent activity as a timeline, and the
 * weekly tend card. No scores, no meters, no theatre.
 *
 * Live mount: Seeds and Blooms are your durable workspace; Roots and
 * Branches render honest absence until their waves land — no sample content
 * on production routes (A5, 2026-08-08).
 */
export function GardenHomeSurface({ data, mount }: { data: GardenData; mount: GardenMount }) {
  const hrefFor = GARDEN_HREF_FOR[mount];
  const live = data.mode !== 'fixture';

  const beds: Array<{
    key: string;
    name: string;
    meaning: string;
    count: string;
    items: string[];
    href: string;
  }> = [
    {
      key: 'seeds',
      name: 'Seeds',
      meaning: 'Private notes and captures',
      count: `${data.notes.length}`,
      items:
        data.notes.length > 0
          ? data.notes.slice(0, 2).map((s) => s.title)
          : ['None yet — press ⌘K (or Ctrl+K) to capture the first.'],
      href: hrefFor('notes'),
    },
    {
      key: 'roots',
      name: 'Roots',
      meaning: 'Connected identities and links',
      // Honest absence (A5): nothing is connected until the connections wave
      // ships — no demo providers, no fabricated count.
      count: live ? '—' : `${DEMO_ROOTS.filter((r) => r.state !== 'not-connected').length}`,
      items: live
        ? ['Nothing connected yet — identity connections arrive in a later wave.']
        : DEMO_ROOTS.filter((r) => r.state !== 'not-connected').map((r) => r.provider),
      href: hrefFor('privacy'),
    },
    {
      key: 'branches',
      name: 'Branches',
      meaning: 'Projects, teaching, research themes',
      count: live ? '—' : `${DEMO_BRANCHES.length}`,
      items: live
        ? ['None recorded yet — group notes into themes when that wave ships.']
        : DEMO_BRANCHES.map((b) => b.name),
      href: hrefFor('notes'),
    },
    {
      key: 'blooms',
      name: 'Blooms',
      meaning: 'Living CV lines you approved',
      count: `${data.cvEntries.length}`,
      items:
        data.cvEntries.length > 0
          ? data.cvEntries.slice(0, 2).map((e) => e.headline)
          : ['None yet — grow a seed when one is ready.'],
      href: hrefFor('cv'),
    },
    {
      key: 'harvests',
      name: 'Harvests',
      meaning: 'Packets you explicitly share',
      count: '0',
      items: ['None here — sharing stays off in the garden.'],
      href: hrefFor('privacy'),
    },
  ];

  const todayTasks = live ? deriveTodayTasks(data) : null;
  const activity = live ? deriveActivity(data) : null;
  const tendItems = live ? deriveTendItems(data) : DEMO_TEND_ITEMS;

  return (
    <div className="space-y-10">
      {/* Today */}
      <section aria-labelledby="garden-today">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="garden-today" className="mz-h2">
            Today
          </h2>
          <span className={`mz-chip ${live ? 'mz-chip-unknown' : 'mz-chip-watch'}`}>
            <span className="mz-gl" aria-hidden="true" />
            {live ? 'From your workspace' : 'Sample tasks'}
          </span>
        </div>
        <ul className="mt-4 grid gap-3 md:grid-cols-3">
          {(todayTasks ?? DEMO_TODAY_TASKS).map((task, i) => {
            const href =
              'noteId' in task && task.noteId
                ? hrefFor('notes', { note: task.noteId })
                : 'href' in task
                  ? rewriteTodayHref((task as { href: string }).href, hrefFor)
                  : hrefFor('notes');
            return (
              <Reveal key={task.id} as="li" delay={i * 60}>
                <Link href={href} className="mz-card mz-interactive block h-full p-4">
                  <p className="mz-body font-medium" style={{ color: 'var(--ink-900)' }}>
                    {task.label}
                  </p>
                  <p className="mz-small mt-1.5">{task.detail}</p>
                </Link>
              </Reveal>
            );
          })}
        </ul>
      </section>

      {/* The garden beds */}
      <section aria-labelledby="garden-beds">
        <h2 id="garden-beds" className="mz-h2">
          Your garden, in five beds
        </h2>
        <p className="mz-small mt-1.5" style={{ color: 'var(--vt-text-muted)' }}>
          Seeds grow into blooms only when you say so; harvests leave only with your consent.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {beds.map((bed, i) => (
            <Reveal key={bed.key} delay={i * 60}>
              <Link href={bed.href} className="mz-card mz-interactive block h-full p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="mz-card-ttl">{bed.name}</h3>
                  <span className="mz-mono text-[12px]" style={{ color: 'var(--ink-500)' }}>
                    {bed.count}
                  </span>
                </div>
                <p className="mz-small mt-1" style={{ color: 'var(--vt-text-muted)' }}>
                  {bed.meaning}
                </p>
                <ul className="mt-3 space-y-1 border-t border-[var(--rule-soft)] pt-2">
                  {bed.items.map((item) => (
                    <li key={item} className="mz-small truncate" title={item}>
                      {item}
                    </li>
                  ))}
                </ul>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Recent activity — the Seasons strip */}
      <section aria-labelledby="garden-seasons">
        <h2 id="garden-seasons" className="mz-h2">
          Recent activity
        </h2>
        {activity && activity.length === 0 ? (
          <p className="mz-small mt-3" style={{ color: 'var(--vt-text-muted)' }}>
            Quiet so far — activity appears here as you capture and grow.
          </p>
        ) : (
          <ol className="mt-4 space-y-0">
            {(activity ?? DEMO_SEASON_EVENTS).map((event) => (
              <li key={event.id} className="flex gap-4 border-b border-[var(--rule-soft)] py-3 last:border-0">
                <span className="mz-mono shrink-0 pt-0.5 text-[12px]" style={{ color: 'var(--ink-500)' }}>
                  {event.at}
                </span>
                <div className="min-w-0">
                  <p className="mz-body font-medium" style={{ color: 'var(--ink-900)' }}>
                    {event.label}
                  </p>
                  <p className="mz-small mt-0.5">{event.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Tend your garden */}
      <section aria-labelledby="garden-tend" className="mz-card p-5">
        <h2 id="garden-tend" className="mz-card-ttl">
          Tend your garden
        </h2>
        <p className="mz-small mt-1" style={{ color: 'var(--vt-text-muted)' }}>
          A quiet weekly review — a few small things, nothing urgent.
        </p>
        <ul className="mt-3 space-y-2">
          {tendItems.map((item) => (
            <li key={item} className="mz-body flex gap-2">
              <span aria-hidden="true" style={{ color: 'var(--ink-400)' }}>
                ○
              </span>
              {item}
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={hrefFor('notes')} className="mz-btn-ghost mz-btn-sm">
            Start with your notes
          </Link>
          {/* "Review candidates" read as employer/ATS vocabulary on a clinician
              surface; these are publication candidates (research surface). */}
          <Link href={hrefFor('research')} className="mz-btn-ghost mz-btn-sm">
            Review publication candidates
          </Link>
        </div>
      </section>
    </div>
  );
}

/** Deterministic, count-grounded tend list for the live mount. */
function deriveTendItems(data: GardenData): readonly string[] {
  const items: string[] = [];
  const unfiled = data.notes.filter((n) => n.status === 'unfiled').length;
  if (unfiled > 0) {
    items.push(
      `${unfiled} seed${unfiled === 1 ? ' is' : 's are'} unfiled — read ${unfiled === 1 ? 'it' : 'them'} again, tag ${unfiled === 1 ? 'it' : 'them'}, or let ${unfiled === 1 ? 'it' : 'them'} rest.`,
    );
  }
  const growing = data.notes.filter((n) => n.status === 'growing').length;
  if (growing > 0) {
    items.push(`${growing} draft${growing === 1 ? '' : 's'} await${growing === 1 ? 's' : ''} your review before blooming.`);
  }
  if (data.cvEntries.length > 0) {
    items.push('Reread one Living CV line — does its wording still sound like you?');
  }
  if (items.length === 0) {
    items.push('Capture one true thing from this week — a thought is enough.');
  }
  return items.slice(0, 3);
}

/** Fixture Today-task hrefs are stored against the holder mount; remap for the harness. */
function rewriteTodayHref(href: string, hrefFor: GardenHrefFor): string {
  const [path, query] = href.split('?');
  const params = Object.fromEntries(new URLSearchParams(query ?? ''));
  if (path.endsWith('/notes')) return hrefFor('notes', params);
  if (path.endsWith('/research')) return hrefFor('research', params);
  if (path.endsWith('/opportunities')) return hrefFor('opportunities', params);
  return hrefFor('home');
}
