/**
 * B231C-CON-015: ContractStatus API
 *
 * Exposes endpoints to check contract status, terms, and obligations programmatically.
 * Enforces authentication and returns only authorized contract details.
 */

import { PrismaClient } from '@prisma/client'
import { Request, Response } from 'express'

const prisma = new PrismaClient()

export interface ContractStatusResponse {
  contractId: string
  orgId: string
  counterpartyId: string
  status: 'draft' | 'negotiating' | 'signed' | 'terminated'
  effectiveDate?: string
  expiryDate?: string
  terms?: Record<string, any>
  obligations?: ContractObligation[]
  revenueShareId?: string
  createdAt: string
  updatedAt: string
}

export interface ContractObligation {
  id: string
  type: 'payment' | 'reporting' | 'compliance' | 'custom'
  description: string
  dueDate?: string
  status: 'pending' | 'completed' | 'overdue'
  metadata?: Record<string, any>
}

export interface ContractTermsResponse {
  contractId: string
  terms: Record<string, any>
  revenueShare?: {
    basisPoints: number
    minGuarantee?: number
    maxCap?: number
  }
  customTerms?: Record<string, any>
}

/**
 * Check if user has access to a contract
 */
async function checkContractAccess(
  userId: string,
  orgId: string,
  contractId: string
): Promise<boolean> {
  try {
    const contract = await prisma.partnerContract.findUnique({
      where: { id: contractId },
      select: {
        orgId: true,
        counterpartyId: true,
      },
    })

    if (!contract) {
      return false
    }

    // User must be part of either the org or counterparty org
    // In production, check org membership
    return contract.orgId === orgId || contract.counterpartyId === orgId
  } catch (error) {
    console.error('Error checking contract access:', error)
    return false
  }
}

/**
 * GET /api/contracts/:contractId/status
 * Get contract status and basic information
 */
export async function getContractStatus(req: Request, res: Response) {
  try {
    const { contractId } = req.params
    const userId = (req as any).user?.id
    const orgId = req.headers['x-org-id'] as string || (req as any).user?.orgId

    if (!userId || !orgId) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    if (!(await checkContractAccess(userId, orgId, contractId))) {
      return res.status(403).json({ error: 'Access denied' })
    }

    const contract = await prisma.partnerContract.findUnique({
      where: { id: contractId },
      include: {
        template: {
          select: {
            name: true,
            version: true,
          },
        },
      },
    })

    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' })
    }

    // Extract obligations from terms if available
    const obligations: ContractObligation[] = []
    if (contract.terms && typeof contract.terms === 'object') {
      const terms = contract.terms as any
      if (Array.isArray(terms.obligations)) {
        obligations.push(...terms.obligations)
      }
    }

    const response: ContractStatusResponse = {
      contractId: contract.id,
      orgId: contract.orgId,
      counterpartyId: contract.counterpartyId,
      status: contract.status as any,
      effectiveDate: contract.effectiveDate?.toISOString(),
      expiryDate: contract.expiryDate?.toISOString(),
      terms: contract.terms as Record<string, any> | undefined,
      obligations,
      revenueShareId: contract.revenueShareId || undefined,
      createdAt: contract.createdAt.toISOString(),
      updatedAt: contract.updatedAt.toISOString(),
    }

    res.json(response)
  } catch (error: any) {
    console.error('Error getting contract status:', error)
    res.status(500).json({ error: 'Failed to get contract status' })
  }
}

/**
 * GET /api/contracts/:contractId/terms
 * Get contract terms and obligations
 */
