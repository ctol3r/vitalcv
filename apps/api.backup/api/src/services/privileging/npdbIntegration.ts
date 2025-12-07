/**
 * B134A-PRIV-010: NPDB/OIG Integration Service
 *
 * Monitors clinicians against NPDB (National Practitioner Data Bank) and OIG (Office of Inspector General)
 * Automatically triggers privilege hold if adverse actions are found.
 */

import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

export interface NpdbCheckResult {
  npi: string;
  clean: boolean;
  adverseActions?: Array<{
    type: string;
    date: string;
    description: string;
    severity?: string;
  }>;
  checkDate: string;
}

export interface OigCheckResult {
  npi: string;
  excluded: boolean;
  exclusionDate?: string;
  exclusionType?: string;
  checkDate: string;
}

/**
 * NPDB/OIG Integration Service
 */
export class NpdbOigService {
  /**
   * Check clinician against NPDB
   * In production, this would call the actual NPDB API
   */
  static async checkNpdb(npi: string, clinicianDid: string): Promise<NpdbCheckResult> {
    // TODO: Replace with actual NPDB API call
    // For now, this is a stub that simulates the check

    const npdbUrl = process.env.NPDB_API_URL || 'https://www.npdb.hrsa.gov/api/v1';
    const npdbApiKey = process.env.NPDB_API_KEY;

    try {
      // Simulated response - in production, call actual NPDB API
      const mockResponse: NpdbCheckResult = {
        npi,
        clean: true,
        checkDate: new Date().toISOString(),
      };

      // In production:
      // const response = await axios.post(`${npdbUrl}/check`, {
      //   npi,
      //   includeDetails: true,
      // }, {
      //   headers: { 'X-API-Key': npdbApiKey }
      // });
      // return response.data;

      return mockResponse;
    } catch (error) {
      console.error('NPDB check failed:', error);
      throw new Error('NPDB check failed');
    }
  }

  /**
   * Check clinician against OIG Exclusions List
   */
  static async checkOig(npi: string, clinicianDid: string): Promise<OigCheckResult> {
    // OIG LEIE (List of Excluded Individuals/Entities) API
    const oigUrl = process.env.OIG_API_URL || 'https://oig.hhs.gov/exclusions/exclusions_list.asp';

    try {
      // Simulated response - in production, call actual OIG API
      const mockResponse: OigCheckResult = {
        npi,
        excluded: false,
        checkDate: new Date().toISOString(),
      };

      // In production:
      // const response = await axios.get(`${oigUrl}/api/v1/exclusions`, {
      //   params: { npi }
      // });
      // return response.data;

      return mockResponse;
    } catch (error) {
      console.error('OIG check failed:', error);
      throw new Error('OIG check failed');
    }
  }

  /**
   * Comprehensive check against both NPDB and OIG
   */
  static async comprehensiveCheck(
    npi: string,
    clinicianDid: string
  ): Promise<{
    npdb: NpdbCheckResult;
    oig: OigCheckResult;
    overallClean: boolean;
  }> {
    const [npdbResult, oigResult] = await Promise.all([
      this.checkNpdb(npi, clinicianDid),
      this.checkOig(npi, clinicianDid),
    ]);

    const overallClean = npdbResult.clean && !oigResult.excluded;

    // Store results in database
    await this.recordCheck('NPDB', clinicianDid, npi, npdbResult);
    await this.recordCheck('OIG', clinicianDid, npi, oigResult);

    return {
      npdb: npdbResult,
      oig: oigResult,
      overallClean,
    };
  }

  /**
   * Record check result in database
   */
  private static async recordCheck(
    monitorType: 'NPDB' | 'OIG',
    clinicianDid: string,
    npi: string,
    result: NpdbCheckResult | OigCheckResult
  ) {
    const isNpdbResult = 'clean' in result;
    const hasAdverseAction = isNpdbResult
      ? !result.clean
      : (result as OigCheckResult).excluded;

    const adverseActions = isNpdbResult
      ? (result as NpdbCheckResult).adverseActions
      : (result as OigCheckResult).excluded
      ? [
          {
            type: 'OIG_EXCLUSION',
            date: (result as OigCheckResult).exclusionDate || new Date().toISOString(),
            description: `Excluded from federal healthcare programs: ${
              (result as OigCheckResult).exclusionType || 'Unknown type'
            }`,
          },
        ]
      : [];

    await prisma.npdbOigMonitor.create({
      data: {
        clinicianDid,
        npi,
        monitorType,
        checkDate: new Date(),
        status: hasAdverseAction ? 'ADVERSE_ACTION' : 'CLEAN',
        adverseActions: adverseActions || [],
        rawResponse: result,
        privilegeAction: hasAdverseAction ? 'HOLD' : 'NONE',
        notificationSent: false,
        orgIds: [],
      },
    });
  }

