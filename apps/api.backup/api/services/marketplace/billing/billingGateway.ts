/**
 * B223B-MARKET-006: BillingGateway Integration
 *
 * Integrates with payment processor (e.g. Stripe) to process purchases and subscriptions;
 * handles callbacks and stores receipts
 */

import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';
import { createTransaction, updateTransactionStatus, getTransaction } from '../models/OrderTransaction.js';

export interface BillingGatewayConfig {
  stripeSecretKey: string;
  stripeWebhookSecret: string;
  webhookEndpoint?: string;
}

export interface PurchaseRequest {
  moduleId: string;
  vendorId: string;
  purchaserId: string;
  amount: number; // in cents
  currency: string;
  paymentMethodId?: string; // Stripe payment method ID
  customerId?: string; // Stripe customer ID
  metadata?: Record<string, string>;
}

export interface SubscriptionRequest {
  moduleId: string;
  vendorId: string;
  purchaserId: string;
  priceId: string; // Stripe price ID
  seatCount?: number;
  metadata?: Record<string, string>;
}

export interface PaymentIntentResult {
  transactionId: string;
  clientSecret?: string;
  status: string;
  receiptUrl?: string;
}

export interface SubscriptionResult {
  subscriptionId: string;
  status: string;
  currentPeriodEnd?: Date;
}

/**
 * BillingGateway handles payment processing via Stripe
 */
export class BillingGateway {
  private stripe: Stripe;
  private prisma: PrismaClient;
  private webhookSecret: string;

  constructor(prisma: PrismaClient, config: BillingGatewayConfig) {
    this.prisma = prisma;
    this.stripe = new Stripe(config.stripeSecretKey, {
      apiVersion: '2024-12-18.acacia',
    });
    this.webhookSecret = config.stripeWebhookSecret;
  }

  /**
   * Process a one-time purchase
   */
  async processPurchase(request: PurchaseRequest): Promise<PaymentIntentResult> {
    try {
      // Create or retrieve Stripe customer
      let customerId = request.customerId;
      if (!customerId) {
        const customer = await this.stripe.customers.create({
          metadata: {
            purchaserId: request.purchaserId,
            vendorId: request.vendorId,
          },
        });
        customerId = customer.id;
      }

      // Create payment intent
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: request.amount,
        currency: request.currency.toLowerCase(),
        customer: customerId,
        payment_method: request.paymentMethodId,
        confirm: request.paymentMethodId ? true : false,
        metadata: {
          moduleId: request.moduleId,
          vendorId: request.vendorId,
          purchaserId: request.purchaserId,
          ...request.metadata,
        },
        automatic_payment_methods: request.paymentMethodId
          ? undefined
          : {
              enabled: true,
            },
      });

      // Create transaction record
      const transaction = await createTransaction(this.prisma, {
        transactionId: paymentIntent.id,
        moduleId: request.moduleId,
        vendorId: request.vendorId,
        purchaserId: request.purchaserId,
        amount: request.amount,
        currency: request.currency,
        status: paymentIntent.status === 'succeeded' ? 'completed' : 'pending',
        metadata: {
          stripePaymentIntentId: paymentIntent.id,
          stripeCustomerId: customerId,
          ...request.metadata,
        },
      });

