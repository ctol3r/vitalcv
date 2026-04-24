// @vitest-environment jsdom

/**
 * ProfileView — render-invariant tests.
 *
 * Pin the three documented invariants from ProfileView.tsx:
 *
 *   I1. Ordering is deterministic at the DATA layer: verified → inferred →
 *       unknown. Components never re-sort; ordering is checked at render
 *       time here.
 *
 *   I2. Every field renders through FieldConfidenceBadge. Exactly one badge
 *       per row — no bare values, no duplicates.
 *
 *   I3. Null/missing fields still render a row through viewField(). The UI
 *       shape is stable across providers with varying enrichment coverage.
 *
 * Also covers the formatField resolution of the long-standing TODO:
 *   - null / undefined / empty → Unknown
 *   - Date / ISO strings → readable date
 *   - number / boolean coercion
 *   - long-string truncation with title-attr reveal
 *   - debug=true appends source label inline
 *
 * NOTE on isolation: ProfileView is an RSC but carries no state/effects, so
 * the React 19 client renderer is sufficient to exercise it. If a future
 * change introduces 'use client' children, this harness still works.
 */

import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import {
  confidenceField,
  fromSource,
  type ConfidenceField,
} from '@domain-common/dataConfidence';

import {
  ProfileView,
  formatFieldValue,
} from '@/components/profile/ProfileView';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function renderNode(node: React.ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(node);
  });
  return {
    container,
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

// Pull out every <li> row and return a minimal structural shape so assertions
// can read naturally. Co-locates the DOM query so individual tests don't
// re-roll the same selector boilerplate.
function rows(container: HTMLElement) {
  return Array.from(container.querySelectorAll('li')).map((li) => {
    const paragraphs = Array.from(li.querySelectorAll('p'));
    // First <p> is the label (uppercase tracking-widest), second is value.
    const labelEl = paragraphs[0];
    const valueEl = paragraphs[1];
    const badge = li.querySelector<HTMLElement>('[data-confidence]');
    return {
      li,
      label: labelEl?.textContent ?? '',
      value: valueEl?.textContent ?? '',
      valueTitle: valueEl?.getAttribute('title') ?? null,
      confidence: badge?.getAttribute('data-confidence') ?? null,
      badgeText: badge?.textContent ?? '',
      badgeCount: li.querySelectorAll('[data-confidence]').length,
    };
  });
}

afterEach(() => {
  document.body.replaceChildren();
});

// ── Shared fixture ─────────────────────────────────────────────────────────
//
// Deliberately constructed out of DATA-layer order so I1 has something to
// assert against — if ProfileView silently rendered in insertion order, this
// fixture would expose it.

type Key = 'fullName' | 'npi' | 'specialty' | 'yearsExperience' | 'license';

const fixtureFields: Readonly<
  Record<Key, ConfidenceField<unknown> | null | undefined>
> = {
  // unknown (inserted first — should sort LAST)
  yearsExperience: null,
  // inferred
  specialty: confidenceField('Emergency Medicine', fromSource('INFERENCE')),
  // verified (inserted in the middle — should sort FIRST)
  npi: confidenceField('1346053246', fromSource('NPPES')),
  // inferred
  fullName: confidenceField('Macie Miller', fromSource('USER_UPLOAD')),
  // verified
  license: confidenceField('CA-12345', fromSource('STATE_BOARD')),
};

const fixtureLabels: Readonly<Record<Key, string>> = {
  fullName: 'Full Name',
  npi: 'NPI',
  specialty: 'Specialty',
  yearsExperience: 'Years Experience',
  license: 'License',
};

// ── Tests ──────────────────────────────────────────────────────────────────

describe('ProfileView — I1 deterministic ordering', () => {
  it('emits rows in verified → inferred → unknown order regardless of input key order', async () => {
    const view = await renderNode(
      <ProfileView fields={fixtureFields} fieldLabels={fixtureLabels} />,
    );

    const out = rows(view.container);
    const ranks = out.map((r) => r.confidence);

    // Two verified, two inferred, one unknown — in that rank order.
    expect(ranks).toEqual([
      'verified',
      'verified',
      'inferred',
      'inferred',
      'unknown',
    ]);

    // Within each rank, the insertion order survives (stable sort).
    // Fixture insertion order by rank:
    //   verified: npi (idx 2), license (idx 4)
    //   inferred: specialty (idx 1), fullName (idx 3)
    //   unknown:  yearsExperience (idx 0)
    expect(out.map((r) => r.label)).toEqual([
      'NPI',
      'License',
      'Specialty',
      'Full Name',
      'Years Experience',
    ]);

    await view.unmount();
  });
});

describe('ProfileView — I2 every row has exactly one badge', () => {
  it('renders one badge per row and zero bare value rows', async () => {
    const view = await renderNode(
      <ProfileView fields={fixtureFields} fieldLabels={fixtureLabels} />,
    );

    const out = rows(view.container);
    expect(out).toHaveLength(5);
    for (const row of out) {
      expect(row.badgeCount).toBe(1);
      expect(row.confidence).not.toBeNull();
    }

    // The section-level count should equal the row count — no badge-less
    // escape hatch and no hidden extras elsewhere in the section.
    const section = view.container.querySelector('section');
    expect(section?.querySelectorAll('[data-confidence]').length).toBe(5);

    await view.unmount();
  });

  it('exposes accessible name for every badge (screen-reader posture)', async () => {
    const view = await renderNode(
      <ProfileView fields={fixtureFields} fieldLabels={fixtureLabels} />,
    );

    const badges = view.container.querySelectorAll('[data-confidence]');
    expect(badges.length).toBeGreaterThan(0);
    for (const el of Array.from(badges)) {
      expect(el.getAttribute('role')).toBe('status');
      expect(el.getAttribute('aria-label')).toBeTruthy();
    }

    await view.unmount();
  });
});

describe('ProfileView — I3 null/missing fields still render', () => {
  it('renders a null field as an unknown row with the Unknown sentinel', async () => {
    const view = await renderNode(
      <ProfileView fields={fixtureFields} fieldLabels={fixtureLabels} />,
    );

    const unknownRow = rows(view.container).find(
      (r) => r.label === 'Years Experience',
    );
    expect(unknownRow).toBeDefined();
    expect(unknownRow?.confidence).toBe('unknown');
    expect(unknownRow?.value).toBe('Unknown');

    await view.unmount();
  });

  it('renders an undefined field as an unknown row with the Unknown sentinel', async () => {
    const fields = {
      middleName: undefined,
    };
    const view = await renderNode(
      <ProfileView
        fields={fields}
        fieldLabels={{ middleName: 'Middle Name' }}
      />,
    );

    const row = rows(view.container)[0];
    expect(row?.label).toBe('Middle Name');
    expect(row?.confidence).toBe('unknown');
    expect(row?.value).toBe('Unknown');

    await view.unmount();
  });

  it('survives an all-null input — no crashes, every row is unknown', async () => {
    const allNull: Record<Key, null> = {
      fullName: null,
      npi: null,
      specialty: null,
      yearsExperience: null,
      license: null,
    };
    const view = await renderNode(
      <ProfileView fields={allNull} fieldLabels={fixtureLabels} />,
    );

    const out = rows(view.container);
    expect(out).toHaveLength(5);
    for (const row of out) {
      expect(row.confidence).toBe('unknown');
      expect(row.value).toBe('Unknown');
    }

    await view.unmount();
  });
});

describe('ProfileView — formatField value coercion', () => {
  it('collapses an empty string to the Unknown sentinel and Unknown badge', async () => {
    const fields = {
      nickname: confidenceField('', fromSource('USER_UPLOAD')),
    };
    const view = await renderNode(
      <ProfileView
        fields={fields}
        fieldLabels={{ nickname: 'Nickname' }}
      />,
    );
    expect(rows(view.container)[0]?.value).toBe('Unknown');
    expect(rows(view.container)[0]?.confidence).toBe('unknown');
    await view.unmount();
  });

  it('coerces a number field to its string form', async () => {
    const fields = {
      count: confidenceField(42, fromSource('NPPES')),
    };
    const view = await renderNode(
      <ProfileView fields={fields} fieldLabels={{ count: 'Count' }} />,
    );
    expect(rows(view.container)[0]?.value).toBe('42');
    await view.unmount();
  });

  it('coerces a boolean field to Yes/No', async () => {
    const fields = {
      active: confidenceField(true, fromSource('NPPES')),
      retired: confidenceField(false, fromSource('NPPES')),
    };
    const view = await renderNode(
      <ProfileView
        fields={fields}
        fieldLabels={{ active: 'Active', retired: 'Retired' }}
      />,
    );
    const out = rows(view.container);
    expect(out.find((r) => r.label === 'Active')?.value).toBe('Yes');
    expect(out.find((r) => r.label === 'Retired')?.value).toBe('No');
    await view.unmount();
  });

  it('coerces a Date field to a readable date', async () => {
    const fields = {
      issuedAt: confidenceField(
        new Date('2024-06-15T12:30:00.000Z'),
        fromSource('STATE_BOARD'),
      ),
    };
    const view = await renderNode(
      <ProfileView fields={fields} fieldLabels={{ issuedAt: 'Issued' }} />,
    );
    expect(rows(view.container)[0]?.value).toBe('Jun 15, 2024');
    await view.unmount();
  });

  it('coerces an ISO date string to a readable date', async () => {
    const fields = {
      issuedAt: confidenceField(
        '2024-06-15T12:30:00.000Z',
        fromSource('STATE_BOARD'),
      ),
    };
    const view = await renderNode(
      <ProfileView fields={fields} fieldLabels={{ issuedAt: 'Issued' }} />,
    );
    expect(rows(view.container)[0]?.value).toBe('Jun 15, 2024');
    await view.unmount();
  });

  it('leaves malformed date strings readable instead of crashing', async () => {
    const fields = {
      issuedAt: confidenceField('2024-02-31', fromSource('NPPES')),
    };
    const view = await renderNode(
      <ProfileView fields={fields} fieldLabels={{ issuedAt: 'Issued' }} />,
    );
    expect(rows(view.container)[0]?.value).toBe('2024-02-31');
    await view.unmount();
  });

  it('collapses an invalid Date object to the Unknown sentinel and Unknown badge', async () => {
    const fields = {
      issuedAt: confidenceField(new Date('not-a-date'), fromSource('NPPES')),
    };
    const view = await renderNode(
      <ProfileView fields={fields} fieldLabels={{ issuedAt: 'Issued' }} />,
    );
    expect(rows(view.container)[0]?.value).toBe('Unknown');
    expect(rows(view.container)[0]?.confidence).toBe('unknown');
    await view.unmount();
  });

  it('coerces arrays without crashing or rendering object placeholders', async () => {
    const fields = {
      aliases: confidenceField(
        ['Emergency Medicine', 'Urgent Care', null, undefined, ''],
        fromSource('USER_UPLOAD'),
      ),
    };
    const view = await renderNode(
      <ProfileView
        fields={fields}
        fieldLabels={{ aliases: 'Aliases' }}
      />,
    );

    const row = rows(view.container)[0];
    expect(row?.value).toBe('Emergency Medicine, Urgent Care');
    expect(view.container.textContent).not.toContain('[object Object]');

    await view.unmount();
  });

  it('coerces object fields to compact readable text instead of [object Object]', async () => {
    const fields = {
      practiceAddress: confidenceField(
        { city: 'Oakland', state: 'CA' },
        fromSource('NPPES'),
      ),
    };
    const view = await renderNode(
      <ProfileView
        fields={fields}
        fieldLabels={{ practiceAddress: 'Practice Address' }}
      />,
    );

    const row = rows(view.container)[0];
    expect(row?.value).toBe('city: Oakland; state: CA');
    expect(view.container.textContent).not.toContain('[object Object]');

    await view.unmount();
  });

  it('does not crash on malformed object payloads', () => {
    const returnsUndefined = {
      toJSON: () => undefined,
    };
    const throwsOnRead = Object.defineProperty({}, 'bad', {
      enumerable: true,
      get() {
        throw new Error('bad payload');
      },
    });

    expect(() => formatFieldValue(returnsUndefined)).not.toThrow();
    expect(formatFieldValue(returnsUndefined)).toBe('Unknown');
    expect(() => formatFieldValue(throwsOnRead)).not.toThrow();
    expect(formatFieldValue(throwsOnRead)).toBe('[unreadable object]');
  });

  it('does not recurse forever on circular arrays', () => {
    const circular: unknown[] = ['root'];
    circular.push(circular);

    expect(() => formatFieldValue(circular)).not.toThrow();
    expect(formatFieldValue(circular)).toBe('root, [circular]');
  });

  it('truncates long strings and exposes the full text via title attr', async () => {
    const long =
      'This is a very long bio that exceeds the eighty-character truncation limit set in ProfileView.';
    const fields = {
      bio: confidenceField(long, fromSource('USER_UPLOAD')),
    };
    const view = await renderNode(
      <ProfileView fields={fields} fieldLabels={{ bio: 'Bio' }} />,
    );

    const row = rows(view.container)[0];
    expect(row?.value).not.toBe(long);
    expect(row?.value?.endsWith('\u2026')).toBe(true);
    expect(row?.value?.length).toBeLessThanOrEqual(80);
    expect(row?.valueTitle).toBe(long);

    await view.unmount();
  });

  it('does NOT attach a title attr when the value is short enough to fit', async () => {
    const fields = {
      npi: confidenceField('1346053246', fromSource('NPPES')),
    };
    const view = await renderNode(
      <ProfileView fields={fields} fieldLabels={{ npi: 'NPI' }} />,
    );
    expect(rows(view.container)[0]?.valueTitle).toBeNull();
    await view.unmount();
  });
});

describe('ProfileView — debug mode', () => {
  it('appends the source label inline when debug=true', async () => {
    const fields = {
      specialty: confidenceField(
        'Emergency Medicine',
        fromSource('INFERENCE'),
      ),
    };
    const view = await renderNode(
      <ProfileView
        fields={fields}
        fieldLabels={{ specialty: 'Specialty' }}
        debug
      />,
    );
    const row = rows(view.container)[0];
    // Middle-dot separator + human label for INFERENCE source.
    expect(row?.value).toContain('Emergency Medicine');
    expect(row?.value).toContain('\u00B7'); // ·
    expect(row?.value).toContain('Inference');
    await view.unmount();
  });

  it('omits the source label by default', async () => {
    const fields = {
      specialty: confidenceField(
        'Emergency Medicine',
        fromSource('INFERENCE'),
      ),
    };
    const view = await renderNode(
      <ProfileView
        fields={fields}
        fieldLabels={{ specialty: 'Specialty' }}
      />,
    );
    const row = rows(view.container)[0];
    expect(row?.value).toBe('Emergency Medicine');
    expect(row?.value).not.toContain('\u00B7');
    await view.unmount();
  });
});

describe('ProfileView — honest confidence semantics', () => {
  it('labels AI inference as Inferred (AI)', async () => {
    const fields = {
      specialty: confidenceField(
        'Emergency Medicine',
        fromSource('INFERENCE'),
      ),
    };
    const view = await renderNode(
      <ProfileView
        fields={fields}
        fieldLabels={{ specialty: 'Specialty' }}
      />,
    );

    expect(rows(view.container)[0]?.badgeText).toContain('Inferred (AI)');
    await view.unmount();
  });

  it('does not label user-uploaded fields as AI', async () => {
    const fields = {
      fullName: confidenceField('Macie Miller', fromSource('USER_UPLOAD')),
    };
    const view = await renderNode(
      <ProfileView
        fields={fields}
        fieldLabels={{ fullName: 'Full Name' }}
      />,
    );

    const row = rows(view.container)[0];
    expect(row?.confidence).toBe('inferred');
    expect(row?.badgeText).toContain('Inferred');
    expect(row?.badgeText).not.toContain('AI');
    await view.unmount();
  });
});

describe('ProfileView — header', () => {
  it('renders the default title when none is provided', async () => {
    const view = await renderNode(
      <ProfileView fields={{}} fieldLabels={{} as Record<string, string>} />,
    );
    const section = view.container.querySelector('section');
    expect(section?.getAttribute('aria-label')).toBe('Provider profile');
    await view.unmount();
  });

  it('renders a provided title + subtitle', async () => {
    const view = await renderNode(
      <ProfileView
        fields={{}}
        fieldLabels={{} as Record<string, string>}
        title="Clinician"
        subtitle="Macie Miller · PA-C"
      />,
    );
    const section = view.container.querySelector('section');
    expect(section?.getAttribute('aria-label')).toBe('Clinician');
    expect(section?.textContent).toContain('Macie Miller');
    await view.unmount();
  });
});
