import {
  EDUCATION_TRAINING_CONFIDENCE,
  PA_C_INFERRED_PROGRAM,
  PA_C_INFERRED_SPECIALTY,
  buildEducationRecord,
  formatTrainingDisplay,
  inferTrainingFromCredentials,
  isPaCCredential,
  normalizeInstitution,
  type TrainingRecord,
} from '@vitalcv/ingest';

describe('education + training layer', () => {
  describe('normalizeInstitution', () => {
    it('expands common abbreviations and title-cases the result', () => {
      expect(normalizeInstitution('univ. of texas medical school')).toBe(
        'University of Texas Medical School',
      );
    });

    it('collapses whitespace and strips surrounding punctuation', () => {
      expect(normalizeInstitution('  Stanford  University.  ')).toBe(
        'Stanford University',
      );
    });

    it('keeps small connector words lowercase mid-name', () => {
      expect(normalizeInstitution('university of pennsylvania')).toBe(
        'University of Pennsylvania',
      );
    });

    it('returns empty string for blank or non-string input', () => {
      expect(normalizeInstitution('')).toBe('');
      expect(normalizeInstitution('   ')).toBe('');
      // @ts-expect-error — exercising the runtime guard
      expect(normalizeInstitution(undefined)).toBe('');
    });
  });

  describe('isPaCCredential', () => {
    it.each([
      'PA-C',
      'pa-c',
      'PAC',
      'PA C',
      'Macie Miller, PA-C',
      'Certified Physician Assistant',
      'physician assistant',
    ])('detects %s as a PA credential', (value) => {
      expect(isPaCCredential(value)).toBe(true);
    });

    it.each(['MD', 'NP', 'RN', 'paco', 'pacific'])(
      'does not match %s',
      (value) => {
        expect(isPaCCredential(value)).toBe(false);
      },
    );
  });

  describe('inferTrainingFromCredentials', () => {
    it('infers an Accredited PA Program from a PA-C credential', () => {
      const records = inferTrainingFromCredentials({
        providerId: 'provider:macie-miller',
        credentialMentions: ['Macie Miller, PA-C'],
      });

      expect(records).toHaveLength(1);
      const [record] = records;
      expect(record).toEqual({
        provider_id: 'provider:macie-miller',
        program: PA_C_INFERRED_PROGRAM,
        specialty: PA_C_INFERRED_SPECIALTY,
        confidence: EDUCATION_TRAINING_CONFIDENCE.inferred,
        provenance: 'inferred',
      });
    });

    it('does not infer training when no credential matches', () => {
      const records = inferTrainingFromCredentials({
        providerId: 'provider:rn-only',
        credentialMentions: ['RN, BSN', 'CA license #12345'],
      });
      expect(records).toEqual([]);
    });

    it('emits exactly one PA program record even when PA-C appears multiple times', () => {
      const records = inferTrainingFromCredentials({
        providerId: 'provider:dup',
        credentialMentions: ['PA-C', 'pa-c', 'Physician Assistant'],
      });
      expect(records).toHaveLength(1);
      expect(records[0].program).toBe(PA_C_INFERRED_PROGRAM);
    });
  });

  describe('buildEducationRecord', () => {
    it('normalizes the institution and applies extracted confidence by default', () => {
      const record = buildEducationRecord({
        providerId: 'provider:1',
        institution: 'univ. of pennsylvania',
        degree: 'MD',
        year: 2018,
      });
      expect(record).toEqual({
        provider_id: 'provider:1',
        institution: 'University of Pennsylvania',
        degree: 'MD',
        year: 2018,
        confidence: EDUCATION_TRAINING_CONFIDENCE.extracted,
        provenance: 'extracted',
      });
    });

    it('omits year when not finite', () => {
      const record = buildEducationRecord({
        providerId: 'provider:1',
        institution: 'Stanford',
        degree: 'BS',
      });
      expect('year' in record).toBe(false);
    });
  });

  describe('formatTrainingDisplay', () => {
    it('renders the canonical Training: block for the Macie scenario', () => {
      const records: readonly TrainingRecord[] = inferTrainingFromCredentials({
        providerId: 'provider:macie-miller',
        credentialMentions: ['Macie Miller, PA-C'],
      });

      expect(formatTrainingDisplay(records)).toBe(
        ['Training:', '- Accredited PA Program'].join('\n'),
      );
    });

    it('renders multiple records in order', () => {
      const records: TrainingRecord[] = [
        {
          provider_id: 'p1',
          program: 'Accredited PA Program',
          specialty: 'Physician Assistant',
          confidence: 0.6,
          provenance: 'inferred',
        },
        {
          provider_id: 'p1',
          program: 'Family Medicine Residency',
          confidence: 0.85,
          provenance: 'extracted',
        },
      ];
      expect(formatTrainingDisplay(records)).toBe(
        [
          'Training:',
          '- Accredited PA Program',
          '- Family Medicine Residency',
        ].join('\n'),
      );
    });

    it('returns an empty placeholder when there are no records', () => {
      expect(formatTrainingDisplay([])).toBe('Training:\n  (none)');
    });
  });

  describe('Macie scenario (end-to-end inference)', () => {
    it('produces the expected Training: UI output for a PA-C provider', () => {
      const macieCredentials = [
        'Macie Miller, PA-C',
        'NCCPA #1234567',
        'CA license #PA98765',
      ];

      const inferred = inferTrainingFromCredentials({
        providerId: 'provider:macie-miller',
        credentialMentions: macieCredentials,
      });

      // Step 5 expectation: Macie should have inferred training.
      expect(inferred).toHaveLength(1);
      expect(inferred[0].program).toBe('Accredited PA Program');
      expect(inferred[0].provenance).toBe('inferred');

      // Step 4 expectation: the rendered UI block matches the spec.
      expect(formatTrainingDisplay(inferred)).toBe(
        'Training:\n- Accredited PA Program',
      );
    });
  });
});
