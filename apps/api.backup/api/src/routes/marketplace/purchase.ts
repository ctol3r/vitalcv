/**
 * S72-STRETCH-E-006: API: Purchase marketplace listing with VITA or fiat
 *
 * POST /marketplace/purchase debits VITA or creates invoice; records purchase; emits billing event
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { getListing } from '../../../../services/marketplace/models/Listing';
import { billingEvents } from '../../../../services/billing/events';
import { generateRevenueSchedule } from '../../../../services/billing/revenueSchedule';
import { checkFeatureFlag, getFeatureFlagService } from '../../../../services/flags/featureFlags';
import { requireVITAEnabled, debitVITA } from '../../../../services/flags/wireVita';

const router = Router();
const prisma = new PrismaClient();

// Purchase request schema
const PurchaseRequestSchema = z.object({
  listingId: z.string(),
  orgId: z.string(), // Purchasing organization
  paymentType: z.enum(['VITA', 'FIAT']),
  vitaTxId: z.string().optional(), // Required if paymentType is VITA
});

/**
 * POST /marketplace/purchase
 * Purchase a marketplace listing
 */
router.post('/purchase', async (req: Request, res: Response) => {
  try {
    const body = PurchaseRequestSchema.parse(req.body);

    // B149B-FF-014: Check if VITA features are enabled when using VITA payment
    if (body.paymentType === 'VITA') {
      try {
        await requireVITAEnabled(prisma, body.orgId);
      } catch (error: any) {
        if (error.name === 'VITANotImplementedError') {
          return res.status(501).json({
            error: 'NOT_IMPLEMENTED',
            message: error.message || 'VITA billing features are not currently implemented. Please use FIAT payment or contact support for more information.',
          });
        }
        throw error;
      }

      if (!body.vitaTxId) {
        return res.status(400).json({
          error: 'validation_error',
          message: 'vitaTxId is required when paymentType is VITA',
        });
      }
    }

    // Get listing
    const listing = await getListing(prisma, body.listingId);
    if (!listing) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Listing not found',
      });
    }

    if (!listing.isActive) {
      return res.status(400).json({
        error: 'invalid_state',
        message: 'Listing is not active',
      });
    }

    // Determine price based on payment type
    let amount: number;
    let invoiceId: string | undefined;

    if (body.paymentType === 'VITA') {
      if (!listing.vitaPrice) {
        return res.status(400).json({
          error: 'invalid_payment',
          message: 'Listing does not support VITA payment',
        });
      }
      amount = listing.vitaPrice;

      // B149B-FF-014: Debit VITA tokens using wireVita service
      try {
        const txId = await debitVITA(
          prisma,
          body.orgId,
          amount,
          `marketplace_purchase_${body.listingId}`,
          { purchaseId: body.listingId, listingId: body.listingId }
        );
        // Use the generated transaction ID if not provided
        if (!body.vitaTxId) {
          body.vitaTxId = txId;
        }
      } catch (error: any) {
        if (error.name === 'VITANotImplementedError') {
          return res.status(501).json({
            error: 'NOT_IMPLEMENTED',
            message: error.message,
          });
        }
        throw error;
      }
    } else {
      // FIAT payment
      if (!listing.fiatPrice) {
        return res.status(400).json({
          error: 'invalid_payment',
          message: 'Listing does not support fiat payment',
        });
      }
      amount = listing.fiatPrice;

      // TODO: Create invoice via billing system
      // For now, generate a placeholder invoice ID
      invoiceId = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    // Record purchase
    const purchase = await prisma.marketplacePurchase.create({
      data: {
        listingId: body.listingId,
        orgId: body.orgId,
        paymentType: body.paymentType,
        amount,
        vitaTxId: body.paymentType === 'VITA' ? body.vitaTxId : null,
        invoiceId: body.paymentType === 'FIAT' ? invoiceId : null,
        status: 'completed',
        metadata: {
          listingProductType: listing.productType,
        },
      },
    });

    // Record VITA ledger entry if VITA payment
    if (body.paymentType === 'VITA' && body.vitaTxId) {
      await prisma.vitaLedger.create({
        data: {
          orgId: body.orgId,
          amount: -amount, // Negative for debit
          type: 'purchase',
          txId: body.vitaTxId,
          reference: purchase.id,
          metadata: {
            listingId: body.listingId,
            productType: listing.productType,
          },
        },
      });
    }

    // Create revenue recognition entry
    await generateRevenueSchedule(
      prisma,
      purchase.id,
      'marketplacePurchase',
      listing.orgId, // Revenue goes to listing org
      body.paymentType,
      body.paymentType === 'FIAT' ? amount : amount, // Amount in cents for fiat, tokens for VITA
      {
        purchaseId: purchase.id,
        listingId: body.listingId,
        productType: listing.productType,
      }
    );

    // Emit billing event
    billingEvents.emitApplicationCreated({
      eventType: 'applicationCreated',
      timestamp: new Date(),
      organizationId: listing.orgId,
      partnerId: listing.orgId,
      jobId: undefined,
      applicationId: purchase.id,
      candidateId: body.orgId,
      applicantDid: body.orgId,
      evidenceIds: [],
      metadata: {
        purchaseType: 'marketplace',
        listingId: body.listingId,
        productType: listing.productType,
        paymentType: body.paymentType,
        amount,
      },
    });

    return res.json({
      purchase: {
        id: purchase.id,
        listingId: purchase.listingId,
        orgId: purchase.orgId,
        paymentType: purchase.paymentType,
        amount: purchase.amount,
        status: purchase.status,
        vitaTxId: purchase.vitaTxId,
        invoiceId: purchase.invoiceId,
        createdAt: purchase.createdAt,
      },
    });
  } catch (error: any) {
    console.error('[marketplace/purchase] Error:', error);

    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid request body',
        details: error.errors,
      });
    }

    return res.status(500).json({
      error: 'internal_error',
      message: 'Failed to process purchase',
    });
  }
});

export default router;