  /**
   * Auto-trigger privilege hold if adverse action found
   */
  static async processAdverseAction(
    clinicianDid: string,
    npi: string,
    adverseActions: any[]
  ): Promise<void> {
    // Find all active privilege requests for this clinician
    const activeRequests = await prisma.privilegeRequest.findMany({
      where: {
        clinicianDid,
        status: { in: ['APPROVED', 'UNDER_REVIEW'] },
      },
      include: {
        privilegeSet: true,
      },
    });

    if (activeRequests.length === 0) {
      return;
    }

    const orgIds = [...new Set(activeRequests.map((req) => req.orgId))];

    // Update all approved requests to HOLD status
    await Promise.all(
      activeRequests
        .filter((req) => req.status === 'APPROVED')
        .map((req) =>
          prisma.privilegeRequest.update({
            where: { id: req.id },
            data: {
              status: 'DENIED', // or create a HOLD status
              reviewNotes: `Privilege automatically suspended due to adverse action: ${JSON.stringify(
                adverseActions
              )}`,
              reviewedAt: new Date(),
            },
          })
        )
    );

    // Update NPDB/OIG monitor record with org notifications
    const latestMonitor = await prisma.npdbOigMonitor.findFirst({
      where: { clinicianDid, npi },
      orderBy: { checkDate: 'desc' },
    });

    if (latestMonitor) {
      await prisma.npdbOigMonitor.update({
        where: { id: latestMonitor.id },
        data: {
          orgIds,
          privilegeAction: 'HOLD',
        },
      });
    }

    // Send notifications to organizations
    await this.notifyOrganizations(orgIds, clinicianDid, npi, adverseActions);

    // Create audit event
    await prisma.auditEvent.create({
      data: {
        type: 'PRIVILEGE_AUTO_HOLD',
        subjectNpi: npi,
        data: {
          clinicianDid,
          adverseActions,
          affectedOrgs: orgIds,
          affectedRequests: activeRequests.map((r) => r.id),
        },
      },
    });
  }

  /**
   * Notify organizations of adverse action
   */
  private static async notifyOrganizations(
    orgIds: string[],
    clinicianDid: string,
    npi: string,
    adverseActions: any[]
  ): Promise<void> {
    // In production, this would send emails/webhooks to organizations
    console.log('Notifying organizations:', {
      orgIds,
      clinicianDid,
      npi,
      adverseActions,
    });

    // TODO: Implement actual notification logic
    // - Send emails to org admins
    // - Post to org webhook endpoints
    // - Create in-app notifications
  }

  /**
   * Scheduled check for all clinicians with active privileges
   */
  static async scheduledMonitoring(): Promise<void> {
    // Find all clinicians with approved privileges
    const approvedRequests = await prisma.privilegeRequest.findMany({
      where: {
        status: 'APPROVED',
      },
      select: {
        clinicianDid: true,
      },
      distinct: ['clinicianDid'],
    });

    console.log(`Running NPDB/OIG checks for ${approvedRequests.length} clinicians`);

    for (const request of approvedRequests) {
      try {
        // Get NPI from user's claims
        const user = await prisma.user.findFirst({
          where: { did: request.clinicianDid },
          include: { npiClaims: true },
        });

        if (!user || !user.npiClaims.length) {
          console.warn(`No NPI found for clinician: ${request.clinicianDid}`);
          continue;
        }

        const npi = user.npiClaims[0].npi;

        // Run comprehensive check
        const result = await this.comprehensiveCheck(npi, request.clinicianDid);

        // If adverse action found, process it
        if (!result.overallClean) {
          const adverseActions = [
            ...(result.npdb.adverseActions || []),
            ...(result.oig.excluded
              ? [
                  {
                    type: 'OIG_EXCLUSION',
                    date: result.oig.exclusionDate || new Date().toISOString(),
                    description: `OIG Exclusion: ${result.oig.exclusionType || 'Unknown'}`,
                  },
                ]
              : []),
          ];

          await this.processAdverseAction(request.clinicianDid, npi, adverseActions);
        }
      } catch (error) {
        console.error(`Error checking clinician ${request.clinicianDid}:`, error);
      }
    }
  }

  /**
   * Get latest NPDB/OIG status for a clinician
   */
  static async getLatestStatus(clinicianDid: string): Promise<{
    npdb?: any;
    oig?: any;
    overallClean: boolean;
  } | null> {
    const [npdbRecord, oigRecord] = await Promise.all([
      prisma.npdbOigMonitor.findFirst({
        where: { clinicianDid, monitorType: 'NPDB' },
        orderBy: { checkDate: 'desc' },
      }),
      prisma.npdbOigMonitor.findFirst({
        where: { clinicianDid, monitorType: 'OIG' },
        orderBy: { checkDate: 'desc' },
      }),
    ]);

    if (!npdbRecord && !oigRecord) {
      return null;
    }

    const overallClean =
      (npdbRecord?.status === 'CLEAN' || !npdbRecord) &&
      (oigRecord?.status === 'CLEAN' || !oigRecord);

    return {
      npdb: npdbRecord,
      oig: oigRecord,
      overallClean,
    };
  }
}

