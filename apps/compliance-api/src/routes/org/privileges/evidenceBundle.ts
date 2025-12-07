/**
 * S72-STRETCH-B-008: Privilege & OPPE/FPPE Evidence Bundle Exporter
 *
 * GET /api/org/:orgId/privileges/evidence-bundle
 *
 * Exports a ZIP bundle containing PrivilegeGranted VCs, FPPE/OPPE evaluations,
 * and PSV manifests for NCQA/Hospital compliance audits.
 * Includes manifest.json for each clinician.
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import * as archiver from 'archiver';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

/**
 * Request validation schema
 */
const PrivilegeEvidenceBundleSchema = z.object({
  clinicianIds: z.array(z.string()).optional(), // Optional: specific clinicians, otherwise all
  startDate: z.coerce.date().optional(), // Optional: filter by date range
  endDate: z.coerce.date().optional(),
  includeVCs: z.boolean().default(true),
  includeFPPE: z.boolean().default(true),
  includeOPPE: z.boolean().default(true),
  includePSVManifest: z.boolean().default(true),
});

type PrivilegeEvidenceBundleInput = z.infer<typeof PrivilegeEvidenceBundleSchema>;

/**
 * GET /api/org/:orgId/privileges/evidence-bundle
 * Export privilege evidence bundle as ZIP
 */