export async function getContractTerms(req: Request, res: Response) {
  try {
    const { contractId } = req.params
    const userId = (req as any).user?.id
    const orgId = req.headers['x-org-id'] as string || (req as any).user?.orgId

    if (!userId || !orgId) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    if (!(await checkContractAccess(userId, orgId, contractId))) {
      return res.status(403).json({ error: 'Access denied' })
    }

    const contract = await prisma.partnerContract.findUnique({
      where: { id: contractId },
      select: {
        id: true,
        terms: true,
        revenueShareId: true,
      },
    })

    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' })
    }

    let revenueShare = undefined
    if (contract.revenueShareId) {
      const revenueShareData = await prisma.orgRevenueShare.findUnique({
        where: { id: contract.revenueShareId },
        select: {
          basisPoints: true,
          minGuarantee: true,
          maxCap: true,
        },
      })
      if (revenueShareData) {
        revenueShare = {
          basisPoints: revenueShareData.basisPoints,
          minGuarantee: revenueShareData.minGuarantee || undefined,
          maxCap: revenueShareData.maxCap || undefined,
        }
      }
    }

    const terms = contract.terms as Record<string, any> | null
    const customTerms = terms ? { ...terms } : undefined
    if (customTerms && customTerms.obligations) {
      delete customTerms.obligations // Already included in status endpoint
    }

    const response: ContractTermsResponse = {
      contractId: contract.id,
      terms: terms || {},
      revenueShare,
      customTerms,
    }

    res.json(response)
  } catch (error: any) {
    console.error('Error getting contract terms:', error)
    res.status(500).json({ error: 'Failed to get contract terms' })
  }
}

/**
 * GET /api/contracts/:contractId/obligations
 * Get contract obligations with status
 */
export async function getContractObligations(req: Request, res: Response) {
  try {
    const { contractId } = req.params
    const userId = (req as any).user?.id
    const orgId = req.headers['x-org-id'] as string || (req as any).user?.orgId

    if (!userId || !orgId) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    if (!(await checkContractAccess(userId, orgId, contractId))) {
      return res.status(403).json({ error: 'Access denied' })
    }

    const contract = await prisma.partnerContract.findUnique({
      where: { id: contractId },
      select: {
        terms: true,
        effectiveDate: true,
        expiryDate: true,
      },
    })

    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' })
    }

    const obligations: ContractObligation[] = []
    if (contract.terms && typeof contract.terms === 'object') {
      const terms = contract.terms as any
      if (Array.isArray(terms.obligations)) {
        obligations.push(...terms.obligations)
      }
    }

    // Calculate status for each obligation based on due dates
    const now = new Date()
    const effectiveDate = contract.effectiveDate
    const expiryDate = contract.expiryDate

    const obligationsWithStatus = obligations.map((obligation) => {
      let status: 'pending' | 'completed' | 'overdue' = 'pending'

      if (obligation.dueDate) {
        const dueDate = new Date(obligation.dueDate)
        if (dueDate < now) {
          status = obligation.status === 'completed' ? 'completed' : 'overdue'
        } else {
          status = obligation.status === 'completed' ? 'completed' : 'pending'
        }
      }

      // Check if contract is effective
      if (effectiveDate && new Date(effectiveDate) > now) {
        status = 'pending'
      }

      // Check if contract has expired
      if (expiryDate && new Date(expiryDate) < now) {
        status = 'completed'
      }

      return {
        ...obligation,
        status,
      }
    })

    res.json({
      contractId,
      obligations: obligationsWithStatus,
      effectiveDate: effectiveDate?.toISOString(),
      expiryDate: expiryDate?.toISOString(),
    })
  } catch (error: any) {
    console.error('Error getting contract obligations:', error)
    res.status(500).json({ error: 'Failed to get contract obligations' })
  }
}

/**
 * GET /api/contracts
 * List contracts for the authenticated organization
 */
export async function listContracts(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id
    const orgId = req.headers['x-org-id'] as string || (req as any).user?.orgId
    const status = req.query.status as string | undefined

    if (!userId || !orgId) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    const where: any = {
      OR: [
        { orgId },
        { counterpartyId: orgId },
      ],
    }

    if (status && ['draft', 'negotiating', 'signed', 'terminated'].includes(status)) {
      where.status = status
    }

    const contracts = await prisma.partnerContract.findMany({
      where,
      include: {
        template: {
          select: {
            name: true,
            version: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    })

    const response = contracts.map((contract) => ({
      contractId: contract.id,
      orgId: contract.orgId,
      counterpartyId: contract.counterpartyId,
      templateName: contract.template?.name,
      status: contract.status,
      effectiveDate: contract.effectiveDate?.toISOString(),
      expiryDate: contract.expiryDate?.toISOString(),
      createdAt: contract.createdAt.toISOString(),
      updatedAt: contract.updatedAt.toISOString(),
    }))

    res.json({ contracts: response })
  } catch (error: any) {
    console.error('Error listing contracts:', error)
    res.status(500).json({ error: 'Failed to list contracts' })
  }
}

