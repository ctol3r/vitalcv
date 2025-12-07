/**
 * Facility Marketplace Routes
 *
 * Facilities browse pre-verified clinicians
 */

import { Router, type Request, type Response } from 'express';
import {
  calculateMatchScore,
  rankMarketplaceResults,
  type MarketplaceClinicianProfile,
  type MarketplaceFacilityProfile,
} from '../../services/marketplace/engine';
import { browseMarketplaceProfiles } from '../../services/marketplace/profile';

const router = Router();

interface ClinicianSearchResult extends MarketplaceClinicianProfile {
  matchScore?: ReturnType<typeof calculateMatchScore>;
}

/**
 * GET /api/marketplace/facility/browse
 * Browse clinicians with facility-specific matching
 */
router.get('/browse', async (req: Request, res: Response) => {
  try {
    const facilityId = req.query.facilityId as string;
    const specialty = req.query.specialty as string | undefined;
    const state = req.query.state as string | undefined;
    const minTrustScore = parseFloat(req.query.minTrustScore as string) || 0;
    const telemedicineEligible = req.query.telemedicine === 'true';
    const icuPrivileges = req.query.icu === 'true';
    const orPrivileges = req.query.or === 'true';
    const deaActive = req.query.dea === 'true';
    const compactReady = req.query.compact === 'true';
    const riskScore = req.query.riskScore as 'low' | 'medium' | 'high' | undefined;
    const limit = parseInt(req.query.limit as string, 10) || 50;

    // Get facility profile (in real implementation, fetch from DB)
    const facilityProfile: MarketplaceFacilityProfile = {
      facilityId: facilityId || 'demo-facility',
      facilityName: 'Demo Facility',
      rolesNeeded: [
        { role: 'Physician', specialty: specialty || 'Internal Medicine', priority: 'high', shiftNeeds: 5 },
      ],
      credentialRequirements: {
        minimumTrustScore: minTrustScore,
        requiredCredentials: [],
        preferredCredentials: [],
      },
      privilegeRequirements: {
        icu: icuPrivileges,
        or: orPrivileges,
        telemedicine: telemedicineEligible,
        emergency: false,
      },
      riskTolerance: riskScore || 'medium',
      qualityScore: 0.85,
      onboardingComplexity: 'moderate',
      privilegingTimeline: {
        typical: 30,
        fastTrack: 14,
      },
    };

    // Browse marketplace profiles
    const browseResult = await browseMarketplaceProfiles({
      specialty,
      region: state,
      readinessScore: minTrustScore,
      compactEligible: compactReady,
      limit: 200, // Get more, then filter and rank
    });

    // Convert to clinician profiles and calculate match scores
    const clinicianProfiles: ClinicianSearchResult[] = browseResult.profiles.map((profile) => {
      const clinician: MarketplaceClinicianProfile = {
        clinicianId: profile.clinicianId,
        trustScore: profile.readiness.score,
        specialty: profile.specialties,
        skills: profile.specialties, // In real implementation, fetch from skills table
        privileges: {
          icu: false, // In real implementation, fetch from privileges
          or: false,
          telemedicine: profile.compactEligibility.eligible,
          emergency: false,
        },
        telemedicineEligibility: {
          eligible: profile.compactEligibility.eligible,
          states: profile.regions,
          compacts: profile.compactEligibility.compacts,
        },
        compactEligibility: {
          eligible: profile.compactEligibility.eligible,
          compacts: profile.compactEligibility.compacts,
          states: profile.regions,
        },
        readinessScore: profile.readiness.score,
        availability: {
          status: 'available', // In real implementation, fetch from availability
        },
        trustTrajectory: {
          trend: 'stable',
          velocity: 0,
          lastUpdated: profile.updatedAt,
        },
      };

      const matchScore = calculateMatchScore(clinician, facilityProfile);

      return {
        ...clinician,
        matchScore,
      };
    });

    // Apply filters
    let filtered = clinicianProfiles;

    if (telemedicineEligible) {
      filtered = filtered.filter(c => c.telemedicineEligibility.eligible);
    }
    if (icuPrivileges) {
      filtered = filtered.filter(c => c.privileges.icu);
    }
    if (orPrivileges) {
      filtered = filtered.filter(c => c.privileges.or);
    }
    if (deaActive) {
      // In real implementation, check DEA status
      filtered = filtered; // Placeholder
    }
    if (compactReady) {
      filtered = filtered.filter(c => c.compactEligibility.eligible);
    }

    // Rank by match score and trust score
    const ranked = rankMarketplaceResults(filtered);

    // Limit results
    const limited = ranked.slice(0, limit);

    return res.json({
      facility: facilityProfile,
      filters: {
        specialty,
        state,
        minTrustScore,
        telemedicineEligible,
        icuPrivileges,
        orPrivileges,
        deaActive,
        compactReady,
        riskScore,
      },
      total: ranked.length,
      results: limited.map(c => ({
        clinicianId: c.clinicianId,
        trustScore: c.trustScore,
        specialty: c.specialty,
        matchScore: c.matchScore,
        privileges: c.privileges,
        telemedicineEligible: c.telemedicineEligibility.eligible,
        compactEligible: c.compactEligibility.eligible,
        readinessScore: c.readinessScore,
        availability: c.availability,
      })),
    });
  } catch (error) {
    console.error('[marketplace][facility][browse] failed', error);
    return res.status(500).json({
      error: 'marketplace_browse_failed',
      message: error instanceof Error ? error.message : 'Unable to browse marketplace',
    });
  }
});

/**
 * GET /api/marketplace/facility/favorites
 * Get facility's shortlisted clinicians
 */
router.get('/favorites', async (req: Request, res: Response) => {
  try {
    const facilityId = req.query.facilityId as string;

    // In real implementation, fetch from favorites table
    // const favorites = await prisma.facilityFavorite.findMany({ where: { facilityId } });

    return res.json({
      facilityId,
      favorites: [],
    });
  } catch (error) {
    console.error('[marketplace][facility][favorites] failed', error);
    return res.status(500).json({
      error: 'favorites_fetch_failed',
      message: error instanceof Error ? error.message : 'Unable to fetch favorites',
    });
  }
});

/**
 * POST /api/marketplace/facility/favorites
 * Add clinician to facility favorites
 */
router.post('/favorites', async (req: Request, res: Response) => {
  try {
    const { facilityId, clinicianId } = req.body;

    if (!facilityId || !clinicianId) {
      return res.status(400).json({
        error: 'missing_parameters',
        message: 'facilityId and clinicianId are required',
      });
    }

    // In real implementation, upsert favorite
    // await prisma.facilityFavorite.upsert({
    //   where: { facilityId_clinicianId: { facilityId, clinicianId } },
    //   create: { facilityId, clinicianId, createdAt: new Date() },
    //   update: { updatedAt: new Date() },
    // });

    return res.json({
      success: true,
      facilityId,
      clinicianId,
    });
  } catch (error) {
    console.error('[marketplace][facility][favorites][add] failed', error);
    return res.status(500).json({
      error: 'favorite_add_failed',
      message: error instanceof Error ? error.message : 'Unable to add favorite',
    });
  }
});

export default router;

