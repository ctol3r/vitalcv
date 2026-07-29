/**
 * P0.1 containment — GET /api/directory must not publicly assert a specialty
 * or taxonomy when its provenance is unknown.
 *
 * `/api/directory` is unauthenticated (tenantGuard intelligence-read prefix)
 * and formerly served stored `Provider.taxonomyCode` values as specialties.
 * The same value reached three output formats:
 * the structured JSON, the FHIR PractitionerRole `specialty` coding, and the
 * CSV `Specialties` column.
 *
 * These tests assert the outcome — no stored taxonomy code reaches a public
 * caller in any format — rather than the mechanism, so a later
 * provenance-carrying rewrite stays free to change how it is suppressed.
 */

jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    provider: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('../../credentials/credentialWallet', () => ({
  listAllCredentials: jest.fn(() => []),
}));

jest.mock('../../registry/trustRegistry', () => ({
  initializeTrustRegistryPersistence: jest.fn(async () => undefined),
  listIssuers: jest.fn(() => []),
}));

jest.mock('../../revocation/revocationRegistry', () => ({
  isRevoked: jest.fn(() => false),
}));

import prisma from '../../../graphql/prisma_client';
import {
  exportCSVDirectory,
  exportFHIRDirectory,
  generateDirectory,
  generateSignedDirectory,
  getDirectorySnapshot,
  publishDirectorySnapshot,
} from '../providerDirectory';

const prismaMock = prisma as unknown as {
  provider: { findMany: jest.Mock };
};

/** Synthetic rows retain the formerly unsafe stored-field shape without using production identities. */
const SYNTHETIC_ROWS = [
  { npi: '9000000001', fullName: 'Synthetic Clinician 01', storedTaxonomy: '207R00000X', sourceTaxonomy: '208M00000X' },
  { npi: '9000000002', fullName: 'Synthetic Clinician 02', storedTaxonomy: '207R00000X', sourceTaxonomy: '207ZP0102X' },
  { npi: '9000000003', fullName: 'Synthetic Clinician 03', storedTaxonomy: '207R00000X', sourceTaxonomy: '207L00000X' },
  { npi: '9000000004', fullName: 'Synthetic Clinician 04', storedTaxonomy: '207R00000X', sourceTaxonomy: '363LF0000X' },
  { npi: '9000000005', fullName: 'Synthetic Clinician 05', storedTaxonomy: '207R00000X', sourceTaxonomy: '122300000X' },
  { npi: '9000000006', fullName: 'Synthetic Clinician 06', storedTaxonomy: '207R00000X', sourceTaxonomy: '225700000X' },
  { npi: '9000000007', fullName: 'Synthetic Organization 01', storedTaxonomy: '207R00000X', sourceTaxonomy: '111N00000X' },
  { npi: '9000000008', fullName: 'Synthetic Organization 02', storedTaxonomy: '207R00000X', sourceTaxonomy: '152W00000X' },
] as const;

describe('provider directory — P0.1 truth containment', () => {
  beforeEach(() => {
    prismaMock.provider.findMany.mockReset();
    // The mock ignores `select` and returns the full stored row on purpose. A
    // fixture that returned only the safe columns would make `taxonomyCode`
    // undefined, and every assertion below would pass even against a service
    // that forwards it.
    prismaMock.provider.findMany.mockResolvedValue(
      SYNTHETIC_ROWS.map((row) => ({
        npi: row.npi,
        fullName: row.fullName,
        taxonomyCode: row.storedTaxonomy,
        stateOfPractice: 'CA',
      })),
    );
  });

  it('still lists every provider by NPI and name', async () => {
    const directory = await generateDirectory({ pageSize: 100 });

    expect(directory.entries).toHaveLength(SYNTHETIC_ROWS.length);
    for (const row of SYNTHETIC_ROWS) {
      const entry = directory.entries.find((e) => e.npi === row.npi);
      expect(entry).toBeDefined();
      expect(entry?.fullName).toBe(row.fullName);
    }
  });

  it('publishes no specialty for any affected record in the structured JSON', async () => {
    const directory = await generateDirectory({ pageSize: 100 });

    for (const entry of directory.entries) {
      expect(entry.specialties).toEqual([]);
    }
    expect(JSON.stringify(directory)).not.toContain('207R00000X');
  });

  it('publishes no taxonomy coding in the FHIR export', async () => {
    const bundle = await exportFHIRDirectory({ pageSize: 100 });

    expect(bundle.entry).toHaveLength(SYNTHETIC_ROWS.length);
    for (const item of bundle.entry) {
      expect(item.resource.specialty).toEqual([]);
    }
    expect(JSON.stringify(bundle)).not.toContain('207R00000X');
  });

  it('publishes no taxonomy in the CSV export', async () => {
    const csv = await exportCSVDirectory({ pageSize: 100 });

    expect(csv.content).not.toContain('207R00000X');
    // The column stays so the CSV header contract is unchanged; it is empty.
    expect(csv.content).toContain('Specialties');
    for (const row of csv.content.split('\n').slice(1).filter(Boolean)) {
      expect(row).toContain('""');
    }
  });

  it('does not read the unsourced columns from the database', async () => {
    await generateDirectory({ pageSize: 100 });

    const select = prismaMock.provider.findMany.mock.calls[0][0].select;
    expect(Object.keys(select).sort()).toEqual(['fullName', 'npi']);
  });

  it('marks specialties as withheld so empty does not read as none', async () => {
    const directory = await generateDirectory({ pageSize: 100 });

    expect(directory.fieldsWithheld).toEqual(['specialties']);
    expect(directory.disclosure).toContain('not source-backed');
  });

  it('never emits any alternate source taxonomy either — nothing is substituted', async () => {
    const directory = await generateDirectory({ pageSize: 100 });
    const serialized = JSON.stringify(directory);

    for (const row of SYNTHETIC_ROWS) {
      expect(serialized).not.toContain(row.sourceTaxonomy);
    }
  });

  /**
   * Both of these are reachable unauthenticated on the backend's own public
   * domain (api.vitalcv.com), not only through the web proxy, and both embed
   * full `DirectoryEntry` objects rather than a projection. The signed envelope
   * is the worst case: it carries `issuer: did:vitalcv:directory` and an
   * integrity hash, so anything inside it is a claim VitalCV has attested to.
   */
  it('publishes no taxonomy in the signed federation envelope', async () => {
    const signed = await generateSignedDirectory({ pageSize: 100 });

    expect(signed.entries).toHaveLength(SYNTHETIC_ROWS.length);
    for (const entry of signed.entries) {
      expect(entry.specialties).toEqual([]);
    }
    expect(JSON.stringify(signed)).not.toContain('207R00000X');
  });

  it('publishes no taxonomy in a point-in-time directory snapshot', async () => {
    const { snapshotId } = await publishDirectorySnapshot('containment-test', { pageSize: 100 });
    const snapshot = getDirectorySnapshot(snapshotId);

    expect(snapshot).not.toBeNull();
    expect(snapshot?.entries).toHaveLength(SYNTHETIC_ROWS.length);
    for (const entry of snapshot?.entries ?? []) {
      expect(entry.specialties).toEqual([]);
    }
    expect(JSON.stringify(snapshot)).not.toContain('207R00000X');
  });
});
