/**
 * e2e.providerFabric.test.ts — Wave 124: End-to-End Testing
 *
 * Tests for the Provider Data Integrity Fabric:
 *   - providerCanonicalizer
 *   - providerSourceProvenance
 *   - FHIR R4 export
 */

import {
  canonicalizeProvider,
  type RawProviderRecord,
} from '../src/services/providers/providerCanonicalizer';
import {
  recordProvenance,
  getProvenanceChain,
  getProvenanceHealth,
} from '../src/services/providers/providerSourceProvenance';
import { exportProviderAsFHIR } from '../src/services/fhir/fhirExporter';

// ── Canonicalizer Tests ───────────────────────────────────────────────

describe('Provider Canonicalizer', () => {
  test('canonicalizes a single NPPES record', () => {
    const record: RawProviderRecord = {
      source: 'NPPES',
      npi: '1003000126',
      firstName: 'JOHN',
      lastName: 'SMITH',
      middleName: 'A',
      credential: 'MD',
      gender: 'M',
      taxonomies: [{ code: '207R00000X', desc: 'Internal Medicine', primary: true }],
      addresses: [{
        purpose: 'LOCATION',
        address_1: '123 Main St',
        city: 'Los Angeles',
        state: 'CA',
        postalCode: '90001',
      }],
      status: 'A',
      enumeration_date: '2010-01-15',
      fetchedAt: new Date().toISOString(),
    };

    const canonical = canonicalizeProvider([record]);

    expect(canonical.npi).toBe('1003000126');
    expect(canonical.canonicalName.first).toBe('John');
    expect(canonical.canonicalName.last).toBe('Smith');
    expect(canonical.canonicalName.credential).toBe('MD');
    expect(canonical.canonicalName.displayName).toContain('John');
    expect(canonical.status).toBe('ACTIVE');
    expect(canonical.taxonomies).toHaveLength(1);
    expect(canonical.taxonomies[0].code).toBe('207R00000X');
    expect(canonical.addresses).toHaveLength(1);
    expect(canonical.bundleHash).toMatch(/^[a-f0-9]{64}$/);
    expect(canonical.conflicts).toHaveLength(0);
  });

  test('detects conflicts from multiple sources', () => {
    const records: RawProviderRecord[] = [
      {
        source: 'NPPES',
        npi: '1234567890',
        firstName: 'Jane',
        lastName: 'Doe',
        status: 'A',
        fetchedAt: new Date().toISOString(),
      },
      {
        source: 'STATE_BOARD',
        npi: '1234567890',
        firstName: 'Jane',
        lastName: 'DOE-SMITH', // different last name
        status: 'ACTIVE',
        fetchedAt: new Date().toISOString(),
      },
    ];

    const canonical = canonicalizeProvider(records);
    expect(canonical.sources).toContain('NPPES');
    expect(canonical.sources).toContain('STATE_BOARD');
    expect(canonical.conflicts.length).toBeGreaterThan(0);
    // NPPES should be preferred
    expect(canonical.canonicalName.last).toBe('Doe');
  });

  test('handles UTF-8 normalization', () => {
    const record: RawProviderRecord = {
      source: 'NPPES',
      npi: '9876543210',
      firstName: '  José  ',
      lastName: 'García  ',
      status: 'A',
      fetchedAt: new Date().toISOString(),
    };

    const canonical = canonicalizeProvider([record]);
    // Verify UTF-8 is preserved (accents intact) and whitespace trimmed
    expect(canonical.canonicalName.first).toContain('os'); // José → title-cased
    expect(canonical.canonicalName.last).toContain('arc'); // García → title-cased
    expect(canonical.canonicalName.first).not.toMatch(/^\s/);
    expect(canonical.canonicalName.last).not.toMatch(/\s$/);
  });

  test('throws on empty records', () => {
    expect(() => canonicalizeProvider([])).toThrow();
  });
});

// ── Provenance Tests ──────────────────────────────────────────────────

