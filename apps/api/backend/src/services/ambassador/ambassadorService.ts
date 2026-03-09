/**
 * Wave 192 — Ambassador Program
 *
 * Tracks: campus/early-career, semi-retired specialist, locums connector, recruiter/staffing ally.
 * Rewards: capped credits, badge tiers, invite codes, streaks, content unlocks.
 */

import { randomUUID } from 'crypto';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AmbassadorTrack =
  | 'campus_early_career'
  | 'semi_retired_specialist'
  | 'locums_connector'
  | 'recruiter_staffing_ally';

export type AmbassadorBadge = 'STARTER' | 'CONNECTOR' | 'ADVOCATE' | 'CHAMPION' | 'LEGEND';

export interface AmbassadorProfile {
  profileId: string;
  npi: string;
  track: AmbassadorTrack;
  badge: AmbassadorBadge;
  joinedAt: string;
  placements: number;      // confirmed work-completed referrals
  streakDays: number;
  inviteCodes: string[];
  unlockedContent: string[];
  creditsBalance: number;
  monthlyCapCredits: number;
  active: boolean;
}

// ── Track metadata ────────────────────────────────────────────────────────────

export const TRACK_META: Record<AmbassadorTrack, {
  label: string;
  description: string;
  targetAudience: string;
  unlocks: string[];
}> = {
  campus_early_career: {
    label: 'Campus & Early-Career Advocate',
    description: 'Medical students, residents, and new grads spreading the word at training programs.',
    targetAudience: 'Medical students, residents, new grads',
    unlocks: ['Residency credentialing guide', 'Early-career opportunity filter', 'Mentor matching'],
  },
  semi_retired_specialist: {
    label: 'Semi-Retired Specialist Ambassador',
    description: 'Experienced specialists sharing locums and telehealth opportunities with peers.',
    targetAudience: 'Physicians 55+, winding-down practitioners',
    unlocks: ['Flexible locums guide', 'Telehealth setup playbook', 'Tax strategy content'],
  },
  locums_connector: {
    label: 'Locums Connector',
    description: 'Active locums clinicians referring colleagues into the NLA + employer network.',
    targetAudience: 'Active locums MDs and APPs',
    unlocks: ['Locums credentialing speed guide', 'Multi-state license tracker', 'Agency comparison tool'],
  },
  recruiter_staffing_ally: {
    label: 'Recruiter & Staffing Ally',
    description: 'Staffing professionals and recruiters who refer credentialed candidates.',
    targetAudience: 'Independent recruiters, staffing agencies',
    unlocks: ['Employer integration guide', 'ATS webhook docs', 'Prequalified candidate reports'],
  },
};

// ── Badge thresholds ──────────────────────────────────────────────────────────

const BADGE_THRESHOLDS: Array<{ badge: AmbassadorBadge; minPlacements: number }> = [
  { badge: 'STARTER',   minPlacements: 0 },
  { badge: 'CONNECTOR', minPlacements: 1 },
  { badge: 'ADVOCATE',  minPlacements: 3 },
  { badge: 'CHAMPION',  minPlacements: 10 },
  { badge: 'LEGEND',    minPlacements: 25 },
];

// ── In-memory store ───────────────────────────────────────────────────────────

const profileStore = new Map<string, AmbassadorProfile>();

// ── Service ───────────────────────────────────────────────────────────────────

export function enrollAmbassador(npi: string, track: AmbassadorTrack): AmbassadorProfile {
  if (profileStore.has(npi)) return profileStore.get(npi)!;

  const profile: AmbassadorProfile = {
    profileId: randomUUID(),
    npi,
    track,
    badge: 'STARTER',
    joinedAt: new Date().toISOString(),
    placements: 0,
    streakDays: 0,
    inviteCodes: [generateInviteCode(npi)],
    unlockedContent: [],
    creditsBalance: 0,
    monthlyCapCredits: 500,
    active: true,
  };

  profileStore.set(npi, profile);
  console.log(JSON.stringify({ event: 'ambassador.enrolled', npi, track }));
  return profile;
}

export function recordPlacement(npi: string): AmbassadorProfile | null {
  const profile = profileStore.get(npi);
  if (!profile) return null;

  profile.placements++;
  profile.creditsBalance = Math.min(
    profile.creditsBalance + 50,
    profile.monthlyCapCredits,
  );

  // Recompute badge
  profile.badge = computeBadge(profile.placements);

  // Unlock content at milestones
  const trackMeta = TRACK_META[profile.track];
  const unlockIdx = Math.min(profile.placements - 1, trackMeta.unlocks.length - 1);
  if (unlockIdx >= 0 && !profile.unlockedContent.includes(trackMeta.unlocks[unlockIdx])) {
    profile.unlockedContent.push(trackMeta.unlocks[unlockIdx]);
  }

  // Issue new invite code at every 5 placements
  if (profile.placements % 5 === 0) {
    profile.inviteCodes.push(generateInviteCode(npi));
  }

  profileStore.set(npi, profile);
  console.log(JSON.stringify({ event: 'ambassador.placement_recorded', npi, placements: profile.placements, badge: profile.badge }));
  return profile;
}

export function getAmbassadorProfile(npi: string): AmbassadorProfile | null {
  return profileStore.get(npi) ?? null;
}

export function listAmbassadors(track?: AmbassadorTrack): AmbassadorProfile[] {
  const all = [...profileStore.values()].filter(p => p.active);
  return track ? all.filter(p => p.track === track) : all;
}

export function getAmbassadorAnalytics(): {
  totalAmbassadors: number;
  byTrack: Record<AmbassadorTrack, number>;
  byBadge: Record<AmbassadorBadge, number>;
  totalPlacements: number;
  totalCreditsIssued: number;
} {
  const all = [...profileStore.values()];
  const byTrack = {} as Record<AmbassadorTrack, number>;
  const byBadge = {} as Record<AmbassadorBadge, number>;

  for (const p of all) {
    byTrack[p.track] = (byTrack[p.track] ?? 0) + 1;
    byBadge[p.badge] = (byBadge[p.badge] ?? 0) + 1;
  }

  return {
    totalAmbassadors: all.length,
    byTrack,
    byBadge,
    totalPlacements: all.reduce((s, p) => s + p.placements, 0),
    totalCreditsIssued: all.reduce((s, p) => s + p.creditsBalance, 0),
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeBadge(placements: number): AmbassadorBadge {
  let badge: AmbassadorBadge = 'STARTER';
  for (const t of BADGE_THRESHOLDS) {
    if (placements >= t.minPlacements) badge = t.badge;
  }
  return badge;
}

function generateInviteCode(npi: string): string {
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `AMB-${npi.slice(-4)}-${rand}`;
}
