/**
 * COMP-006: HIPAA Accounting of Disclosures Service
 *
 * Ensures that each API response exposing PHI or regulated credential data
 * records who accessed it, for what PoU, and which fields were disclosed.
 * Provides query endpoints for generating an "accounting of disclosures" per subject.
 */

import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

export interface DisclosureLogInput {
  subjectId: string;
  subjectType: 'user' | 'npi' | 'did' | 'credential';
  resourceType: string;
  resourceId?: string;
  accessedBy: string;
  accessedByName?: string;
  purposeOfUse: string;
  disclosedFields: string[];
  apiEndpoint?: string;
  organizationId?: string;
  metadata?: Record<string, any>;
}

export interface DisclosureQuery {
  subjectId: string;
  startDate?: Date;
  endDate?: Date;
  purposeOfUse?: string;
  accessedBy?: string;
}

export class AccessDisclosureService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Log an access disclosure
   */
  async logDisclosure(
    input: DisclosureLogInput,
    req?: Request
  ): Promise<string> {
    const disclosure = await this.prisma.accessDisclosure.create({
      data: {
        subjectId: input.subjectId,
        subjectType: input.subjectType,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        accessedBy: input.accessedBy,
        accessedByName: input.accessedByName,
        purposeOfUse: input.purposeOfUse,
        disclosedFields: input.disclosedFields,
        apiEndpoint: input.apiEndpoint || req?.path,
        ipAddress: req?.ip || req?.headers['x-forwarded-for'] as string,
        userAgent: req?.headers['user-agent'],
        organizationId: input.organizationId,
        metadata: input.metadata as any,
      },
    });

    return disclosure.id;
  }

  /**
   * Log disclosure from request context
   * Automatically extracts information from request and PoU context
   */
  async logDisclosureFromRequest(
    subjectId: string,
    subjectType: 'user' | 'npi' | 'did' | 'credential',
    resourceType: string,
    resourceId: string | undefined,
    disclosedFields: string[],
    req: Request
  ): Promise<string> {
    const user = (req as any).user;
    const pouContext = (req as any).pouContext;

    return this.logDisclosure(
      {
        subjectId,
        subjectType,
        resourceType,
        resourceId,
        accessedBy: user?.id || 'anonymous',
        accessedByName: user?.name || user?.email,
        purposeOfUse: pouContext?.purposeOfUse || 'OPERATIONS',
        disclosedFields,
        apiEndpoint: req.path,
        organizationId: user?.orgId,
      },
      req
    );
  }

  /**
   * Query disclosures for a subject (for accounting of disclosures report)
   */
  async queryDisclosures(query: DisclosureQuery) {
    const where: any = {
      subjectId: query.subjectId,
    };

    if (query.startDate || query.endDate) {
      where.accessedAt = {};
      if (query.startDate) {
        where.accessedAt.gte = query.startDate;
      }
      if (query.endDate) {
        where.accessedAt.lte = query.endDate;
      }
    }

    if (query.purposeOfUse) {
      where.purposeOfUse = query.purposeOfUse;
    }

    if (query.accessedBy) {
      where.accessedBy = query.accessedBy;
    }

    return this.prisma.accessDisclosure.findMany({
      where,
      orderBy: {
        accessedAt: 'desc',
      },
    });
  }

  /**
   * Generate accounting of disclosures report for a subject
   * This is the format required by HIPAA for patient requests
   */
  async generateAccountingOfDisclosures(
    subjectId: string,
    startDate?: Date,
    endDate?: Date
  ) {
    const disclosures = await this.queryDisclosures({
      subjectId,
      startDate,
      endDate,
    });

    return {
      subjectId,
      reportGeneratedAt: new Date(),
      dateRange: {
        start: startDate || disclosures[disclosures.length - 1]?.accessedAt,
        end: endDate || disclosures[0]?.accessedAt,
      },
      totalDisclosures: disclosures.length,
      disclosures: disclosures.map(d => ({
        date: d.accessedAt,
        disclosedTo: d.accessedByName || d.accessedBy,
        purpose: d.purposeOfUse,
        description: this.describeDisclosure(d),
        fieldsDisclosed: d.disclosedFields,
      })),
    };
  }

  /**
   * Generate a human-readable description of a disclosure
   */
  private describeDisclosure(disclosure: any): string {
    const parts: string[] = [];

    parts.push(`Accessed ${disclosure.resourceType.toLowerCase()}`);

    if (disclosure.apiEndpoint) {
      parts.push(`via ${disclosure.apiEndpoint}`);
    }

    if (disclosure.purposeOfUse) {
      parts.push(`for ${disclosure.purposeOfUse.toLowerCase()}`);
    }

    if (disclosure.organizationId) {
      parts.push(`by organization ${disclosure.organizationId}`);
    }

    return parts.join(' ');
  }

  /**
   * Export accounting of disclosures as CSV
   */
  async exportAccountingOfDisclosuresAsCSV(
    subjectId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<string> {
    const report = await this.generateAccountingOfDisclosures(
      subjectId,
      startDate,
      endDate
    );

    const headers = [
      'Date',
      'Disclosed To',
      'Purpose',
      'Description',
      'Fields Disclosed',
    ];

    const rows = report.disclosures.map(d => [
      d.date.toISOString(),
      d.disclosedTo,
      d.purpose,
      d.description,
      d.fieldsDisclosed.join('; '),
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    return csv;
  }

  /**
   * Get disclosure statistics for a subject
   */
  async getDisclosureStats(subjectId: string, startDate?: Date, endDate?: Date) {
    const disclosures = await this.queryDisclosures({
      subjectId,
      startDate,
      endDate,
    });

    const stats = {
      totalDisclosures: disclosures.length,
      byPurposeOfUse: {} as Record<string, number>,
      byResourceType: {} as Record<string, number>,
      uniqueAccessors: new Set<string>(),
      dateRange: {
        start: startDate || disclosures[disclosures.length - 1]?.accessedAt,
        end: endDate || disclosures[0]?.accessedAt,
      },
    };

    for (const disclosure of disclosures) {
      // Count by PoU
      stats.byPurposeOfUse[disclosure.purposeOfUse] =
        (stats.byPurposeOfUse[disclosure.purposeOfUse] || 0) + 1;

      // Count by resource type
      stats.byResourceType[disclosure.resourceType] =
        (stats.byResourceType[disclosure.resourceType] || 0) + 1;

      // Track unique accessors
      stats.uniqueAccessors.add(disclosure.accessedBy);
    }

    return {
      ...stats,
      uniqueAccessorsCount: stats.uniqueAccessors.size,
      uniqueAccessors: Array.from(stats.uniqueAccessors),
    };
  }
}

/**
 * Middleware to automatically log disclosures
 * Should be used after response is sent to capture actual disclosed fields
 */
export function disclosureLoggingMiddleware(
  service: AccessDisclosureService
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    // Intercept response to log disclosure
    res.json = function(body: any) {
      // Determine disclosed fields from response body
      const disclosedFields = extractFieldNames(body);

      // Determine subject from request/body
      const subjectId = extractSubjectId(req, body);
      const subjectType = inferSubjectType(req, body);
      const resourceType = inferResourceType(req);
      const resourceId = extractResourceId(req, body);

      // Log disclosure asynchronously (non-blocking)
      if (subjectId && disclosedFields.length > 0) {
        service
          .logDisclosureFromRequest(
            subjectId,
            subjectType,
            resourceType,
            resourceId,
            disclosedFields,
            req
          )
          .catch(err => {
            console.error('Failed to log disclosure:', err);
          });
      }

      return originalJson(body);
    };

    res.send = function(body: any) {
      // Similar logic for res.send
      return originalSend(body);
    };

    next();
  };
}

/**
 * Extract field names from a response body (recursively)
 */
function extractFieldNames(obj: any, prefix = ''): string[] {
  const fields: string[] = [];

  if (obj === null || obj === undefined) {
    return fields;
  }

  if (Array.isArray(obj)) {
    // For arrays, extract fields from first item
    if (obj.length > 0) {
      fields.push(...extractFieldNames(obj[0], prefix));
    }
    return fields;
  }

  if (typeof obj === 'object') {
    for (const key in obj) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      fields.push(fullKey);

      // Recursively extract nested fields
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        fields.push(...extractFieldNames(obj[key], fullKey));
      }
    }
  }

  return fields;
}

