/**
 * OID4VP Usage Examples
 * These examples show how to use the OID4VP endpoints
 */

// Example 1: Generate a presentation request
async function exampleGenerateRequest() {
  const response = await fetch('http://localhost:4000/api/oid4vp/request', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      workflow: 'full_onboarding',
      orgId: 'org-123',
    }),
  });

  const data = await response.json();
  console.log('Session ID:', data.sessionId);
  console.log('Nonce:', data.nonce);
  console.log('QR Payload:', data.qr_payload);

  return data;
}

// Example 2: Get request by session ID
async function exampleGetRequest(sessionId: string) {
  const response = await fetch(
    `http://localhost:4000/api/oid4vp/request/${sessionId}`
  );

  const data = await response.json();
  console.log('Status:', data.status);
  console.log('Expires:', data.expires_at);

  return data;
}

// Example 3: Verify a presentation
async function exampleVerifyPresentation(
  vpToken: string,
  nonce: string,
  state: string
) {
  const response = await fetch('http://localhost:4000/api/oid4vp/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      vp_token: vpToken,
      nonce: nonce,
      state: state,
    }),
  });

  const data = await response.json();

  if (data.verified) {
    console.log('✅ Verification successful!');
    console.log('Subject:', data.result.subjectInfo);
    console.log('Credentials:', data.result.credentialSummaries);
  } else {
    console.log('❌ Verification failed:', data.result);
  }

  return data;
}

// Example 4: Save a presentation definition
async function exampleSaveDefinition() {
  const response = await fetch(
    'http://localhost:4000/api/oid4vp/presentation-definition',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orgId: 'org-123',
        name: 'Hospitalist Onboarding',
        json: {
          id: 'pd-hospitalist-001',
          input_descriptors: [
            {
              id: 'license',
              name: 'Medical License',
              constraints: {
                fields: [
                  {
                    path: ['$.credentialSubject.licenseNumber'],
                  },
                ],
              },
            },
          ],
        },
      }),
    }
  );

  const data = await response.json();
  console.log('Definition ID:', data.id);

  return data;
}

// Example 5: Use saved definition in request
async function exampleUseSavedDefinition(definitionId: string) {
  const response = await fetch('http://localhost:4000/api/oid4vp/request', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      presentationDefinitionId: definitionId,
      orgId: 'org-123',
    }),
  });

  return await response.json();
}

// Example 6: Complete workflow
async function exampleCompleteWorkflow() {
  // Step 1: Generate request
  const request = await exampleGenerateRequest();

  // Step 2: Share QR code or URL with clinician
  console.log('Share this QR code:', request.qr_payload);

  // Step 3: Wait for clinician to present credentials
  // (In real scenario, poll for status or use webhooks)

  // Step 4: Verify (when VP token received)
  // const verification = await exampleVerifyPresentation(
  //   vpToken,
  //   request.nonce,
  //   request.state
  // );
}

export {
  exampleGenerateRequest,
  exampleGetRequest,
  exampleVerifyPresentation,
  exampleSaveDefinition,
  exampleUseSavedDefinition,
  exampleCompleteWorkflow,
};

