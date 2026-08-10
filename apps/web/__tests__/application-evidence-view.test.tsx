import { renderToStaticMarkup } from 'react-dom/server';
import { ApplicationEvidenceView } from '@/components/applications/ApplicationEvidenceView';
import type { ApplicationEvidenceLoadResult } from '@/lib/applications/evidenceView';

function fixture(): ApplicationEvidenceLoadResult {
  const field = {
    sectionId: 'licensure', fieldId: 'license.state.board', label: 'License', value: null,
    evidenceState: 'access_required' as const, sourceId: 'state-board', sourceObservedAt: null,
    freshUntil: null, artifactId: null, receiptId: null,
  };
  return {
    status: 'ok',
    data: {
      applicationId: 'application-1', opportunityId: 'opportunity-1', accessPerspective: 'clinician', mode: 'sealed', legacyNotice: null,
      submittedPacket: {
        packetVersion: 2, packetHash: 'a'.repeat(64), clinicianNpi: '1558302470', integrity: 'valid',
        purpose: 'application', recipient: 'Example Health', consentAt: '2026-07-16T12:00:00.000Z',
        consentReceiptId: 'consent-1', selectedSections: ['licensure'], fields: [field], sectionAbsences: [], unexplainedSectionIds: [], methodologyVersion: '243.3',
        clinicianNote: null, lifecycle: 'active',
      },
      currentEvidence: {
        status: 'available', observedAt: '2026-07-16T13:00:00.000Z', methodologyVersion: '243.3', fields: [field],
        sectionAbsences: [],
        changesSinceSubmission: [{ fieldId: field.fieldId, label: field.label, kind: 'unchanged', submitted: field, current: field }],
        notice: 'The current profile is shown separately and does not alter the submitted record.',
      },
    },
  };
}

describe('ApplicationEvidenceView', () => {
  it('renders exact packet integrity, consent, current evidence, and non-affirmative state grammar', () => {
    const html = renderToStaticMarkup(<ApplicationEvidenceView result={fixture()} />);
    expect(html).toContain('Submitted record · version 2');
    expect(html).toContain('Integrity valid');
    expect(html).toContain('consent-1');
    expect(html).toContain('The current profile is shown separately');
    expect(html).toContain('Access required');
    expect(html).not.toContain('demo_receipt');
    expect(html).not.toContain('CHECKED');
  });

  it('labels legacy applications without fabricating a submitted packet', () => {
    const base = fixture();
    if (base.status !== 'ok') throw new Error('bad fixture');
    const html = renderToStaticMarkup(<ApplicationEvidenceView result={{
      status: 'ok', data: { ...base.data, mode: 'legacy', submittedPacket: null, legacyNotice: 'Legacy application — no immutable disclosure record was captured at submission.' },
    }} />);
    expect(html).toContain('Legacy application');
    expect(html).toContain('no immutable disclosure record');
    expect(html).not.toContain('Integrity valid');
  });
});
