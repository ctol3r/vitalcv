import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import {
  CreateFHIRSubscriptionSchema,
  serializeFHIRSubscription,
} from '../../../../../services/fhir/subscriptions/models/FHIRSubscription';

const prisma = new PrismaClient();
const router = Router();

router.post('/register', async (req: Request, res: Response) => {
  try {
    const payload = CreateFHIRSubscriptionSchema.parse(req.body);

    const subscription = await prisma.fHIRSubscription.create({
      data: {
        resourceType: payload.resourceType,
        criteria: payload.criteria,
        callbackUrl: payload.callbackUrl,
      },
    });

    return res.status(201).json({
      success: true,
      subscriptionId: subscription.id,
      subscription: serializeFHIRSubscription(subscription),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }

    console.error('[POST /fhir/subscriptions/register] Failed to create subscription', error);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
    });
  }
});

export default router;
