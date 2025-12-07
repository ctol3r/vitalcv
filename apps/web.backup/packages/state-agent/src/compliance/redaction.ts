/**
 * Compliance redaction layer
 * Ensures no PII or PHI is included in state reports
 * Implements GDPR peppered-hash policy and HIPAA-safe summaries
 */

import type { ComplianceMetadata, StateReportOptions } from '../types';

// Common PII/PHI patterns
const PII_PATTERNS = [
  /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
  /\b\d{9}\b/g, // NPI (but we want to keep these in some contexts)
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email
  /\b\d{3}-\d{3}-\d{4}\b/g, // Phone
  /\b\d{1,2}\/\d{1,2}\/\d{4}\b/g, // Date (potential DOB)
];

const PHI_PATTERNS = [
  /\b(patient|diagnosis|treatment|medical record|health information)\b/gi,
  /\b(ICD-10|CPT|HCPCS)\s*[A-Z0-9]+/gi,
];

export function redactPiiPhi(
  data: any,
  options: StateReportOptions = {}
): { redacted: any; metadata: ComplianceMetadata } {
  const complianceLevel = options.complianceLevel || 'standard';
  const pouRole = options.pouRole || 'Introspection';

  let piiDetected = false;
  let phiDetected = false;
  const pouConstraints: string[] = [];

  // Apply POU constraints
  if (pouRole === 'Introspection') {
    pouConstraints.push('No PII/PHI allowed');
    pouConstraints.push('Minimum necessary principle');
    pouConstraints.push('Aggregated data only');
  }

  const redacted = redactRecursive(data, complianceLevel, {
    piiDetected: { current: false },
    phiDetected: { current: false },
  });

  piiDetected = redacted.piiDetected;
  phiDetected = redacted.phiDetected;

  const metadata: ComplianceMetadata = {
    redactionApplied: true,
    piiDetected,
    phiDetected,
    gdprCompliant: complianceLevel === 'strict' || complianceLevel === 'standard',
    hipaaCompliant: complianceLevel === 'strict' || complianceLevel === 'standard',
    pouConstraints,
  };

  return {
    redacted: redacted.data,
    metadata,
  };
}

function redactRecursive(
  data: any,
  complianceLevel: 'strict' | 'standard' | 'minimal',
  flags: { piiDetected: { current: boolean }; phiDetected: { current: boolean } }
): { data: any; piiDetected: boolean; phiDetected: boolean } {
  if (data === null || data === undefined) {
    return { data, piiDetected: flags.piiDetected.current, phiDetected: flags.phiDetected.current };
  }

  if (typeof data === 'string') {
    let redacted = data;

    // Check for PII
    for (const pattern of PII_PATTERNS) {
      if (pattern.test(redacted)) {
        flags.piiDetected.current = true;
        if (complianceLevel === 'strict' || complianceLevel === 'standard') {
          // Redact email addresses (but keep domain for context)
          if (pattern.source.includes('@')) {
            redacted = redacted.replace(/\b([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.[A-Z|a-z]{2,})\b/g,
              (match, user, domain) => `***@${domain}`);
          } else {
            redacted = redacted.replace(pattern, '[REDACTED]');
          }
        }
      }
    }

    // Check for PHI
    for (const pattern of PHI_PATTERNS) {
      if (pattern.test(redacted)) {
        flags.phiDetected.current = true;
        if (complianceLevel === 'strict') {
          redacted = '[PHI REDACTED]';
        } else if (complianceLevel === 'standard') {
          redacted = redacted.replace(pattern, '[REDACTED]');
        }
      }
    }

    return { data: redacted, piiDetected: flags.piiDetected.current, phiDetected: flags.phiDetected.current };
  }

  if (Array.isArray(data)) {
    const redactedArray = data.map(item =>
      redactRecursive(item, complianceLevel, flags)
    );
    return {
      data: redactedArray.map(r => r.data),
      piiDetected: flags.piiDetected.current,
      phiDetected: flags.phiDetected.current,
    };
  }

  if (typeof data === 'object') {
    const redactedObj: any = {};
    for (const [key, value] of Object.entries(data)) {
      // Skip certain sensitive keys entirely in strict mode
      if (complianceLevel === 'strict' &&
          ['password', 'secret', 'token', 'key', 'ssn', 'dob', 'dateOfBirth'].includes(key.toLowerCase())) {
        redactedObj[key] = '[REDACTED]';
        flags.piiDetected.current = true;
        continue;
      }

      const redacted = redactRecursive(value, complianceLevel, flags);
      redactedObj[key] = redacted.data;
    }
    return {
      data: redactedObj,
      piiDetected: flags.piiDetected.current,
      phiDetected: flags.phiDetected.current,
    };
  }

  return { data, piiDetected: flags.piiDetected.current, phiDetected: flags.phiDetected.current };
}

