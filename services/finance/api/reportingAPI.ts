/**
 * B225C-FIN-015: Financial Reporting API
 *
 * Exposes endpoints for organizations to retrieve their financial data programmatically.
 * Provides revenue, ledger entries, invoices, and payout status.
 * Enforces authentication and rate limits.
 */

import { PrismaClient } from '@prisma/client'
import { Request, Response } from 'express'
import { z } from 'zod'

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 60 * 1000 // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100 // 100 requests per minute per org

// In-memory rate limit store (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

/**
 * Rate limit middleware
 */
function rateLimitMiddleware(req: Request, res: Response, next: () => void) {
  const orgId = (req as any).orgId || req.headers['x-org-id']
  if (!orgId) {
    return res.status(401).json({ error: 'Organization ID required' })
  }

  const now = Date.now()
  const key = `rate_limit:${orgId}`
  const limit = rateLimitStore.get(key)

  if (!limit || now > limit.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return next()
  }

  if (limit.count >= RATE_LIMIT_MAX_REQUESTS) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: `Maximum ${RATE_LIMIT_MAX_REQUESTS} requests per minute`,
      retryAfter: Math.ceil((limit.resetAt - now) / 1000),
    })
  }

  limit.count++
  rateLimitStore.set(key, limit)
  next()
}

/**
 * Authentication middleware
 * In production, validate JWT token or API key
 */
function authMiddleware(req: Request, res: Response, next: () => void) {
  const apiKey = req.headers['x-api-key'] || req.headers.authorization?.replace('Bearer ', '')
  const orgId = req.headers['x-org-id'] as string

  if (!apiKey || !orgId) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  // In production, validate API key against database
  // For now, accept any non-empty key
  ;(req as any).orgId = orgId
  ;(req as any).apiKey = apiKey
  next()
}

/**
 * Validation schemas
 */
const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  orgId: z.string(),
})

const revenueQuerySchema = dateRangeSchema.extend({
  revenueType: z.enum(['VITA', 'FIAT']).optional(),
  status: z.enum(['pending', 'recognized', 'settled']).optional(),
})

const ledgerQuerySchema = dateRangeSchema.extend({
  type: z.enum(['credit', 'debit']).optional(),
  currency: z.string().optional(),
  limit: z.number().int().positive().max(1000).optional(),
  offset: z.number().int().nonnegative().optional(),
})

/**
 * Get revenue summary for an organization
 */
export async function getRevenueSummary(
  prisma: PrismaClient,
  orgId: string,
  options?: {
    startDate?: Date
    endDate?: Date
    revenueType?: 'VITA' | 'FIAT'
  }
) {
  const where: any = { orgId }
  if (options?.startDate || options?.endDate) {
    where.recognizedAt = {}
    if (options.startDate) where.recognizedAt.gte = options.startDate
    if (options.endDate) where.recognizedAt.lte = options.endDate
  }
  if (options?.revenueType) {
    where.revenueType = options.revenueType
  }

  const recognitions = await prisma.revenueRecognition.findMany({ where })

  const totalRevenue = recognitions.reduce((sum, r) => sum + r.amount, 0)
  const deferredRevenue = recognitions
    .filter((r) => r.status === 'pending')
    .reduce((sum, r) => sum + r.amount, 0)
  const recognizedRevenue = recognitions
    .filter((r) => r.status === 'recognized' || r.status === 'settled')
    .reduce((sum, r) => sum + r.amount, 0)

  return {
    totalRevenue,
    deferredRevenue,
    recognizedRevenue,
    currency: options?.revenueType === 'VITA' ? 'VITA' : 'USD',
    count: recognitions.length,
  }
}

/**
 * Get ledger entries for an organization
 */
export async function getLedgerEntries(
  prisma: PrismaClient,
  orgId: string,
  options?: {
    startDate?: Date
    endDate?: Date
    type?: 'credit' | 'debit'
    currency?: string
    limit?: number
    offset?: number
  }
) {
  const where: any = { orgId }
  if (options?.startDate || options?.endDate) {
    where.createdAt = {}
    if (options.startDate) where.createdAt.gte = options.startDate
    if (options.endDate) where.createdAt.lte = options.endDate
  }
  if (options?.type) {
    where.type = options.type
  }
  if (options?.currency) {
    where.currency = options.currency
  }

  const entries = await prisma.ledgerEntry.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: options?.limit || 100,
    skip: options?.offset || 0,
  })

  return entries
}

