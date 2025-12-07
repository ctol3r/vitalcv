/**
 * Clinician Marketplace Routes
 *
 * Clinicians discover facilities and facilities request/bid for talent
 */

import { Router, type Request, type Response } from 'express';
import {
  calculateMatchScore,
  type MarketplaceClinicianProfile,
  type MarketplaceFacilityProfile,
  anchorMarketplaceEventToChain,
} from '../../services/marketplace/engine';

const router = Router();

/**
 * GET /api/marketplace/clinician/browse
 * Clinicians browse facilities with match score breakdown
 */
router.get('/browse', async (req: Request, res: Response) => {
  try {
    const clinicianId = req.query.clinicianId as string;
    const specialty = req.query.specialty as string | undefined;
    const limit = parseInt(req.query.limit as string, 10) || 50;

    // Get clinician profile (in real implementation, fetch from DB)
    const clinicianProfile: MarketplaceClinicianProfile = {
      clinicianId: clinicianId || 'demo-clinician',
      trustScore: 0.85,
      specialty: specialty ? [specialty] : ['Internal Medicine'],
      skills: ['Internal Medicine', 'Primary Care'],
      privileges: {
        icu: false,
        or: false,
        telemedicine: true,
        emergency: false,
      },
      telemedicineEligibility: {
        eligible: true,
        states: ['CA', 'NY', 'TX'],
        compacts: ['IMLC'],
      },
      compactEligibility: {
        eligible: true,
        compacts: ['IMLC'],
        states: ['CA', 'NY', 'TX'],
      },
      readinessScore: 0.88,
      availability: {
        status: 'available',
      },
      trustTrajectory: {
        trend: 'improving',
        velocity: 0.05,
        lastUpdated: new Date().toISOString(),
      },
    };

    // In real implementation, fetch facilities from DB
    const facilities: MarketplaceFacilityProfile[] = [
      {
        facilityId: 'facility-1',
        facilityName: 'Metro General Hospital',
        rolesNeeded: [
          { role: 'Physician', specialty: 'Internal Medicine', priority: 'high', shiftNeeds: 5 },
        ],
        credentialRequirements: {
          minimumTrustScore: 0.8,
          requiredCredentials: ['MD'],
          preferredCredentials: ['Board Certified'],
        },
        privilegeRequirements: {
          icu: false,
          or: false,
          telemedicine: true,
          emergency: false,
        },
        riskTolerance: 'medium',
        qualityScore: 0.92,
        onboardingComplexity: 'moderate',
        privilegingTimeline: {
          typical: 30,
          fastTrack: 14,
        },
      },
    ];

    // Calculate match scores
    const facilitiesWithScores = facilities.map(facility => {
      const matchScore = calculateMatchScore(clinicianProfile, facility);
      return {
        ...facility,
        matchScore,
      };
    });

    // Sort by match score
    const ranked = facilitiesWithScores.sort((a, b) =>
      (b.matchScore?.overall ?? 0) - (a.matchScore?.overall ?? 0)
    );

    return res.json({
      clinician: clinicianProfile,
      total: ranked.length,
      results: ranked.slice(0, limit).map(f => ({
        facilityId: f.facilityId,
        facilityName: f.facilityName,
        matchScore: f.matchScore,
        qualityScore: f.qualityScore,
        privilegingTimeline: f.privilegingTimeline,
        onboardingComplexity: f.onboardingComplexity,
        rolesNeeded: f.rolesNeeded,
      })),
    });
  } catch (error) {
    console.error('[marketplace][clinician][browse] failed', error);
    return res.status(500).json({
      error: 'marketplace_browse_failed',
      message: error instanceof Error ? error.message : 'Unable to browse facilities',
    });
  }
});

/**
 * POST /api/marketplace/clinician/request-passport
 * Facility requests clinician's passport
 */
router.post('/request-passport', async (req: Request, res: Response) => {
  try {
    const { facilityId, clinicianId } = req.body;

    if (!facilityId || !clinicianId) {
      return res.status(400).json({
        error: 'missing_parameters',
        message: 'facilityId and clinicianId are required',
      });
    }

    // Anchor event to chain
    const txHash = anchorMarketplaceEventToChain('FacilityRequestedClinician', {
      facilityId,
      clinicianId,
      actor: facilityId,
      timestamp: new Date().toISOString(),
    });

    // In real implementation, create request record and notify clinician
    // await prisma.passportRequest.create({
    //   data: { facilityId, clinicianId, status: 'pending', txHash },
    // });

    return res.json({
      success: true,
      facilityId,
      clinicianId,
      txHash,
      message: 'Passport request submitted',
    });
  } catch (error) {
    console.error('[marketplace][clinician][request-passport] failed', error);
    return res.status(500).json({
      error: 'passport_request_failed',
      message: error instanceof Error ? error.message : 'Unable to request passport',
    });
  }
});

export default router;

