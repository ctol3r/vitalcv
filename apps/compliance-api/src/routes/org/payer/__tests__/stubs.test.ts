/**
 * B137C-CI-006: CAQH and PECOS Stubs Tests
 *
 * Verifies that CAQH and PECOS integration stubs are working correctly
 * for testing environments where external APIs are not available.
 */

import { describe, it, expect } from '@jest/globals';

/**
 * CAQH ProView API Stub
 */
class CaqhStub {
  private mockProviders: Map<string, any>;

  constructor() {
    this.mockProviders = new Map();
    this.seedMockData();
  }

  private seedMockData() {
    this.mockProviders.set('caqh-123456', {
      provider_id: 'caqh-123456',
      npi: '1234567890',
      first_name: 'John',
      last_name: 'Doe',
      licenses: [
        {
          state: 'CA',
          number: 'CA-123456',
          issue_date: '2015-01-01',
          expiration_date: '2026-01-01',
          status: 'ACTIVE'
        }
      ],
      board_certifications: [
        {
          board_name: 'American Board of Internal Medicine',
          specialty: 'Internal Medicine',
          certification_date: '2015-06-01',
          expiration_date: '2025-06-01',
          recertification_required: true
        }
      ],
      malpractice_insurance: [
        {
          carrier: 'XYZ Insurance',
          policy_number: 'POL-123456',
          coverage_amount: 1000000,
          effective_date: '2025-01-01',
          expiration_date: '2026-01-01'
        }
      ]
    });
  }

  async getProvider(caqhId: string): Promise<any> {
    const provider = this.mockProviders.get(caqhId);
    if (!provider) {
      throw new Error(`Provider not found: ${caqhId}`);
    }
    return provider;
  }

  async authenticate(): Promise<string> {
    return 'mock-caqh-token';
  }
}

/**
 * PECOS API Stub
 */
class PecosStub {
  private mockEnrollments: Map<string, any>;

  constructor() {
    this.mockEnrollments = new Map();
    this.seedMockData();
  }

  private seedMockData() {
    this.mockEnrollments.set('I0123456789', {
      enrollment_id: 'I0123456789',
      npi: '1234567890',
      enrollment_type: 'MEDICARE_AB',
      status: 'APPROVED',
      effective_date: '2020-01-01',
      revalidation_due: '2025-01-01',
      last_revalidated: '2020-01-01'
    });

    this.mockEnrollments.set('R0298765432', {
      enrollment_id: 'R0298765432',
      npi: '9876543210',
      enrollment_type: 'MEDICARE_ADVANTAGE',
      status: 'APPROVED',
      effective_date: '2022-06-01',
      revalidation_due: '2025-06-01',
      last_revalidated: '2022-06-01'
    });
  }

  async getEnrollment(pecosId: string): Promise<any> {
    const enrollment = this.mockEnrollments.get(pecosId);
    if (!enrollment) {
      throw new Error(`Enrollment not found: ${pecosId}`);
    }
    return enrollment;
  }

  async checkStatus(npi: string): Promise<any> {
    // Find enrollment by NPI
    for (const [_, enrollment] of this.mockEnrollments.entries()) {
      if (enrollment.npi === npi) {
        return {
          npi: enrollment.npi,
          status: enrollment.status,
          revalidation_due: enrollment.revalidation_due,
          revalidation_completed: false
        };
      }
    }
    throw new Error(`No enrollment found for NPI: ${npi}`);
  }

  async authenticate(): Promise<string> {
    return 'mock-pecos-token';
  }
}

