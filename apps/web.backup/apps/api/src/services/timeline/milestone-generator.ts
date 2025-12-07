import type { NormalizedTimelineEvent } from './normalization';

export interface PredictedMilestone {
  type: 'renewal' | 'expiration' | 'requirement' | 'opportunity';
  title: string;
  predictedDate: string;
  confidence: number;
  description: string;
  actions?: string[];
}

/**
 * Predict upcoming career milestones
 */
export function predictUpcomingMilestones(
  events: NormalizedTimelineEvent[],
): PredictedMilestone[] {
  const milestones: PredictedMilestone[] = [];

  // Find expiring certifications
  const certifications = events.filter((e) => e.normalizedType === 'certification');
  const now = new Date();

  for (const cert of certifications) {
    if (cert.normalizedDates.end) {
      const expirationDate = new Date(cert.normalizedDates.end);
      const daysUntilExpiration = Math.ceil((expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntilExpiration > 0 && daysUntilExpiration < 365) {
        milestones.push({
          type: 'expiration',
          title: `${cert.normalizedTitle} Expiration`,
          predictedDate: expirationDate.toISOString(),
          confidence: 0.9,
          description: `Certification expires in ${Math.round(daysUntilExpiration / 30)} months`,
          actions: ['Renew certification', 'Complete required CME', 'Submit renewal application'],
        });
      }
    }
  }

  // Predict license renewals (typically every 2 years)
  const licenses = events.filter((e) => e.normalizedType === 'license' || e.type === 'privilege');
  for (const license of licenses) {
    const startDate = new Date(license.normalizedDates.start);
    const renewalDate = new Date(startDate);
    renewalDate.setFullYear(renewalDate.getFullYear() + 2);

    if (renewalDate > now) {
      const daysUntilRenewal = Math.ceil((renewalDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntilRenewal < 180) {
        milestones.push({
          type: 'renewal',
          title: 'License Renewal',
          predictedDate: renewalDate.toISOString(),
          confidence: 0.8,
          description: `License renewal due in ${Math.round(daysUntilRenewal / 30)} months`,
          actions: ['Complete renewal application', 'Pay renewal fee', 'Update contact information'],
        });
      }
    }
  }

  // Predict CME requirements (typically 50 hours per 2 years)
  const cmeEvents = events.filter((e) => e.normalizedType === 'education' || e.type === 'cme');
  const recentCME = cmeEvents.filter((e) => {
    const eventDate = new Date(e.normalizedDates.start);
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    return eventDate > twoYearsAgo;
  });

  if (recentCME.length < 5) {
    // Estimate next CME deadline
    const nextDeadline = new Date();
    nextDeadline.setFullYear(nextDeadline.getFullYear() + 1);

    milestones.push({
      type: 'requirement',
      title: 'CME Requirements',
      predictedDate: nextDeadline.toISOString(),
      confidence: 0.7,
      description: `May need additional CME hours (currently ${recentCME.length} activities in last 2 years)`,
      actions: ['Complete CME courses', 'Track CME hours', 'Submit CME documentation'],
    });
  }

  return milestones.sort(
    (a, b) => new Date(a.predictedDate).getTime() - new Date(b.predictedDate).getTime(),
  );
}

