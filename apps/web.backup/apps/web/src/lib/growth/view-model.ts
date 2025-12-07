/**
 * Career Growth Engine - ViewModel
 * Task 1: GrowthEngineViewModel - ObservableObject @MainActor equivalent
 *
 * In React/Next.js, we use a custom hook pattern instead of SwiftUI's ObservableObject
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  GrowthProfile,
  CareerStage,
  SkillMap,
  RoleTrajectory,
  CMERelevance,
  RenewalPrediction,
  IdentityHealthScore,
  ExperienceGap,
  TrustScoreEvolution,
  Recommendation,
  ComplianceReminder,
} from './models';
import {
  CareerStageDetector,
  SkillMapSynthesizer,
  RoleTrajectoryEngine,
  CMERelevanceCalculator,
  RenewalPredictor,
  IdentityHealthCalculator,
} from './intelligence';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';

export interface GrowthEngineState {
  profile: GrowthProfile | null;
  careerStage: CareerStage | null;
  skillMap: SkillMap | null;
  roleTrajectory: RoleTrajectory | null;
  cmeRelevance: CMERelevance[];
  renewalPredictions: RenewalPrediction[];
  identityHealth: IdentityHealthScore | null;
  experienceGaps: ExperienceGap[];
  trustHistory: TrustScoreEvolution[];
  recommendations: Recommendation[];
  reminders: ComplianceReminder[];
  loading: boolean;
  error: string | null;
  lastUpdated: string | null;
}

export function useGrowthEngine(clinicianId: string | null) {
  const [state, setState] = useState<GrowthEngineState>({
    profile: null,
    careerStage: null,
    skillMap: null,
    roleTrajectory: null,
    cmeRelevance: [],
    renewalPredictions: [],
    identityHealth: null,
    experienceGaps: [],
    trustHistory: [],
    recommendations: [],
    reminders: [],
    loading: false,
    error: null,
    lastUpdated: null,
  });

  // Load profile and compute all intelligence
  const load = useCallback(async () => {
    if (!clinicianId) return;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      // Fetch base profile
      const profileRes = await fetch(`${API_BASE}/api/growth/profile/${clinicianId}`);
      if (!profileRes.ok) throw new Error('Failed to fetch profile');

      const profile: GrowthProfile = await profileRes.json();

      // Fetch trust history
      const trustRes = await fetch(`${API_BASE}/api/growth/trust-history/${clinicianId}`);
      const trustHistory: TrustScoreEvolution[] = trustRes.ok
        ? await trustRes.json()
        : [];

      // Fetch chain info
      const chainRes = await fetch(`${API_BASE}/api/growth/chain-info/${clinicianId}`);
      const chainInfo = chainRes.ok ? await chainRes.json() : { lastUpdate: new Date().toISOString(), anchorAge: 0 };

      // Compute all intelligence
      const careerStage = CareerStageDetector.detect(profile);
      const skillMap = SkillMapSynthesizer.synthesize(profile);
      const roleTrajectory = RoleTrajectoryEngine.predict(profile);

      // CME calculation (would need actual CME data)
      const cmeRelevance = CMERelevanceCalculator.calculate(
        profile,
        0, // earned credits - would come from API
        new Date().toISOString(),
        new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      );

      const renewalPredictions = RenewalPredictor.predict(profile.credentials);
      const identityHealth = IdentityHealthCalculator.calculate(
        profile,
        chainInfo.lastUpdate,
        chainInfo.anchorAge,
        trustHistory,
      );

      // Generate experience gaps
      const experienceGaps = generateExperienceGaps(profile, skillMap, renewalPredictions);

      // Generate recommendations
      const recommendations = generateRecommendations(
        profile,
        careerStage,
        skillMap,
        cmeRelevance,
        renewalPredictions,
        identityHealth,
      );

      // Generate reminders
      const reminders = generateReminders(renewalPredictions, profile.credentials);

      setState({
        profile,
        careerStage,
        skillMap,
        roleTrajectory,
        cmeRelevance,
        renewalPredictions,
        identityHealth,
        experienceGaps,
        trustHistory,
        recommendations,
        reminders,
        loading: false,
        error: null,
        lastUpdated: new Date().toISOString(),
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load growth data',
      }));
    }
  }, [clinicianId]);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(() => {
    void load();
  }, [load]);

  // Computed properties
  const nextPossibleRoles = useMemo(
    () => state.roleTrajectory?.nextPossibleRoles || [],
    [state.roleTrajectory],
  );

  const criticalReminders = useMemo(
    () => state.reminders.filter((r) => r.urgency === 'critical' || r.urgency === 'high'),
    [state.reminders],
  );

  const highPriorityRecommendations = useMemo(
    () => state.recommendations.filter((r) => r.priority === 'high'),
    [state.recommendations],
  );

  return {
    ...state,
    nextPossibleRoles,
    criticalReminders,
    highPriorityRecommendations,
    refresh,
  };
}

// Helper functions

function generateExperienceGaps(
  profile: GrowthProfile,
  skillMap: SkillMap,
  renewals: RenewalPrediction[],
): ExperienceGap[] {
  const gaps: ExperienceGap[] = [];

  // Add skill gaps
  for (const gap of skillMap.gaps) {
    if (gap.priority === 'high') {
      gaps.push({
        id: gap.skillId,
        type: 'training',
        name: gap.skillName,
        description: gap.gapReason,
        priority: gap.priority,
        impact: `Missing required skill for ${profile.specialties[0] || 'practice'}`,
        actionRequired: `Complete ${gap.skillName} training`,
      });
    }
  }

  // Add renewal gaps
  for (const renewal of renewals) {
    if (renewal.urgency === 'critical' || renewal.urgency === 'high') {
      gaps.push({
        id: `renewal-${renewal.credentialId}`,
        type: 'credential',
        name: renewal.credentialName,
        description: `${renewal.type} renewal required`,
        priority: renewal.urgency === 'critical' ? 'high' : 'medium',
        impact: `Credential expires in ${renewal.daysUntilExpiration} days`,
        actionRequired: `Renew ${renewal.credentialName}`,
        deadline: renewal.expiresAt,
      });
    }
  }

  return gaps;
}

function generateRecommendations(
  profile: GrowthProfile,
  stage: CareerStage,
  skillMap: SkillMap,
  cme: CMERelevance[],
  renewals: RenewalPrediction[],
  health: IdentityHealthScore,
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  // CME recommendations
  for (const cmeItem of cme) {
    if (cmeItem.earnedCredits < cmeItem.requiredCredits) {
      const needed = cmeItem.requiredCredits - cmeItem.earnedCredits;
      recommendations.push({
        id: `cme-${cmeItem.specialty}`,
        type: 'cme',
        title: `Complete ${needed} CME credits for ${cmeItem.specialty}`,
        description: `You need ${needed} more credits to meet ${cmeItem.specialty} requirements`,
        priority: needed > 20 ? 'high' : 'medium',
        impact: 'Maintains board certification eligibility',
        actionUrl: '/growth/cme',
        estimatedTime: `${needed * 2} hours`,
        confidence: 0.9,
      });
    }
  }

  // Credential renewal recommendations
  for (const renewal of renewals) {
    if (renewal.urgency === 'critical' || renewal.urgency === 'high') {
      recommendations.push({
        id: `renewal-${renewal.credentialId}`,
        type: 'credential',
        title: `Renew ${renewal.credentialName}`,
        description: `Expires in ${renewal.daysUntilExpiration} days`,
        priority: renewal.urgency === 'critical' ? 'high' : 'medium',
        impact: 'Prevents credential expiration',
        actionUrl: `/credentials/${renewal.credentialId}/renew`,
        estimatedTime: `${renewal.estimatedProcessingDays} days processing`,
        confidence: 1.0,
      });
    }
  }

  // Skill building recommendations
  for (const gap of skillMap.gaps.slice(0, 3)) {
    recommendations.push({
      id: `skill-${gap.skillId}`,
      type: 'skill',
      title: `Build ${gap.skillName} skills`,
      description: gap.gapReason,
      priority: gap.priority,
      impact: 'Increases match score and career opportunities',
      actionUrl: '/growth/skills',
      confidence: 0.8,
    });
  }

  // Trust score recommendations
  if (health.trustScore < 0.7) {
    recommendations.push({
      id: 'trust-boost',
      type: 'trust',
      title: 'Improve Trust Score',
      description: 'Update credentials and refresh chain anchor',
      priority: 'medium',
      impact: 'Increases recruiter confidence and match scores',
      actionUrl: '/growth/trust',
      confidence: 0.7,
    });
  }

  return recommendations.sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    return priorityOrder[b.priority] - priorityOrder[a.priority];
  });
}

function generateReminders(
  renewals: RenewalPrediction[],
  credentials: GrowthProfile['credentials'],
): ComplianceReminder[] {
  const reminders: ComplianceReminder[] = [];

  for (const renewal of renewals) {
    if (renewal.daysUntilExpiration <= 90) {
      reminders.push({
        id: `reminder-${renewal.credentialId}`,
        type: renewal.type === 'dea' ? 'dea_renewal' : 'license_renewal',
        title: `Renew ${renewal.credentialName}`,
        description: `Expires on ${new Date(renewal.expiresAt).toLocaleDateString()}`,
        dueDate: renewal.expiresAt,
        daysRemaining: renewal.daysUntilExpiration,
        urgency: renewal.urgency,
        actionUrl: `/credentials/${renewal.credentialId}/renew`,
        credentialId: renewal.credentialId,
      });
    }
  }

  // Add chain staleness reminders
  const staleCredentials = credentials.filter((c) => c.chainStaleness > 90);
  for (const cred of staleCredentials) {
    reminders.push({
      id: `chain-${cred.id}`,
      type: 'chain_update',
      title: `Update chain for ${cred.name}`,
      description: `Chain is ${cred.chainStaleness} days old`,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      daysRemaining: 30,
      urgency: 'medium',
      actionUrl: `/credentials/${cred.id}/update`,
      credentialId: cred.id,
    });
  }

  return reminders.sort((a, b) => a.daysRemaining - b.daysRemaining);
}

