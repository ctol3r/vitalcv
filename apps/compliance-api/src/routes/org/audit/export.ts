/**
 * B141A-AUD-004: Audit export API
 * Exports audit events in newline-delimited JSON format with time bounds
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireOrgPermission } from '../../../../../api/src/middleware/requireOrgPermission';
import * as crypto from 'crypto';

const router = Router();
const prisma = new PrismaClient();

/**
 * Export audit events for an organization
 *
 * GET /org/:orgId/audit/export
 *
 * Query parameters:
 * - startDate: ISO 8601 date string (required)
 * - endDate: ISO 8601 date string (required)
 * - eventTypes: Comma-separated list of event types (optional, filters by type)
 * - resourceTypes: Comma-separated list of resource types (optional, for settings events)
 * - format: 'ndjson' (default) or 'json'
 *
 * Response:
 * - Content-Type: application/x-ndjson (or application/json)
 * - Streams newline-delimited JSON events
 * - Includes manifest hash at the end
 */
router.get(
  '/:orgId/audit/export',
  requireOrgPermission(['audit:export:read', 'audit:export:write']),
  async (req: Request, res: Response) => {
    try {
      const { orgId } = req.params;
      const {
        startDate,
        endDate,
        eventTypes,
        resourceTypes,
        format = 'ndjson',
      } = req.query;

      // Validate required parameters
      if (!startDate || !endDate) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'startDate and endDate query parameters are required',
        });
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid date format. Use ISO 8601 format',
        });
      }

      // Validate date range (max 1 year)
      const maxRangeMs = 365 * 24 * 60 * 60 * 1000; // 1 year
      if (end.getTime() - start.getTime() > maxRangeMs) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Date range cannot exceed 1 year',
        });
      }

      // Parse event types filter
      const eventTypesArray = eventTypes
        ? (eventTypes as string).split(',').map((t) => t.trim())
        : undefined;

      // Parse resource types filter
      const resourceTypesArray = resourceTypes
        ? (resourceTypes as string).split(',').map((t) => t.trim())
        : undefined;

      // Set response headers for streaming
      if (format === 'ndjson') {
        res.setHeader('Content-Type', 'application/x-ndjson');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="audit-export-${orgId}-${start.toISOString().split('T')[0]}-to-${end.toISOString().split('T')[0]}.ndjson"`
        );
      } else {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="audit-export-${orgId}-${start.toISOString().split('T')[0]}-to-${end.toISOString().split('T')[0]}.json"`
        );
      }

      // Stream events
      const events: any[] = [];
      const hash = crypto.createHash('sha256');

      // Fetch general audit events
      const auditEventsWhere: any = {
        createdAt: {
          gte: start,
          lte: end,
        },
      };

      if (eventTypesArray) {
        auditEventsWhere.type = { in: eventTypesArray };
      }

      const auditEvents = await prisma.auditEvent.findMany({
        where: auditEventsWhere,
        orderBy: { createdAt: 'asc' },
      });

      // Fetch settings audit events for this org
      const settingsEventsWhere: any = {
        orgId,
        createdAt: {
          gte: start,
          lte: end,
        },
      };

      if (eventTypesArray) {
        settingsEventsWhere.action = { in: eventTypesArray };
      }

      if (resourceTypesArray) {
        settingsEventsWhere.resourceType = { in: resourceTypesArray };
      }

      const settingsEvents = await prisma.settingsAuditEvent.findMany({
        where: settingsEventsWhere,
        orderBy: { createdAt: 'asc' },
      });

      // Combine and sort all events
      const allEvents = [
        ...auditEvents.map((e) => ({
          ...e,
          eventSource: 'audit',
          timestamp: e.createdAt,
        })),
        ...settingsEvents.map((e) => ({
          ...e,
          eventSource: 'settings',
          timestamp: e.createdAt,
        })),
      ].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      if (format === 'json') {
        // Return as JSON array
        const exportData = {
          metadata: {
            orgId,
            startDate: start.toISOString(),
            endDate: end.toISOString(),
            exportedAt: new Date().toISOString(),
            exportedBy: (req as any).user?.id,
            eventCount: allEvents.length,
            filters: {
              eventTypes: eventTypesArray,
              resourceTypes: resourceTypesArray,
            },
          },
          events: allEvents,
        };

        const exportJson = JSON.stringify(exportData, null, 2);
        const manifestHash = crypto
          .createHash('sha256')
          .update(exportJson)
          .digest('hex');

        exportData.metadata = {
          ...exportData.metadata,
          manifestHash,
        } as any;

        return res.json(exportData);
      }

      // Stream as NDJSON
      for (const event of allEvents) {
        const line = JSON.stringify(event);
        hash.update(line);
        res.write(line + '\n');
      }

      // Write manifest at the end
      const manifestHash = hash.digest('hex');
      const manifest = {
        type: 'EXPORT_MANIFEST',
        orgId,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        exportedAt: new Date().toISOString(),
        exportedBy: (req as any).user?.id,
        eventCount: allEvents.length,
        filters: {
          eventTypes: eventTypesArray,
          resourceTypes: resourceTypesArray,
        },
        manifestHash,
        anchoredAt: new Date().toISOString(),
      };

      res.write(JSON.stringify(manifest) + '\n');

      // Create audit event for the export
      await prisma.auditEvent.create({
        data: {
          type: 'AUDIT_EXPORT_COMPLETED',
          data: {
            orgId,
            startDate: start.toISOString(),
            endDate: end.toISOString(),
            eventCount: allEvents.length,
            manifestHash,
            exportedBy: (req as any).user?.id,
          },
        },
      });

      res.end();
    } catch (error) {
      console.error('Audit export error:', error);

      if (!res.headersSent) {
        return res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to export audit events',
        });
      }

      // If headers already sent, just end the response
      res.end();
    }
  }
);

/**
 * Get audit export history/metadata
 *
 * GET /org/:orgId/audit/exports
 *
 * Returns list of previous audit exports for the organization
 */
router.get(
  '/:orgId/audit/exports',
  requireOrgPermission(['audit:export:read']),
  async (req: Request, res: Response) => {
    try {
      const { orgId } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      const exports = await prisma.auditEvent.findMany({
        where: {
          type: 'AUDIT_EXPORT_COMPLETED',
          data: {
            path: ['orgId'],
            equals: orgId,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: Number(limit),
        skip: Number(offset),
      });

      const total = await prisma.auditEvent.count({
        where: {
          type: 'AUDIT_EXPORT_COMPLETED',
          data: {
            path: ['orgId'],
            equals: orgId,
          },
        },
      });

      return res.json({
        exports: exports.map((e) => ({
          id: e.id,
          exportedAt: e.createdAt,
          ...e.data,
        })),
        pagination: {
          total,
          limit: Number(limit),
          offset: Number(offset),
        },
      });
    } catch (error) {
      console.error('Get audit exports error:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to retrieve audit exports',
      });
    }
  }
);

export default router;

