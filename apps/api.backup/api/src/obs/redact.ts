// PII patterns: SSN, US ZIP, phone-ish patterns
const PII = /\b\d{3}-?\d{2}-?\d{4}\b|\b\d{5}(?:-\d{4})?\b|\b\d{10}\b/g;

export function redact(s: string): string {
  return s.replace(PII, '[REDACTED]');
}

export function safeLog(obj: any): void {
  try {
    const j = JSON.stringify(obj);
    console.log(redact(j));
  } catch {
    console.log('[unserializable]');
  }
}

