
export interface HL7ParseResult {
  status: 'received' | 'parsed' | 'errored';
  parsedData?: any;
  error?: string;
}

export function parseHL7(raw: string): HL7ParseResult {
  try {
    // Simple check for FHIR Bundle (JSON)
    if (raw.trim().startsWith('{')) {
      try {
        const json = JSON.parse(raw);
        if (json.resourceType === 'Bundle') {
          return {
            status: 'parsed',
            parsedData: json
          };
        }
      } catch {
        // Not valid JSON, proceed to HL7 check
      }
    }

    // HL7 v2 check
    if (!raw.startsWith('MSH')) {
      return {
        status: 'errored',
        error: 'Invalid message format: Expected MSH segment or JSON Bundle'
      };
    }

    const segments = raw.split(/\r\n|\r|\n/);
    const mshSegment = segments[0];
    const fields = mshSegment.split('|');

    // MSH-9 is Message Type (index 8 because MSH counts as field 1, but split doesn't include it?
    // Actually standard split: MSH|^~&|...
    // Index 0: MSH
    // Index 1: Encoding Characters
    // ...
    // Standard HL7:
    // Field Separator (1)
    // Encoding Characters (2)
    // ...
    // Message Type (9)
    // In split array:
    // "MSH" is not usually in the split if splitting by |, unless the string includes MSH|...
    // Usually raw string is "MSH|^~\\&|..."
    // split('|') -> ["MSH", "^~\\&", ...]
    // So MSH-9 is at index 8.

    const messageTypeField = fields[8];
    if (!messageTypeField) {
      return { status: 'errored', error: 'Missing MSH-9 (Message Type)' };
    }

    const [type, trigger] = messageTypeField.split('^');

    const supported = (
      (type === 'ADT' && trigger === 'A04') ||
      (type === 'MDM' && trigger === 'T02')
    );

    if (!supported) {
      return {
        status: 'errored',
        error: `Unsupported message type: ${type}^${trigger}`
      };
    }

    // Stub parsing logic - return basic structure
    return {
      status: 'parsed',
      parsedData: {
        format: 'HL7v2',
        type,
        trigger,
        timestamp: new Date().toISOString(),
        segmentCount: segments.length,
        // Add more parsed fields here as needed
      }
    };

  } catch (err) {
    return {
      status: 'errored',
      error: err instanceof Error ? err.message : 'Unknown parsing error'
    };
  }
}














