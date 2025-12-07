/**
 * B150A-DSAR-006: DSAR export bundle (subject data export)
 *
 * GET /privacy/export
 * Returns ZIP containing JSON per domain (account, credentials, enrollments, jobs)
 * Excludes logs not tied to subject
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import archiver from 'archiver';
import { Readable } from 'stream';
import { loadUserSession, requireAuth, AuthenticatedRequest } from '../../../../../backend/src/middleware/accessGuards';

const router = Router();
const prisma = new PrismaClient();

/**
 * Extract current user ID from authenticated request
 */
function getCurrentUserId(req: Request): string {
  const authReq = req as AuthenticatedRequest;

  if (!authReq.user || !authReq.user.id) {
    throw new Error('User authentication required');
  }

  // Convert to string if needed (handles both string and number IDs)
  return String(authReq.user.id);
}

/**
 * GET /privacy/export
 * Export all user data in a ZIP bundle
 *
 * Returns ZIP file containing:
 * - account.json - User account information
 * - credentials.json - Credentials and VCs
 * - enrollments.json - Payer enrollments
 * - jobs.json - Job applications and postings
 * - npi-claims.json - NPI claims
 * - privileges.json - Privilege requests and grants
 * - metadata.json - Export metadata
 */
router.get('/privacy/export', loadUserSession, requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = getCurrentUserId(req);

    // Fetch all user data
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        credentials: {
          orderBy: { issuedAt: 'desc' },
        },
        npiClaims: {
          orderBy: { createdAt: 'desc' },
        },
        jobs: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        error: 'user_not_found',
        message: 'User not found',
      });
    }

    // Fetch related data
    const [applications, privilegeRequests, payerEnrollments] = await Promise.all([
      // Applications where user is applicant
      prisma.application.findMany({
        where: {
          applicantDid: user.did || userId,
        },
        include: {
          job: {
            select: {
              id: true,
              title: true,
              specialty: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),

      // Privilege requests
      prisma.privilegeRequest.findMany({
        where: {
          clinicianDid: user.did || userId,
        },
        include: {
          privilegeSet: {
            select: {
              id: true,
              name: true,
              description: true,
              department: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),

      // Payer enrollments
      prisma.payerEnrollment.findMany({
        where: {
          clinicianDid: user.did || userId,
        },
        include: {
          payer: {
            select: {
              id: true,
              payerId: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Prepare export data by domain
    const exportData = {
      account: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        did: user.did,
        roles: user.roles,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },

      credentials: user.credentials.map(cred => ({
        id: cred.id,
        name: cred.name,
        type: cred.type,
        issuer: cred.issuer,
        issuerDid: cred.issuerDid,
        status: cred.status,
        version: cred.version,
        issuedAt: cred.issuedAt.toISOString(),
        expiresAt: cred.expiresAt?.toISOString(),
        credHash: cred.credHash,
      })),

      'npi-claims': user.npiClaims.map(claim => ({
        id: claim.id,
        npi: claim.npi,
        level: claim.level,
        lastVerifiedAt: claim.lastVerifiedAt?.toISOString(),
        caqhProfileId: claim.caqhProfileId,
        createdAt: claim.createdAt.toISOString(),
        updatedAt: claim.updatedAt.toISOString(),
      })),

      jobs: user.jobs.map(job => ({
        id: job.id,
        title: job.title,
        description: job.description,
        createdAt: job.createdAt.toISOString(),
      })),

      applications: applications.map(app => ({
        id: app.id,
        jobId: app.jobId,
        job: app.job,
        status: app.status,
        matchScore: app.matchScore,
        matchReason: app.matchReason,
        createdAt: app.createdAt.toISOString(),
        updatedAt: app.updatedAt.toISOString(),
      })),

      privileges: privilegeRequests.map(req => ({
        id: req.id,
        orgId: req.orgId,
        privilegeSetId: req.privilegeSetId,
        privilegeSet: req.privilegeSet,
        status: req.status,
        reviewNotes: req.reviewNotes,
        reviewedAt: req.reviewedAt?.toISOString(),
        createdAt: req.createdAt.toISOString(),
        updatedAt: req.updatedAt.toISOString(),
      })),

      enrollments: payerEnrollments.map(enroll => ({
        id: enroll.id,
        orgId: enroll.orgId,
        payerId: enroll.payerId,
        payer: enroll.payer,
        status: enroll.status,
        caqhId: enroll.caqhId,
        pecosId: enroll.pecosId,
        submittedAt: enroll.submittedAt?.toISOString(),
        approvedAt: enroll.approvedAt?.toISOString(),
        createdAt: enroll.createdAt.toISOString(),
        updatedAt: enroll.updatedAt.toISOString(),
      })),

      metadata: {
        exportDate: new Date().toISOString(),
        userId: user.id,
        version: '1.0',
        domains: ['account', 'credentials', 'npi-claims', 'jobs', 'applications', 'privileges', 'enrollments'],
      },
    };

    // Log export event
    await prisma.auditEvent.create({
      data: {
        type: 'DSAR_EXPORT',
        userId,
        data: {
          exportDate: new Date().toISOString(),
          domains: exportData.metadata.domains,
        },
      },
    });

    // Set response headers for ZIP download
    const filename = `dsar-export-${userId}-${Date.now()}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Create ZIP archive
    const archive = archiver('zip', {
      zlib: { level: 9 }, // Maximum compression
    });

    // Handle archive errors
    archive.on('error', (err) => {
      console.error('Archive error:', err);
      if (!res.headersSent) {
        res.status(500).json({
          error: 'export_failed',
          message: 'Failed to create export archive',
        });
      }
    });

    // Pipe archive to response
    archive.pipe(res);

    // Add JSON files to archive
    for (const [domain, data] of Object.entries(exportData)) {
      const jsonString = JSON.stringify(data, null, 2);
      archive.append(jsonString, { name: `${domain}.json` });
    }

    // Finalize archive
    await archive.finalize();

    // Response is sent automatically via stream
  } catch (error: any) {
    console.error('DSAR export error:', error);

    if (error.message === 'User authentication required') {
      return res.status(401).json({
        error: 'authentication_required',
        message: 'User authentication required',
      });
    }

    if (!res.headersSent) {
      return res.status(500).json({
        error: 'export_failed',
        message: 'Failed to generate export',
        details: error.message,
      });
    }
  }
});

export default router;

