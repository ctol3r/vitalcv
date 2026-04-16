export interface UITextValidationContext {
  signatureExposed?: boolean;
  externallyVerifiable?: boolean;
}

export interface UITextValidationViolation {
  phrase: string;
  message: string;
  index: number;
  excerpt: string;
}

export interface UITextValidationResult {
  valid: boolean;
  violations: UITextValidationViolation[];
}

const CRYPTOGRAPHICALLY_VERIFIED_PATTERN = /\bcryptographic(?:ally)? verified\b/gi;

function excerpt(text: string, index: number): string {
  const start = Math.max(0, index - 24);
  const end = Math.min(text.length, index + 48);
  return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

export function validateUIText(
  text: string,
  context: UITextValidationContext = {},
): UITextValidationResult {
  const source = typeof text === 'string' ? text : '';
  const violations: UITextValidationViolation[] = [];
  const allowCryptographicClaim = context.signatureExposed === true
    && context.externallyVerifiable === true;

  if (!allowCryptographicClaim) {
    for (const match of source.matchAll(CRYPTOGRAPHICALLY_VERIFIED_PATTERN)) {
      if (typeof match.index !== 'number') {
        continue;
      }

      violations.push({
        phrase: match[0],
        message: 'Use "verified against [source]", "checked via [source]", or "source-confirmed" unless the signature is exposed and independently verifiable.',
        index: match.index,
        excerpt: excerpt(source, match.index),
      });
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

export function assertValidUIText(
  text: string,
  context: UITextValidationContext = {},
): void {
  const result = validateUIText(text, context);
  if (result.valid) {
    return;
  }

  const details = result.violations
    .map((violation) => `${violation.phrase} -> ${violation.message} [${violation.excerpt}]`)
    .join('\n');

  throw new Error(`UI claim guard failed:\n${details}`);
}
