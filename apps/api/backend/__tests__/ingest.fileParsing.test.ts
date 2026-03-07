import { parseCandidateCredential, ResumeIngestError } from '../../../../packages/ingest';

function asBase64(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64');
}

describe('ingest file parsing hardening', () => {
  it('preserves UTF-8 resume content without truncation', () => {
    const parsed = parseCandidateCredential({
      clinician_id: 'clinician:utf8:001',
      filename: 'resume.pdf',
      mime_type: 'application/pdf',
      content_base64: asBase64([
        'Jose Alvarez',
        'Education: Universidad Nacional',
        'Licensure: CA LICENSE #CA12345',
      ].join('\n')),
    });

    expect(parsed.name_hint).toBe('Jose Alvarez');
    expect(parsed.licenses).toEqual([
      expect.objectContaining({
        state: 'CA',
        number: 'CA12345',
        source: 'resume',
        status: 'UNVERIFIED',
      }),
    ]);
  });

  it('rejects malformed or truncated base64 payloads', () => {
    expect(() =>
      parseCandidateCredential({
        clinician_id: 'clinician:utf8:002',
        filename: 'resume.pdf',
        mime_type: 'application/pdf',
        content_base64: asBase64('Taylor Wrong').slice(0, -1),
      }),
    ).toThrow(ResumeIngestError);
  });

  it('rejects invalid UTF-8 payloads instead of silently replacing bytes', () => {
    expect(() =>
      parseCandidateCredential({
        clinician_id: 'clinician:utf8:003',
        filename: 'resume.pdf',
        mime_type: 'application/pdf',
        content_base64: Buffer.from([0xff, 0xfe, 0xfd]).toString('base64'),
      }),
    ).toThrow('valid UTF-8');
  });
});
