import { describe, it, expect } from '@jest/globals';
import { POST } from '../../../app/api/issuer/extract/route';

describe('Chaos: OCR failure injection', () => {
  it('routes garbage previews to HITL workflow', async () => {
    const request = new Request('http://localhost/api/issuer/extract', {
      method: 'POST',
      body: JSON.stringify({
        fileUrl: 'https://example.com/garbage.pdf',
        credentialType: 'MedicalLicense',
        preview: '??? ### ---',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(202);
    expect(body.manualReview).toBe(true);
    expect(body.route).toBe('hitl');
  });

  it('continues automatic processing for healthy previews', async () => {
    const request = new Request('http://localhost/api/issuer/extract', {
      method: 'POST',
      body: JSON.stringify({
        fileUrl: 'https://example.com/license.pdf',
        credentialType: 'MedicalLicense',
        preview: 'California Board of Medicine License #12345 issued 2024',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.confidence).toBeGreaterThan(0.5);
  });
});