router.get('/:orgId/privileges/evidence-bundle', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const query = req.query;

    // TODO: Add authentication middleware to verify user has export permissions

    // Validate query parameters
    const validation = PrivilegeEvidenceBundleSchema.safeParse({
      clinicianIds: query.clinicianIds ? String(query.clinicianIds).split(',') : undefined,
      startDate: query.startDate ? new Date(String(query.startDate)) : undefined,
      endDate: query.endDate ? new Date(String(query.endDate)) : undefined,
      includeVCs: query.includeVCs !== 'false',
      includeFPPE: query.includeFPPE !== 'false',
      includeOPPE: query.includeOPPE !== 'false',
      includePSVManifest: query.includePSVManifest !== 'false',
    });

    if (!validation.success) {
      res.status(400).json({
        error: 'ValidationError',
        message: 'Invalid query parameters',
        details: validation.error.errors,
      });
      return;
    }

    const {
      clinicianIds,
      startDate,
      endDate,
      includeVCs,
      includeFPPE,
      includeOPPE,
      includePSVManifest,
    } = validation.data;

    // Build filter for PrivilegeGranted records
    const where: any = {
      orgId,
      status: {
        in: ['ACTIVE', 'HOLD', 'SUSPENDED'], // Include active and held privileges
      },
    };

    if (clinicianIds && clinicianIds.length > 0) {
      where.clinicianDid = { in: clinicianIds };
    }

    if (startDate || endDate) {
      where.grantedAt = {};
      if (startDate) where.grantedAt.gte = startDate;
      if (endDate) where.grantedAt.lte = endDate;
    }

    // Fetch all PrivilegeGranted records with related data
    const privilegesGranted = await prisma.privilegeGranted.findMany({
      where,
      include: {
        privilegeRequest: {
          include: {
            privilegeSet: true,
          },
        },
        fppeRecords: includeFPPE || includeOPPE ? {
          orderBy: { startAt: 'desc' },
        } : false,
        renewals: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
      orderBy: { grantedAt: 'desc' },
    });

    // Group by clinician
    const clinicianMap = new Map<string, any>();

    for (const privilege of privilegesGranted) {
      const clinicianId = privilege.clinicianDid;
      if (!clinicianMap.has(clinicianId)) {
        clinicianMap.set(clinicianId, {
          clinicianId,
          orgId: privilege.orgId,
          privileges: [],
          fppeRecords: [],
          oppeRecords: [],
        });
      }

      const clinician = clinicianMap.get(clinicianId);
      clinician.privileges.push(privilege);

      // Add FPPE records
      if (includeFPPE && privilege.fppeRecords) {
        clinician.fppeRecords.push(...privilege.fppeRecords);
      }
    }

    // Fetch OPPE schedules and FppeOppe records
    if (includeOPPE) {
      const clinicianIdsArray = Array.from(clinicianMap.keys());
      const oppeSchedules = await prisma.oPPESchedule.findMany({
        where: {
          orgId,
          clinicianId: { in: clinicianIdsArray },
        },
      });

      // Fetch FppeOppe records for these clinicians
      const fppeOppeRecords = await prisma.fppeOppe.findMany({
        where: {
          orgId,
          clinicianDid: { in: clinicianIdsArray },
        },
        include: {
          privilegeRequest: {
            include: {
              privilegeGranted: true,
            },
          },
        },
      });

      for (const schedule of oppeSchedules) {
        const clinician = clinicianMap.get(schedule.clinicianId);
        if (clinician) {
          clinician.oppeSchedule = schedule;
        }
      }

      for (const oppe of fppeOppeRecords) {
        const clinician = clinicianMap.get(oppe.clinicianDid);
        if (clinician) {
          clinician.oppeRecords = clinician.oppeRecords || [];
          clinician.oppeRecords.push(oppe);
        }
      }
    }

    // Create ZIP archive
    const archive = archiver('zip', { zlib: { level: 9 } });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="privilege-evidence-bundle-${orgId}-${Date.now()}.zip"`
    );

    archive.pipe(res);

    // Add manifest.json for overall bundle
    const bundleManifest = {
      version: '1.0',
      orgId,
      exportDate: new Date().toISOString(),
      totalClinicians: clinicianMap.size,
      totalPrivileges: privilegesGranted.length,
      includes: {
        vcs: includeVCs,
        fppe: includeFPPE,
        oppe: includeOPPE,
        psvManifest: includePSVManifest,
      },
      clinicianIds: Array.from(clinicianMap.keys()),
    };

    archive.append(JSON.stringify(bundleManifest, null, 2), {
      name: 'manifest.json',
    });

    // Process each clinician
    for (const [clinicianId, clinician] of clinicianMap.entries()) {
      const clinicianDir = `clinicians/${clinicianId}`;

      // Create manifest.json for this clinician
      const clinicianManifest: any = {
        clinicianId,
        orgId: clinician.orgId,
        privilegeCount: clinician.privileges.length,
        fppeRecordCount: clinician.fppeRecords?.length || 0,
        oppeRecordCount: clinician.oppeRecords?.length || 0,
        privileges: clinician.privileges.map((p: any) => ({
          id: p.id,
          privilegeSetId: p.privilegeSetId,
          privilegeSetName: p.privilegeRequest.privilegeSet.name,
          status: p.status,
          grantedAt: p.grantedAt.toISOString(),
          expiresAt: p.expiresAt.toISOString(),
          vcHash: p.vcHash,
          vcCredentialId: p.vcCredentialId,
        })),
      };

      // Add PrivilegeGranted VCs
      if (includeVCs) {
        for (const privilege of clinician.privileges) {
          if (privilege.vcHash) {
            // In production, fetch actual VC JSON from storage
            const vcData = {
              id: privilege.vcCredentialId || privilege.id,
              type: 'PrivilegeGranted',
              privilegeGrantedId: privilege.id,
              vcHash: privilege.vcHash,
              issuedAt: privilege.grantedAt.toISOString(),
              expiresAt: privilege.expiresAt.toISOString(),
              status: privilege.status,
              privilegeSet: privilege.privilegeRequest.privilegeSet.name,
            };

            archive.append(JSON.stringify(vcData, null, 2), {
              name: `${clinicianDir}/privileges/${privilege.id}-vc.json`,
            });

            clinicianManifest.privileges.find((p: any) => p.id === privilege.id).vcFile = `${privilege.id}-vc.json`;
          }
        }
      }

      // Add FPPE records
      if (includeFPPE && clinician.fppeRecords) {
        const fppeDir = `${clinicianDir}/fppe`;
        for (const fppe of clinician.fppeRecords) {
          const fppeData = {
            id: fppe.id,
            privilegeGrantedId: fppe.privilegeGrantedId,
            startAt: fppe.startAt.toISOString(),
            endAt: fppe.endAt?.toISOString() || null,
            status: fppe.status,
            notes: fppe.notes || null,
          };

          archive.append(JSON.stringify(fppeData, null, 2), {
            name: `${fppeDir}/${fppe.id}.json`,
          });
        }

        clinicianManifest.fppeFiles = clinician.fppeRecords.map((f: any) => `${f.id}.json`);
      }

      // Add OPPE records
      if (includeOPPE) {
        const oppeDir = `${clinicianDir}/oppe`;

        if (clinician.oppeSchedule) {
          const scheduleData = {
            id: clinician.oppeSchedule.id,
            frequencyMonths: clinician.oppeSchedule.frequencyMonths,
            nextReviewAt: clinician.oppeSchedule.nextReviewAt?.toISOString() || null,
          };

          archive.append(JSON.stringify(scheduleData, null, 2), {
            name: `${oppeDir}/schedule.json`,
          });
        }

        if (clinician.oppeRecords) {
          for (const oppe of clinician.oppeRecords) {
            const oppeData = {
              id: oppe.id,
              privilegeRequestId: oppe.privilegeRequestId,
              fppeStatus: oppe.fppeStatus,
              fppeStartDate: oppe.fppeStartDate?.toISOString() || null,
              fppeEndDate: oppe.fppeEndDate?.toISOString() || null,
              fppeMetrics: oppe.fppeMetrics,
              oppeStatus: oppe.oppeStatus,
              oppeIntervalMonths: oppe.oppeIntervalMonths,
              oppeNextReviewDue: oppe.oppeNextReviewDue?.toISOString() || null,
              oppeLastReviewDate: oppe.oppeLastReviewDate?.toISOString() || null,
              oppeMetrics: oppe.oppeMetrics,
              notes: oppe.notes || null,
            };

            archive.append(JSON.stringify(oppeData, null, 2), {
              name: `${oppeDir}/${oppe.id}.json`,
            });
          }

          clinicianManifest.oppeFiles = clinician.oppeRecords.map((o: any) => `${o.id}.json`);
        }
      }

      // Add PSV manifest
      if (includePSVManifest) {
        // Fetch NPDB/OIG monitoring records
        const npdbChecks = await prisma.npdbOigMonitor.findMany({
          where: {
            clinicianDid: clinicianId,
            orgIds: { has: orgId },
          },
          orderBy: { checkDate: 'desc' },
          take: 10,
        });

        const psvManifest = {
          clinicianId,
          orgId: clinician.orgId,
          generatedAt: new Date().toISOString(),
          npdbChecks: npdbChecks.map(check => ({
            id: check.id,
            monitorType: check.monitorType,
            checkDate: check.checkDate.toISOString(),
            status: check.status,
            adverseActions: check.adverseActions,
          })),
          // In production, include actual PSV logs for licenses, board certs, etc.
        };

        archive.append(JSON.stringify(psvManifest, null, 2), {
          name: `${clinicianDir}/psv-manifest.json`,
        });

        clinicianManifest.psvManifestFile = 'psv-manifest.json';
      }

      // Add clinician manifest
      archive.append(JSON.stringify(clinicianManifest, null, 2), {
        name: `${clinicianDir}/manifest.json`,
      });
    }

    // Finalize archive
    await archive.finalize();

    // Log audit event
    await prisma.auditEvent.create({
      data: {
        type: 'PRIVILEGE_EVIDENCE_BUNDLE_EXPORTED',
        subjectNpi: null,
        data: {
          orgId,
          totalClinicians: clinicianMap.size,
          totalPrivileges: privilegesGranted.length,
          includes: {
            vcs: includeVCs,
            fppe: includeFPPE,
            oppe: includeOPPE,
            psvManifest: includePSVManifest,
          },
          clinicianIds: Array.from(clinicianMap.keys()),
        },
      },
    });
  } catch (error) {
    console.error('Error exporting privilege evidence bundle:', error);
    res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to export privilege evidence bundle',
    });
  }
});

export { router as privilegeEvidenceBundleRouter };

