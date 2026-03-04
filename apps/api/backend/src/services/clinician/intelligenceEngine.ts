/**
 * intelligenceEngine.ts — Wave 65: Clinician Intelligence Engine
 *
 * Provides proactive guidance: next credential actions, upcoming expirations,
 * missing credentials, recommended interstate licenses.
 */

import { getSpecialtyRequirements } from '../../data/specialtyRequirements';
import { getEligibleStates } from '../licensure/stateLicensure';
import { checkExpirations, type ExpirationAlert } from '../licensure/licenseMonitor';

// ── Types ─────────────────────────────────────────────────────────────────

export interface ClinicianProfile {
  npi: string;
  specialty: string;
  providerType: string;
  stateLicenses: Array<{ state: string; expiresAt: string; licenseNumber: string }>;
  deaRegistration?: { expiresAt: string; registrationNumber: string };
  boardCertification?: { board: string; expiresAt: string | null };
  credentials: Array<{ id: string; source: string; status: string; expiresAt: string | null }>;
}

export interface GuidanceAction {
  priority: 'urgent' | 'high' | 'medium' | 'low';
  category: 'expiration' | 'missing' | 'interstate' | 'renewal' | 'compliance';
  title: string;
  description: string;
  deadline?: string;
  actionUrl?: string;
}

export interface IntelligenceReport {
  npi: string;
  generatedAt: string;
  nextActions: GuidanceAction[];
  expirationAlerts: ExpirationAlert[];
  missingCredentials: string[];
  recommendedLicenses: Array<{ state: string; reason: string }>;
  complianceScore: number;
}

// ── Engine ────────────────────────────────────────────────────────────────

export function generateIntelligenceReport(profile: ClinicianProfile): IntelligenceReport {
  const actions: GuidanceAction[] = [];
  const now = Date.now();

  // 1. Expiration alerts
  const expirationAlerts = checkExpirations(profile);
  for (const alert of expirationAlerts) {
    const priority = alert.daysUntilExpiry <= 30 ? 'urgent' : alert.daysUntilExpiry <= 60 ? 'high' : 'medium';
    actions.push({
      priority,
      category: 'expiration',
      title: `${alert.credentialName} expires in ${alert.daysUntilExpiry} days`,
      description: `Your ${alert.credentialName} in ${alert.state ?? 'N/A'} expires on ${new Date(alert.expiresAt).toLocaleDateString()}. Begin renewal process now.`,
      deadline: alert.expiresAt,
    });
  }

  // 2. Missing credentials for specialty
  const requirements = getSpecialtyRequirements(profile.specialty);
  const existingSources = new Set(profile.credentials.map((c) => c.source.toLowerCase()));
  const missingCredentials: string[] = [];

  for (const req of requirements) {
    const found = req.aliases.some((alias) =>
      [...existingSources].some((src) => src.includes(alias.toLowerCase())),
    );
    if (!found) {
      missingCredentials.push(req.name);
      actions.push({
        priority: req.required ? 'high' : 'low',
        category: 'missing',
        title: `Missing: ${req.name}`,
        description: `${req.name} is ${req.required ? 'required' : 'recommended'} for ${profile.specialty}. ${req.description}`,
      });
    }
  }

  // 3. Interstate license recommendations
  const currentStates = new Set(profile.stateLicenses.map((l) => l.state));
  const eligible = getEligibleStates(profile.stateLicenses.map((l) => l.state));
  const recommendedLicenses: Array<{ state: string; reason: string }> = [];

  for (const rec of eligible) {
    if (!currentStates.has(rec.state)) {
      recommendedLicenses.push(rec);
      actions.push({
        priority: 'low',
        category: 'interstate',
        title: `License eligible: ${rec.state}`,
        description: rec.reason,
      });
    }
  }

  // 4. Compliance score (0-100)
  let score = 100;
  score -= missingCredentials.length * 10;
  score -= expirationAlerts.filter((a) => a.daysUntilExpiry <= 30).length * 15;
  score -= expirationAlerts.filter((a) => a.daysUntilExpiry > 30 && a.daysUntilExpiry <= 60).length * 8;
  score -= expirationAlerts.filter((a) => a.daysUntilExpiry > 60).length * 3;
  const complianceScore = Math.max(0, Math.min(100, score));

  // Sort by priority
  const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
  actions.sort((a, b) => (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9));

  return {
    npi: profile.npi,
    generatedAt: new Date().toISOString(),
    nextActions: actions,
    expirationAlerts,
    missingCredentials,
    recommendedLicenses,
    complianceScore,
  };
}