describe('CAQH Integration Stub', () => {
  let caqhStub: CaqhStub;

  beforeEach(() => {
    caqhStub = new CaqhStub();
  });

  it('should authenticate successfully', async () => {
    const token = await caqhStub.authenticate();
    expect(token).toBe('mock-caqh-token');
  });

  it('should retrieve provider data', async () => {
    const provider = await caqhStub.getProvider('caqh-123456');
    expect(provider).toBeDefined();
    expect(provider.provider_id).toBe('caqh-123456');
    expect(provider.npi).toBe('1234567890');
  });

  it('should include license information', async () => {
    const provider = await caqhStub.getProvider('caqh-123456');
    expect(provider.licenses).toBeInstanceOf(Array);
    expect(provider.licenses.length).toBeGreaterThan(0);
    expect(provider.licenses[0]).toHaveProperty('state');
    expect(provider.licenses[0]).toHaveProperty('number');
    expect(provider.licenses[0]).toHaveProperty('status');
  });

  it('should include board certification', async () => {
    const provider = await caqhStub.getProvider('caqh-123456');
    expect(provider.board_certifications).toBeInstanceOf(Array);
    expect(provider.board_certifications.length).toBeGreaterThan(0);
  });

  it('should include malpractice insurance', async () => {
    const provider = await caqhStub.getProvider('caqh-123456');
    expect(provider.malpractice_insurance).toBeInstanceOf(Array);
    expect(provider.malpractice_insurance.length).toBeGreaterThan(0);
  });

  it('should throw error for non-existent provider', async () => {
    await expect(caqhStub.getProvider('nonexistent')).rejects.toThrow('Provider not found');
  });
});

describe('PECOS Integration Stub', () => {
  let pecosStub: PecosStub;

  beforeEach(() => {
    pecosStub = new PecosStub();
  });

  it('should authenticate successfully', async () => {
    const token = await pecosStub.authenticate();
    expect(token).toBe('mock-pecos-token');
  });

  it('should retrieve enrollment data', async () => {
    const enrollment = await pecosStub.getEnrollment('I0123456789');
    expect(enrollment).toBeDefined();
    expect(enrollment.enrollment_id).toBe('I0123456789');
    expect(enrollment.npi).toBe('1234567890');
  });

  it('should include enrollment type', async () => {
    const enrollment = await pecosStub.getEnrollment('I0123456789');
    expect(enrollment.enrollment_type).toBe('MEDICARE_AB');
  });

  it('should include revalidation due date', async () => {
    const enrollment = await pecosStub.getEnrollment('I0123456789');
    expect(enrollment).toHaveProperty('revalidation_due');
    expect(typeof enrollment.revalidation_due).toBe('string');
  });

  it('should check status by NPI', async () => {
    const status = await pecosStub.checkStatus('1234567890');
    expect(status).toBeDefined();
    expect(status.npi).toBe('1234567890');
    expect(status.status).toBe('APPROVED');
  });

  it('should handle 3-year cycle enrollments', async () => {
    const enrollment = await pecosStub.getEnrollment('R0298765432');
    expect(enrollment.enrollment_type).toBe('MEDICARE_ADVANTAGE');
  });

  it('should throw error for non-existent enrollment', async () => {
    await expect(pecosStub.getEnrollment('nonexistent')).rejects.toThrow('Enrollment not found');
  });

  it('should throw error for NPI with no enrollment', async () => {
    await expect(pecosStub.checkStatus('0000000000')).rejects.toThrow('No enrollment found');
  });
});

describe('Stub Integration Tests', () => {
  it('should support end-to-end workflow with CAQH and PECOS stubs', async () => {
    const caqhStub = new CaqhStub();
    const pecosStub = new PecosStub();

    // Step 1: Authenticate with both services
    const caqhToken = await caqhStub.authenticate();
    const pecosToken = await pecosStub.authenticate();

    expect(caqhToken).toBeDefined();
    expect(pecosToken).toBeDefined();

    // Step 2: Fetch CAQH data
    const caqhData = await caqhStub.getProvider('caqh-123456');
    expect(caqhData.npi).toBe('1234567890');

    // Step 3: Fetch PECOS data using NPI from CAQH
    const pecosStatus = await pecosStub.checkStatus(caqhData.npi);
    expect(pecosStatus.npi).toBe(caqhData.npi);

    // Step 4: Verify data consistency
    expect(pecosStatus.status).toBe('APPROVED');
  });

  it('should support reconciliation workflow', async () => {
    const caqhStub = new CaqhStub();
    const pecosStub = new PecosStub();

    // Fetch data from both sources
    const caqhData = await caqhStub.getProvider('caqh-123456');
    const pecosStatus = await pecosStub.checkStatus('1234567890');

    // Compare NPI values
    expect(caqhData.npi).toBe(pecosStatus.npi);

    // Verify both sources have active status
    expect(caqhData.licenses[0].status).toBe('ACTIVE');
    expect(pecosStatus.status).toBe('APPROVED');
  });
});

// Export stubs for use in other tests
export { CaqhStub, PecosStub };

