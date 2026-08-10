/**
 * The employer must SEE the empty sections.
 *
 * The sealed record has carried explicit absences since the packet-absence
 * change, but this view rendered `fields` only and never showed the selected
 * sections — so a section that produced nothing appeared as no row at all, and
 * the reader was free to take the silence for a clean check. The API was honest
 * and the page was not.
 *
 * Every assertion here is against RENDERED HTML. A source scan would pass on a
 * component that imports the data and never paints it, which is precisely the
 * failure being closed.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { ApplicationEvidenceView } from '@/components/applications/ApplicationEvidenceView';
import type {
  ApplicationEvidenceAbsence,
  ApplicationEvidenceLoadResult,
} from '@/lib/applications/evidenceView';

const identityField = {
  sectionId: 'identity',
  fieldId: 'identity.identity.nppes',
  label: 'identity',
  value: 'NPI active · name match',
  evidenceState: 'source_backed' as const,
  sourceId: 'nppes',
  sourceObservedAt: '2026-08-09T11:00:00.000Z',
  freshUntil: null,
  artifactId: null,
  receiptId: null,
};

const licensureAbsence: ApplicationEvidenceAbsence = {
  sectionId: 'licensure',
  evidenceState: 'access_required',
  reason: 'Nothing was found for licensure. Reaching this evidence needs source access VitalCV does not hold, so it was never read.',
};

function fixture(overrides: {
  sectionAbsences?: ApplicationEvidenceAbsence[] | null;
  unexplainedSectionIds?: string[];
  currentAbsences?: ApplicationEvidenceAbsence[];
} = {}): ApplicationEvidenceLoadResult {
  return {
    status: 'ok',
    data: {
      applicationId: 'application-1',
      opportunityId: 'opportunity-1',
      accessPerspective: 'employer',
      mode: 'sealed',
      legacyNotice: null,
      submittedPacket: {
        packetVersion: 1,
        packetHash: 'a'.repeat(64),
        clinicianNpi: '1558302470',
        integrity: 'valid',
        purpose: 'application',
        recipient: 'Example Health',
        consentAt: '2026-08-09T12:00:00.000Z',
        consentReceiptId: 'consent-1',
        selectedSections: ['identity', 'licensure'],
        fields: [identityField],
        sectionAbsences: overrides.sectionAbsences === undefined
          ? [licensureAbsence]
          : overrides.sectionAbsences,
        unexplainedSectionIds: overrides.unexplainedSectionIds ?? [],
        methodologyVersion: '243.3',
        clinicianNote: null,
        lifecycle: 'active',
      },
      currentEvidence: {
        status: 'available',
        observedAt: '2026-08-09T13:00:00.000Z',
        methodologyVersion: '243.3',
        fields: [identityField],
        sectionAbsences: overrides.currentAbsences ?? [],
        changesSinceSubmission: [],
        notice: 'The current profile is shown separately and does not alter the submitted record.',
      },
    },
  };
}

function render(result: ApplicationEvidenceLoadResult): string {
  return renderToStaticMarkup(<ApplicationEvidenceView result={result} />);
}

/**
 * The view renders TWO absence lists — the sealed record and the live panel.
 * Assertions must name which, or a claim made by one silently satisfies a test
 * about the other.
 */
function panel(html: string, scope: 'submitted' | 'current'): string {
  const marker = `data-absences-scope="${scope}"`;
  const start = html.indexOf(marker);
  if (start === -1) return '';
  // End at the list's own closing tag. Slicing to the NEXT scope marker would
  // swallow the field list rendered between the two panels, so an affirmative
  // chip belonging to a real field would read as if it sat on an absence row.
  const listEnd = html.indexOf('</ul>', start);
  const nextScope = html.indexOf('data-absences-scope=', start + marker.length);
  const end = listEnd === -1
    ? (nextScope === -1 ? html.length : nextScope)
    : listEnd + '</ul>'.length;
  return html.slice(start, end);
}

describe('ApplicationEvidenceView — selected sections that produced nothing', () => {
  it('names the empty section and says nothing was found, rather than omitting it', () => {
    const html = render(fixture());

    // The OUTCOME: the reader sees the section and the disclaimer.
    expect(html).toContain('Licensure');
    expect(html).toContain('Nothing was found for these sections');
    expect(html).toContain(licensureAbsence.reason);
    // …and is told explicitly that this is not a clean result.
    expect(html).toContain('not the same as a');
    expect(html).toContain('check that came back clean');
  });

  it('gives the absence a non-affirmative state chip and never a check', () => {
    const html = render(fixture());
    // StateChip renders glyph + word; the word must be the gated one.
    expect(html).toContain('Access required');
    // A section with nothing found must never carry an affirmative word.
    const absenceBlock = panel(html, 'submitted');
    expect(absenceBlock).toContain('Access required');
    expect(absenceBlock).not.toContain('Source-backed');
    expect(absenceBlock).not.toContain('Checked');
  });

  it('states the positive claim when every selected section contributed', () => {
    const html = render(fixture({ sectionAbsences: [] }));
    expect(panel(html, 'submitted')).toContain('Every selected section contributed evidence.');
    expect(panel(html, 'submitted')).not.toContain('Nothing was found for these sections');
  });

  it('distinguishes a record sealed before absences existed from one with none', () => {
    // null + an unexplained section: the record cannot say why, and must say so.
    const html = render(fixture({ sectionAbsences: null, unexplainedSectionIds: ['licensure'] }));
    expect(html).toContain('data-absences="unrecorded"');
    expect(html).toContain('Nothing was found for Licensure');
    expect(html).toContain('does not record why');
    // It must NOT make the positive claim reserved for records that can.
    expect(panel(html, 'submitted')).not.toContain('Every selected section contributed evidence.');
  });

  it('stays silent for a legacy record with no unexplained sections', () => {
    const html = render(fixture({ sectionAbsences: null, unexplainedSectionIds: [] }));
    // The sealed panel says nothing at all; only the live panel's list remains.
    expect(panel(html, 'submitted')).toBe('');
  });

  it('shows current-source silences too, so the live panel is not the honest gap', () => {
    const html = render(fixture({
      sectionAbsences: [],
      currentAbsences: [{
        sectionId: 'enrollment',
        evidenceState: 'unavailable',
        reason: 'Nothing was found for Medicare enrollment. No usable record came back from its source.',
      }],
    }));
    const current = panel(html, 'current');
    expect(current).toContain('Medicare enrollment');
    expect(current).toContain('No usable record came back from its source.');
    // The live panel's wording is its own — it must not borrow the sealed claim.
    expect(current).toContain('current sources');
  });

  it('carries no EC-9 banned noun in the copy this view authors', () => {
    // The view's own strings — not the API-authored reason — must obey EC-9.
    const html = render(fixture({ sectionAbsences: [], currentAbsences: [] }));
    for (const noun of ['wallet', 'passport', 'dossier', 'readiness score', 'trust tier', 'packet']) {
      expect(html.toLowerCase()).not.toContain(noun);
    }
  });
});