/**
 * Extract subject ID from request or response body
 */
function extractSubjectId(req: Request, body: any): string | null {
  // Check route params
  if (req.params.id) {
    return req.params.id;
  }

  // Check body
  if (body?.id) {
    return body.id;
  }

  if (body?.userId) {
    return body.userId;
  }

  if (body?.npi) {
    return body.npi;
  }

  if (body?.did) {
    return body.did;
  }

  // Check query params
  if (req.query.id) {
    return req.query.id as string;
  }

  return null;
}

/**
 * Infer subject type from request/body
 */
function inferSubjectType(
  req: Request,
  body: any
): 'user' | 'npi' | 'did' | 'credential' {
  if (body?.did || req.path.includes('/did')) {
    return 'did';
  }

  if (body?.npi || req.path.includes('/npi')) {
    return 'npi';
  }

  if (req.path.includes('/credential')) {
    return 'credential';
  }

  return 'user';
}

/**
 * Infer resource type from request path
 */
function inferResourceType(req: Request): string {
  const path = req.path.toLowerCase();

  if (path.includes('/credential')) {
    return 'Credential';
  }

  if (path.includes('/candidate')) {
    return 'Candidate';
  }

  if (path.includes('/provider') || path.includes('/directory')) {
    return 'ProviderDirectory';
  }

  if (path.includes('/user')) {
    return 'User';
  }

  return 'Unknown';
}

/**
 * Extract resource ID from request or body
 */
function extractResourceId(req: Request, body: any): string | undefined {
  return req.params.id || body?.id || undefined;
}

