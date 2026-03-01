import { CommandName } from '@vitalcv/command-registry';

// Mock LLM/Agent parse result for demo purposes. In production, this would call an LLM (e.g. Gemini, OpenAI)
// and instruct it to map user intent into one of the known CommandSchemas.
export async function parseCommandIntent(rawInput: string): Promise<{ commandName: CommandName; payload: any } | null> {
  const normalized = rawInput.toLowerCase();

  if (normalized.includes('verify') && normalized.includes('npi')) {
    // Attempting to extract an NPI naively
    const match = rawInput.match(/\b\d{10}\b/);
    return {
      commandName: 'VerifyNpiCommand',
      payload: {
        npi: match ? match[0] : '', // Might be empty to trigger the zod-to-form fallback
      }
    };
  }

  if (normalized.includes('issue credential') || normalized.includes('new credential')) {
    const npiMatch = rawInput.match(/\b\d{10}\b/);
    return {
      commandName: 'IssueCredentialCommand',
      payload: {
        npi: npiMatch ? npiMatch[0] : '',
        type: '',
        issuer: '',
      }
    };
  }

  if (normalized.includes('revoke trust') || (normalized.includes('revoke') && normalized.includes('npi'))) {
    const npiMatch = rawInput.match(/\b\d{10}\b/);
    return {
      commandName: 'RevokeTrustCommand',
      payload: {
        npi: npiMatch ? npiMatch[0] : '',
        reason: '',
      }
    };
  }

  if (normalized.includes('export ncqa') || normalized.includes('capsule')) {
    const npiMatch = rawInput.match(/\b\d{10}\b/);
    return {
      commandName: 'ExportNcqaCapsuleCommand',
      payload: {
        npi: npiMatch ? npiMatch[0] : '',
      }
    };
  }

  return null;
}
