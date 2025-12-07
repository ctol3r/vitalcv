/**
 * B223B-MARKET-008: SubscriptionManager
 *
 * Handles recurring subscriptions, seat counts, upgrades/downgrades, cancellations;
 * integrates with BillingGateway
 */

import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';
import { BillingGateway, SubscriptionRequest, SubscriptionResult } from '../billing/billingGateway.js';
import { createTransaction } from '../models/OrderTransaction.js';

export interface SubscriptionConfig {
  stripeSecretKey: string;
  stripeWebhookSecret: string;
}

export interface SubscriptionRecord {
  id: string;
  subscriptionId: string; // Stripe subscription ID
  moduleId: string;
  vendorId: string;
  purchaserId: string;
  status: string;
  seatCount: number;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  cancelledAt?: Date;
  metadata?: Record<string, any>;
}

export interface SubscriptionUpdateRequest {
  seatCount?: number;
  priceId?: string; // For upgrades/downgrades
  cancelAtPeriodEnd?: boolean;
}

/**
 * SubscriptionManager handles subscription lifecycle
 */
export class SubscriptionManager {
  private stripe: Stripe;
  private prisma: PrismaClient;
  private billingGateway: BillingGateway;

  constructor(prisma: PrismaClient, billingGateway: BillingGateway, config: SubscriptionConfig) {
    this.prisma = prisma;
    this.billingGateway = billingGateway;
    this.stripe = new Stripe(config.stripeSecretKey, {
      apiVersion: '2024-12-18.acacia',
    });
  }

  /**
   * Create a new subscription
   */
  async createSubscription(request: SubscriptionRequest): Promise<SubscriptionResult> {
    const result = await this.billingGateway.createSubscription(request);

    // Store subscription record in database
    // Note: In a real implementation, you'd have a Subscription model in Prisma
    // For now, we'll store it in metadata or a separate table
    await this.prisma.orderTransaction.updateMany({
      where: {
        transactionId: { contains: result.subscriptionId },
      },
      data: {
        metadata: {
          subscriptionId: result.subscriptionId,
          subscriptionStatus: result.status,
          currentPeriodEnd: result.currentPeriodEnd?.toISOString(),
        },
      },
    });

    return result;
  }

  /**
   * Update subscription (upgrade/downgrade seats or plan)
   */
  async updateSubscription(
    subscriptionId: string,
    updates: SubscriptionUpdateRequest
  ): Promise<Stripe.Subscription> {
    try {
      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);

      const updateParams: Stripe.SubscriptionUpdateParams = {};

      // Update seat count
      if (updates.seatCount !== undefined) {
        updateParams.items = [
          {
            id: subscription.items.data[0].id,
            quantity: updates.seatCount,
          },
        ];
      }

      // Update price (upgrade/downgrade)
      if (updates.priceId) {
        updateParams.items = [
          {
            id: subscription.items.data[0].id,
            price: updates.priceId,
          },
        ];
        updateParams.proration_behavior = 'always_invoice';
      }

      // Set cancellation at period end
      if (updates.cancelAtPeriodEnd !== undefined) {
        updateParams.cancel_at_period_end = updates.cancelAtPeriodEnd;
      }

      const updatedSubscription = await this.stripe.subscriptions.update(
        subscriptionId,
        updateParams
      );

      // Create transaction record for proration/adjustment
      if (updates.priceId || updates.seatCount !== undefined) {
        const latestInvoice = updatedSubscription.latest_invoice as Stripe.Invoice;
        if (latestInvoice?.payment_intent) {
          const paymentIntent = latestInvoice.payment_intent as Stripe.PaymentIntent;
          await createTransaction(this.prisma, {
            transactionId: paymentIntent.id,
            moduleId: subscription.metadata.moduleId || '',
            vendorId: subscription.metadata.vendorId || '',
            purchaserId: subscription.metadata.purchaserId || '',
            amount: paymentIntent.amount,
            currency: paymentIntent.currency,
            status: paymentIntent.status === 'succeeded' ? 'completed' : 'pending',
            metadata: {
              subscriptionId: subscription.id,
              updateType: updates.priceId ? 'upgrade' : 'seat_change',
              ...subscription.metadata,
            },
          });
        }
      }

      return updatedSubscription;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to update subscription: ${errorMessage}`);
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(
    subscriptionId: string,
    cancelImmediately: boolean = false
  ): Promise<Stripe.Subscription> {
    try {
      if (cancelImmediately) {
        // Cancel immediately
        const subscription = await this.stripe.subscriptions.cancel(subscriptionId);
        return subscription;
      } else {
        // Cancel at period end
        const subscription = await this.stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: true,
        });
        return subscription;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to cancel subscription: ${errorMessage}`);
    }
  }

  /**
   * Resume a cancelled subscription
   */
  async resumeSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    try {
      const subscription = await this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: false,
      });
      return subscription;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to resume subscription: ${errorMessage}`);
    }
  }

  /**
   * Get subscription details
   */
  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    try {
      return await this.stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['latest_invoice', 'customer'],
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get subscription: ${errorMessage}`);
    }
  }

  /**
   * List subscriptions for a purchaser
   */
  async listSubscriptions(purchaserId: string): Promise<Stripe.Subscription[]> {
    try {
      // Find Stripe customer ID from transactions
      const transactions = await this.prisma.orderTransaction.findMany({
        where: {
          purchaserId,
          metadata: {
            path: ['stripeCustomerId'],
            not: null,
          },
        },
        take: 1,
      });

      if (transactions.length === 0) {
        return [];
      }

      const customerId = transactions[0].metadata?.stripeCustomerId as string;
      if (!customerId) {
        return [];
      }

      const subscriptions = await this.stripe.subscriptions.list({
        customer: customerId,
        status: 'all',
      });

      return subscriptions.data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to list subscriptions: ${errorMessage}`);
    }
  }

  /**
   * Handle subscription webhook events
   */
  async handleSubscriptionWebhook(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'customer.subscription.created':
        await this.handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      default:
        console.log(`Unhandled subscription event: ${event.type}`);
    }
  }

  private async handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
    // Store subscription metadata
    console.log(`Subscription created: ${subscription.id}`);
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    // Update subscription metadata
    console.log(`Subscription updated: ${subscription.id}`);
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    // Mark subscription as cancelled
    console.log(`Subscription deleted: ${subscription.id}`);
  }
}