      return {
        transactionId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret || undefined,
        status: paymentIntent.status,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to process purchase: ${errorMessage}`);
    }
  }

  /**
   * Create a subscription
   */
  async createSubscription(request: SubscriptionRequest): Promise<SubscriptionResult> {
    try {
      // Create or retrieve Stripe customer
      const customer = await this.stripe.customers.create({
        metadata: {
          purchaserId: request.purchaserId,
          vendorId: request.vendorId,
        },
      });

      // Create subscription
      const subscription = await this.stripe.subscriptions.create({
        customer: customer.id,
        items: [
          {
            price: request.priceId,
            quantity: request.seatCount || 1,
          },
        ],
        metadata: {
          moduleId: request.moduleId,
          vendorId: request.vendorId,
          purchaserId: request.purchaserId,
          ...request.metadata,
        },
        expand: ['latest_invoice.payment_intent'],
      });

      // Create transaction record for initial payment
      const invoice = subscription.latest_invoice as Stripe.Invoice;
      if (invoice?.payment_intent) {
        const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent;
        await createTransaction(this.prisma, {
          transactionId: paymentIntent.id,
          moduleId: request.moduleId,
          vendorId: request.vendorId,
          purchaserId: request.purchaserId,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          status: paymentIntent.status === 'succeeded' ? 'completed' : 'pending',
          metadata: {
            stripeSubscriptionId: subscription.id,
            stripeCustomerId: customer.id,
            subscriptionType: 'recurring',
            ...request.metadata,
          },
        });
      }

      return {
        subscriptionId: subscription.id,
        status: subscription.status,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to create subscription: ${errorMessage}`);
    }
  }

  /**
   * Handle Stripe webhook events
   */
  async handleWebhook(signature: string, body: string | Buffer): Promise<void> {
    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(body, signature, this.webhookSecret);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Webhook signature verification failed: ${errorMessage}`);
    }

    // Handle different event types
    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;

      case 'payment_intent.payment_failed':
        await this.handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      case 'invoice.paid':
        await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  }

  /**
   * Handle successful payment intent
   */
  private async handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const transaction = await getTransaction(this.prisma, paymentIntent.id);
    if (transaction) {
      // Get receipt URL from charge
      let receiptUrl: string | undefined;
      if (paymentIntent.charges?.data && paymentIntent.charges.data.length > 0) {
        const charge = paymentIntent.charges.data[0];
        receiptUrl = charge.receipt_url || undefined;
      }

      await updateTransactionStatus(
        this.prisma,
        paymentIntent.id,
        'completed',
        receiptUrl
      );
    }
  }

  /**
   * Handle failed payment intent
   */
  private async handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const transaction = await getTransaction(this.prisma, paymentIntent.id);
    if (transaction) {
      await updateTransactionStatus(this.prisma, paymentIntent.id, 'failed');
    }
  }

  /**
   * Handle paid invoice (subscription payment)
   */
  private async handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    const paymentIntentId = typeof invoice.payment_intent === 'string'
      ? invoice.payment_intent
      : invoice.payment_intent?.id;

    if (paymentIntentId) {
      const transaction = await getTransaction(this.prisma, paymentIntentId);
      if (transaction) {
        // Get receipt URL
        const receiptUrl = invoice.hosted_invoice_url || undefined;
        await updateTransactionStatus(
          this.prisma,
          paymentIntentId,
          'completed',
          receiptUrl
        );
      }
    }
  }

  /**
   * Handle failed invoice payment
   */
  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const paymentIntentId = typeof invoice.payment_intent === 'string'
      ? invoice.payment_intent
      : invoice.payment_intent?.id;

    if (paymentIntentId) {
      const transaction = await getTransaction(this.prisma, paymentIntentId);
      if (transaction) {
        await updateTransactionStatus(this.prisma, paymentIntentId, 'failed');
      }
    }
  }

  /**
   * Handle subscription deletion
   */
  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    // This will be handled by SubscriptionManager
    console.log(`Subscription deleted: ${subscription.id}`);
  }

  /**
   * Process refund
   */
  async processRefund(transactionId: string, amount?: number): Promise<string> {
    try {
      const transaction = await getTransaction(this.prisma, transactionId);
      if (!transaction) {
        throw new Error(`Transaction not found: ${transactionId}`);
      }

      if (transaction.status !== 'completed') {
        throw new Error(`Cannot refund transaction with status: ${transaction.status}`);
      }

      // Create refund in Stripe
      const refund = await this.stripe.refunds.create({
        payment_intent: transactionId,
        amount: amount || transaction.amount,
      });

      // Update transaction status
      await updateTransactionStatus(this.prisma, transactionId, 'refunded');

      return refund.id;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to process refund: ${errorMessage}`);
    }
  }
}

