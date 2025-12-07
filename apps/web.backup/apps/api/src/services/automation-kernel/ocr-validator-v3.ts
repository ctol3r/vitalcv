export interface OCRValidationResult {
  documentId: string;
  isValid: boolean;
  tamperingDetected: boolean;
  inconsistencies: string[];
  confidence: number;
  metadata: Record<string, unknown>;
}

/**
 * OCR evidence validator v3 - detects tampering and inconsistencies
 */
export function validateOCREvidenceV3(
  documentId: string,
  ocrResults: Record<string, unknown>,
  originalDocument?: Buffer,
): OCRValidationResult {
  const inconsistencies: string[] = [];
  let tamperingDetected = false;

  // Check for common tampering indicators
  if (ocrResults.metadata) {
    const metadata = ocrResults.metadata as Record<string, unknown>;

    // Check for suspicious metadata
    if (metadata.modifiedAt && metadata.createdAt) {
      const created = new Date(metadata.createdAt as string);
      const modified = new Date(metadata.modifiedAt as string);
      if (modified.getTime() - created.getTime() < 1000) {
        // Modified immediately after creation
        tamperingDetected = true;
        inconsistencies.push('Document modified immediately after creation');
      }
    }

    // Check for font inconsistencies
    if (metadata.fonts && Array.isArray(metadata.fonts)) {
      const fonts = metadata.fonts as string[];
      if (fonts.length > 3) {
        inconsistencies.push('Multiple fonts detected - possible tampering');
      }
    }
  }

  // Check for data inconsistencies
  if (ocrResults.licenseNumber && ocrResults.state) {
    const licenseNum = String(ocrResults.licenseNumber);
    const state = String(ocrResults.state);

    // Validate license number format for state
    if (!isValidLicenseFormat(licenseNum, state)) {
      inconsistencies.push(`License number format invalid for state ${state}`);
    }
  }

  // Check expiration date logic
  if (ocrResults.expirationDate && ocrResults.issueDate) {
    const expiration = new Date(ocrResults.expirationDate as string);
    const issue = new Date(ocrResults.issueDate as string);

    if (expiration <= issue) {
      inconsistencies.push('Expiration date must be after issue date');
    }
  }

  const confidence = calculateConfidence(tamperingDetected, inconsistencies.length);

  return {
    documentId,
    isValid: !tamperingDetected && inconsistencies.length === 0,
    tamperingDetected,
    inconsistencies,
    confidence,
    metadata: {
      validatedAt: new Date().toISOString(),
      inconsistencyCount: inconsistencies.length,
    },
  };
}

function isValidLicenseFormat(licenseNumber: string, state: string): boolean {
  // Mock validation - would have state-specific rules
  return licenseNumber.length >= 6 && licenseNumber.length <= 12;
}

function calculateConfidence(tamperingDetected: boolean, inconsistencyCount: number): number {
  let confidence = 1.0;

  if (tamperingDetected) {
    confidence -= 0.5;
  }

  confidence -= inconsistencyCount * 0.1;

  return Math.max(0, confidence);
}