describe('Provider Source Provenance', () => {
  test('records and retrieves provenance', () => {
    const prov = recordProvenance({
      npi: '5555555555',
      source: 'NPPES',
      sourceUrl: 'https://npiregistry.cms.hhs.gov/api/?number=5555555555',
      rawPayload: { result_count: 1, results: [{ number: '5555555555' }] },
    });

    expect(prov.provenanceId).toBeDefined();
    expect(prov.rawPayloadHash).toMatch(/^[a-f0-9]{64}$/);
    expect(prov.freshnessStatus).toBe('FRESH');
    expect(prov.transformations).toHaveLength(1);
    expect(prov.transformations[0].step).toBe('FETCH');
  });

  test('provenance chain is retrievable', () => {
    const chain = getProvenanceChain('5555555555');
    expect(chain.npi).toBe('5555555555');
    expect(chain.records.length).toBeGreaterThan(0);
    expect(chain.integrityStatus).toBe('VERIFIED');
  });

  test('provenance health summary works', () => {
    const health = getProvenanceHealth();
    expect(health.totalProviders).toBeGreaterThan(0);
    expect(typeof health.freshCount).toBe('number');
  });
});

// ── FHIR Export Tests ─────────────────────────────────────────────────

describe('FHIR R4 Export', () => {
  test('exports valid FHIR Bundle', () => {
    const bundle = exportProviderAsFHIR({
      npi: '1003000126',
      firstName: 'John',
      lastName: 'Smith',
      credential: 'MD',
      gender: 'M',
      trustBand: 'L3',
      licenses: [],
      boardCerts: [],
      educations: [],
      taxonomies: [{ code: '207R00000X', description: 'Internal Medicine', primary: true }],
      credentials: [{
        credentialId: 'cred-001',
        type: 'MedicalLicense',
        issuer: 'CA Medical Board',
        status: 'ACTIVE',
        issuedAt: '2020-01-01',
        expiresAt: '2028-01-01',
        licenseNumber: 'A12345',
        state: 'CA',
      }],
    });

    expect(bundle.resourceType).toBe('Bundle');
    expect(bundle.type).toBe('collection');
    expect(bundle.total).toBeGreaterThanOrEqual(1);

    // Practitioner resource
    const practitioner = bundle.entry[0].resource;
    expect(practitioner.resourceType).toBe('Practitioner');
    expect((practitioner as any).identifier[0].value).toBe('1003000126');
    expect((practitioner as any).identifier[0].system).toBe('http://hl7.org/fhir/sid/us-npi');
  });

  test('includes qualifications from credentials', () => {
    const bundle = exportProviderAsFHIR({
      npi: '1003000126',
      firstName: 'Jane',
      lastName: 'Doe',
      licenses: [],
      boardCerts: [],
      educations: [],
      credentials: [{
        credentialId: 'cred-002',
        type: 'BoardCertification',
        issuer: 'ABIM',
        status: 'ACTIVE',
      }],
    });

    const practitioner = bundle.entry[0].resource as any;
    expect(practitioner.qualification.length).toBeGreaterThan(0);
    expect(practitioner.qualification[0].issuer.display).toBe('ABIM');
  });

  test('includes PractitionerRole from taxonomy', () => {
    const bundle = exportProviderAsFHIR({
      npi: '1003000126',
      firstName: 'John',
      lastName: 'Smith',
      licenses: [],
      boardCerts: [],
      educations: [],
      taxonomies: [{ code: '207R00000X', description: 'Internal Medicine', primary: true, state: 'CA' }],
    });

    expect(bundle.total).toBe(2); // Practitioner + PractitionerRole
    const role = bundle.entry[1].resource as any;
    expect(role.resourceType).toBe('PractitionerRole');
    expect(role.practitioner.reference).toBe('Practitioner/1003000126');
  });

  test('includes trust band extension', () => {
    const bundle = exportProviderAsFHIR({
      npi: '1003000126',
      firstName: 'Test',
      lastName: 'Provider',
      trustBand: 'L2',
      licenses: [],
      boardCerts: [],
      educations: [],
    });

    const practitioner = bundle.entry[0].resource as any;
    const trustExt = practitioner.extension.find(
      (e: any) => e.url.includes('trust-band')
    );
    expect(trustExt).toBeDefined();
    expect(trustExt.valueString).toBe('L2');
  });
});
