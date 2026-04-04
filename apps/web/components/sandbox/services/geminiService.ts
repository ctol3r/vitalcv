/**
 * Gemini service stub for VitalCV production.
 *
 * The sandbox used Google Gemini for synthesis. In production, we use the
 * backend trust-state engine as the source of truth and synthesize deterministic
 * summaries from it. No external API key required.
 */

export async function analyzeReadiness(data: any) {
  // Deterministic synthesis from the NPI data the sandbox already has
  const identityStatus = data?.identity?.status || 'unknown';
  const sanctionsStatus = data?.sanctions?.status || 'unknown';
  const licenseStatus = data?.licensure?.status || 'unknown';
  const enrolled = data?.pecos?.enrolled;
  const score = Number(data?.readinessScore ?? 0);

  const verified: string[] = [];
  if (identityStatus === 'active' || identityStatus === 'verified') {
    verified.push('NPPES identity is active and current');
  }
  if (sanctionsStatus === 'clear') {
    verified.push('OIG/LEIE sanctions check is clear');
  }
  if (licenseStatus === 'active' || licenseStatus === 'verified') {
    verified.push('State licensure verified via FSMB');
  }
  if (enrolled === true) {
    verified.push('Medicare enrollment confirmed in PECOS');
  }

  const gaps: string[] = [];
  if (identityStatus !== 'active' && identityStatus !== 'verified') {
    gaps.push('NPI identity status requires confirmation');
  }
  if (licenseStatus !== 'active' && licenseStatus !== 'verified') {
    gaps.push('State license verification stale — refresh required');
  }
  if (enrolled !== true) {
    gaps.push('Medicare enrollment pending or not found');
  }
  if (score < 70) {
    gaps.push('Board certification and DEA registration require manual review');
  }

  const timeToStart = score >= 80
    ? '7–14 days'
    : score >= 60
      ? '14–28 days'
      : '30–60 days';

  return {
    verifiedCredentials: verified.length > 0
      ? verified.join('. ') + '.'
      : 'Insufficient primary source data. Manual review required.',
    identifiedGaps: gaps.length > 0
      ? gaps.join('. ') + '.'
      : 'No gaps identified in primary sources.',
    estimatedTimeToStart: timeToStart,
  };
}

export async function generateCoverLetter(_resume: string, _jobDescription: string): Promise<string> {
  return 'Cover letter generation is not yet wired to production. Connect the Gemini API or the VitalCV backend to enable this feature.';
}
