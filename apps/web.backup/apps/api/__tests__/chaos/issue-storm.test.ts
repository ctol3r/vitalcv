import { describe, it, expect } from '@jest/globals';
import { buildCredential, buildDidcommMessage } from '../../src/routes/issuer/issue/didcomm';

describe('Chaos: issuance storm', () => {
  it('generates 200 DIDComm issue messages without collisions', async () => {
    const batch = await Promise.all(
      Array.from({ length: 200 }).map(async (_value, index) => {
        const input = {
          connectionId: `conn-${index}`,
          credentialSubject: {
            id: `did:example:holder-${index}`,
            firstName: 'Test',
            lastName: `Clinician-${index}`,
          },
          schemaId: 'MedicalLicense',
          metadata: { scenario: 'chaos' },
        } as Parameters<typeof buildCredential>[0];

        const credential = buildCredential(input);
        const message = buildDidcommMessage(input.connectionId, credential, input.metadata);
        return { credential, message };
      }),
    );

    const credentialIds = new Set(batch.map((entry) => entry.credential.id));
    const threadIds = new Set(batch.map((entry) => entry.message.id));

    expect(credentialIds.size).toBe(200);
    expect(threadIds.size).toBe(200);
    batch.forEach((entry) => {
      expect(entry.message.attachments?.[0]?.data?.json?.id).toBe(entry.credential.id);
      expect(entry.message.to?.[0]).toMatch(/^conn-/);
    });
  });
});











