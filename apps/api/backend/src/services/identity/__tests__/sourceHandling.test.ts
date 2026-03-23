import { parseNursysResult, parseStateBoardResult } from '../phase3Sources';

describe('Source handling, gated truth isolation, and replay integrity', () => {
  it('prevents gated Nursys from being mistaken for live production coverage', () => {
    // Simulated gated payload from fetchNursys
    const raw = { _noCredentials: true, _gated: true, npi: '123' };
    const { claims, receipts } = parseNursysResult(
      '123', raw, 'artifact-mock', 'checksum-mock', new Date().toISOString()
    );

    expect(claims).toHaveLength(1);
    expect(claims[0]?.confidence).toBe('UNCERTAIN');
    expect(claims[0]?.reviewRequired).toBe(true);
    expect(claims[0]?.reviewReason).toContain('credentials not configured');
    
    const licValue = claims[0]?.value as any;
    expect(licValue.licenseStatus).toBe('UNKNOWN');
  });

  it('prevents gated State Board from being mistaken for live production coverage', () => {
    // Simulated unavailable/gated payload from fetchStateBoardLicense
    const raw = { _unavailable: true, _gated: true, npi: '123', state: 'CA' };
    const { claims, receipts } = parseStateBoardResult(
      '123', 'CA', raw, 'artifact-mock', 'checksum-mock', new Date().toISOString()
    );

    expect(claims).toHaveLength(1);
    expect(claims[0]?.confidence).toBe('UNCERTAIN');
    expect(claims[0]?.reviewRequired).toBe(true);
    expect(claims[0]?.reviewReason).toContain('medical board verification unavailable');
    
    const licValue = claims[0]?.value as any;
    expect(licValue.licenseStatus).toBe('UNKNOWN');
  });

  it('maintains live source success path for Nursys when credentials exist', () => {
    const raw = {
      events: [{
        state: 'TX',
        licenseNumber: 'TX-123',
        status: 'ACTIVE',
        issueDate: '2020-01-01',
        expirationDate: '2028-01-01',
      }]
    };
    
    const { claims, receipts } = parseNursysResult(
      '123', raw, 'artifact-mock', 'checksum-mock', new Date().toISOString()
    );

    expect(claims).toHaveLength(1);
    expect(claims[0]?.confidence).toBe('HIGH');
    expect(claims[0]?.reviewRequired).toBe(false);
    expect(claims[0]?.status).toBe('ACTIVE');
    
    const licValue = claims[0]?.value as any;
    expect(licValue.licenseStatus).toBe('ACTIVE');
    expect(licValue.state).toBe('TX');
  });

  it('provides parser drift quarantine path context by linking artifacts exactly', () => {
    const runTimestamp = '2026-03-24T12:00:00.000Z';
    const { claims } = parseNursysResult(
      '123', { events: [] }, 'artifact-111', 'checksum-999', runTimestamp
    );
    expect(claims[0]?.artifactId).toBe('artifact-111');
    expect(claims[0]?.artifactChecksum).toBe('checksum-999');
    expect(claims[0]?.parserVersion).toBe('v1.0.0');
    expect(claims[0]?.observedAt).toBe(runTimestamp);
  });

  it('ensures receipt replay integrity for exported packet claims', () => {
    const raw = { events: [{ state: 'TX', status: 'ACTIVE' }] };
    const { receipts } = parseNursysResult(
      '123', raw, 'artifact-456', 'checksum-888', new Date().toISOString()
    );
    
    expect(receipts).toHaveLength(1);
    expect(receipts[0]?.source_artifact_id).toBe('artifact-456');
    expect(receipts[0]?.raw_artifact_ref).toBe('artifact-456');
    expect(receipts[0]?.checksum).toBe('checksum-888');
  });
});
