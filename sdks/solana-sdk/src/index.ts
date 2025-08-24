export interface ValidationRequest {
  credential: string;
  signature: string;
}

async function callValidationApi(apiUrl: string, payload: ValidationRequest): Promise<any> {
  const response = await fetch(`${apiUrl}/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Validation API responded with ${response.status}`);
  }
  return response.json();
}

export async function validateSolanaCredential(apiUrl: string, payload: ValidationRequest): Promise<any> {
  return callValidationApi(apiUrl, { ...payload, blockchain: 'solana' });
}
