/**
 * Pilot-deployment-kit data shape and Cedar Health default cohort.
 *
 * The document is print-ready and per-cohort: the cover page,
 * signature block, and appendix contacts all derive from this shape.
 * Adding a new pilot cohort means adding a new entry keyed by slug
 * — no template surgery, no copy edits inside JSX.
 */

export interface DeploymentKitClient {
  slug: string;
  docNumber: string;
  revision: string;
  effectiveDate: string;
  clientName: string;
  clientAttention: string;
  scopeNpis: number;
  scopeWindowDays: number;
  cohortLabel: string;
  preparedForCity?: string;
  contacts: {
    pilotOwner: string;
    credentialingLead: string;
    auditLead: string;
    securityReview: string;
    legalContact: string;
    escalation: string;
  };
  signatureAttention: string;
  signatureRole: string;
  signaturePath: string;
  cohortSampleNpi: { name: string; npi: string };
}

export const DEPLOYMENT_KIT_CLIENTS: Record<string, DeploymentKitClient> = {
  'cedar-q2-26': {
    slug: 'cedar-q2-26',
    docNumber: 'VC-PDK-CEDAR-Q2-26',
    revision: 'Revision 1.0 · 11 May 2026',
    effectiveDate: '11 May 2026',
    clientName: 'Cedar Health Credentialing',
    clientAttention: 'Attn: K. Aldana, VP Workforce Operations',
    scopeNpis: 10,
    scopeWindowDays: 30,
    cohortLabel: 'Q2-2026',
    contacts: {
      pilotOwner: 'K. Aldana, VP',
      credentialingLead: 'M. Tran-Nguyen',
      auditLead: 'P. Okafor',
      securityReview: 'J. Lindgren, CISO',
      legalContact: 'S. Berenstein',
      escalation: '+1 (415) 555-0142 · 24/7',
    },
    signatureAttention: 'K. Aldana, VP Workforce Operations',
    signatureRole: 'Cedar Health',
    signaturePath: 'cedarhealth.org · / credentialing',
    cohortSampleNpi: { name: 'Macie Miller, PA-C', npi: '1346053246' },
  },
};

export function resolveDeploymentKitClient(
  slug: string,
): DeploymentKitClient | null {
  return DEPLOYMENT_KIT_CLIENTS[slug] ?? null;
}