/**
 * Get revenue recognition entries
 */
export async function getRevenueRecognition(
  prisma: PrismaClient,
  orgId: string,
  options?: {
    startDate?: Date
    endDate?: Date
    revenueType?: 'VITA' | 'FIAT'
    status?: 'pending' | 'recognized' | 'settled'
  }
) {
  const where: any = { orgId }
  if (options?.startDate || options?.endDate) {
    where.recognizedAt = {}
    if (options.startDate) where.recognizedAt.gte = options.startDate
    if (options.endDate) where.recognizedAt.lte = options.endDate
  }
  if (options?.revenueType) {
    where.revenueType = options.revenueType
  }
  if (options?.status) {
    where.status = options.status
  }

  const entries = await prisma.revenueRecognition.findMany({
    where,
    orderBy: { recognizedAt: 'desc' },
  })

  return entries
}

/**
 * Express route handlers
 */
export function createFinanceReportingRoutes(prisma: PrismaClient) {
  return {
    /**
     * GET /api/finance/revenue
     * Get revenue summary
     */
    getRevenue: [
      authMiddleware,
      rateLimitMiddleware,
      async (req: Request, res: Response) => {
        try {
          const query = revenueQuerySchema.parse({
            orgId: (req as any).orgId,
            ...req.query,
          })

          const summary = await getRevenueSummary(prisma, query.orgId, {
            startDate: query.startDate ? new Date(query.startDate) : undefined,
            endDate: query.endDate ? new Date(query.endDate) : undefined,
            revenueType: query.revenueType,
          })

          res.json(summary)
        } catch (error: any) {
          if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid query parameters', details: error.errors })
          }
          res.status(500).json({ error: error.message })
        }
      },
    ],

    /**
     * GET /api/finance/ledger
     * Get ledger entries
     */
    getLedger: [
      authMiddleware,
      rateLimitMiddleware,
      async (req: Request, res: Response) => {
        try {
          const query = ledgerQuerySchema.parse({
            orgId: (req as any).orgId,
            ...req.query,
            limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
            offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
          })

          const entries = await getLedgerEntries(prisma, query.orgId, {
            startDate: query.startDate ? new Date(query.startDate) : undefined,
            endDate: query.endDate ? new Date(query.endDate) : undefined,
            type: query.type,
            currency: query.currency,
            limit: query.limit,
            offset: query.offset,
          })

          res.json({ entries, count: entries.length })
        } catch (error: any) {
          if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid query parameters', details: error.errors })
          }
          res.status(500).json({ error: error.message })
        }
      },
    ],

    /**
     * GET /api/finance/revenue-recognition
     * Get revenue recognition entries
     */
    getRevenueRecognition: [
      authMiddleware,
      rateLimitMiddleware,
      async (req: Request, res: Response) => {
        try {
          const query = revenueQuerySchema.parse({
            orgId: (req as any).orgId,
            ...req.query,
          })

          const entries = await getRevenueRecognition(prisma, query.orgId, {
            startDate: query.startDate ? new Date(query.startDate) : undefined,
            endDate: query.endDate ? new Date(query.endDate) : undefined,
            revenueType: query.revenueType,
            status: query.status,
          })

          res.json({ entries, count: entries.length })
        } catch (error: any) {
          if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid query parameters', details: error.errors })
          }
          res.status(500).json({ error: error.message })
        }
      },
    ],

    /**
     * GET /api/finance/payout-status
     * Get payout status (placeholder - payout model not in schema yet)
     */
    getPayoutStatus: [
      authMiddleware,
      rateLimitMiddleware,
      async (req: Request, res: Response) => {
        try {
          const orgId = (req as any).orgId
          // In production, query Payout table
          // For now, return empty array
          res.json({ payouts: [], count: 0 })
        } catch (error: any) {
          res.status(500).json({ error: error.message })
        }
      },
    ],
  }
}

/**
 * Register routes with Express app
 */
export function registerFinanceReportingRoutes(app: any, prisma: PrismaClient) {
  const routes = createFinanceReportingRoutes(prisma)

  app.get('/api/finance/revenue', ...routes.getRevenue)
  app.get('/api/finance/ledger', ...routes.getLedger)
  app.get('/api/finance/revenue-recognition', ...routes.getRevenueRecognition)
  app.get('/api/finance/payout-status', ...routes.getPayoutStatus)
}

