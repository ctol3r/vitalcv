/**
 * B225B-FIN-009: InvoiceGenerator
 * Creates invoices for marketplace purchases and recurring subscriptions
 * Includes line items, taxes, revenue share; sends via email and stores PDF
 */

import { PrismaClient } from '@prisma/client';
import { enqueueEmail } from '../../notifications/emailService';

const prisma = new PrismaClient();

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number; // in cents
  total: number; // in cents
  taxRate?: number; // e.g., 0.08 for 8%
}

export interface InvoiceData {
  invoiceNumber: string;
  orgId: string;
  orgName?: string;
  orgEmail?: string;
  issueDate: Date;
  dueDate: Date;
  lineItems: InvoiceLineItem[];
  subtotal: number; // in cents
  tax: number; // in cents
  total: number; // in cents
  revenueShare?: number; // in cents (for marketplace)
  currency: string;
  metadata?: Record<string, any>;
}

export interface InvoiceOptions {
  purchaseId?: string;
  subscriptionId?: string;
  orgId: string;
  lineItems: InvoiceLineItem[];
  taxRate?: number;
  dueDays?: number; // Days until due date
  sendEmail?: boolean;
}

/**
 * InvoiceGenerator service
 * Generates invoices for marketplace purchases and subscriptions
 */
export class InvoiceGenerator {
  /**
   * Generate invoice for a marketplace purchase
   */
  async generateInvoiceForPurchase(purchaseId: string): Promise<InvoiceData> {
    const purchase = await prisma.marketplacePurchase.findUnique({
      where: { id: purchaseId },
      include: {
        listing: true,
      },
    });

    if (!purchase) {
      throw new Error(`Purchase not found: ${purchaseId}`);
    }

    // Get organization info
    const org = await prisma.organization.findUnique({
      where: { id: purchase.orgId },
    });

    // Calculate line items
    const lineItems: InvoiceLineItem[] = [
      {
        description: `Marketplace Purchase: ${purchase.listing.productType}`,
        quantity: 1,
        unitPrice: purchase.amount,
        total: purchase.amount,
      },
    ];

    // Calculate revenue share if applicable
    const revenueShare = await this.calculateRevenueShare(purchase.orgId, purchase.amount);

    // Generate invoice
    const invoice = await this.generateInvoice({
      purchaseId,
      orgId: purchase.orgId,
      lineItems,
      taxRate: 0.08, // Default 8% tax (adjust based on region)
      dueDays: 30,
      sendEmail: true,
    });

    // Store invoice reference in purchase
    await prisma.marketplacePurchase.update({
      where: { id: purchaseId },
      data: {
        invoiceId: invoice.invoiceNumber,
      },
    });

    return invoice;
  }

  /**
   * Generate invoice for recurring subscription
   */
  async generateInvoiceForSubscription(
    subscriptionId: string,
    billingPeriod: { start: Date; end: Date }
  ): Promise<InvoiceData> {
    // This would integrate with subscription billing logic
    // For now, create a placeholder invoice
    const lineItems: InvoiceLineItem[] = [
      {
        description: `Subscription: ${billingPeriod.start.toISOString()} - ${billingPeriod.end.toISOString()}`,
        quantity: 1,
        unitPrice: 0, // Would come from subscription plan
        total: 0,
      },
    ];

    return this.generateInvoice({
      subscriptionId,
      orgId: '', // Would come from subscription
      lineItems,
      taxRate: 0.08,
      dueDays: 30,
      sendEmail: true,
    });
  }

  /**
   * Generate invoice
   */
  async generateInvoice(options: InvoiceOptions): Promise<InvoiceData> {
    const { orgId, lineItems, taxRate = 0.08, dueDays = 30 } = options;

    // Get organization info
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
    });

    // Calculate subtotal
    const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);

    // Calculate tax
    const tax = Math.round(subtotal * taxRate);

    // Calculate revenue share if applicable
    const revenueShare = await this.calculateRevenueShare(orgId, subtotal);

    // Calculate total
    const total = subtotal + tax;

    // Generate invoice number
    const invoiceNumber = this.generateInvoiceNumber();

    // Create invoice data
    const invoice: InvoiceData = {
      invoiceNumber,
      orgId,
      orgName: org?.name,
      issueDate: new Date(),
      dueDate: new Date(Date.now() + dueDays * 24 * 60 * 60 * 1000),
      lineItems,
      subtotal,
      tax,
      total,
      revenueShare,
      currency: 'USD',
      metadata: {
        purchaseId: options.purchaseId,
        subscriptionId: options.subscriptionId,
      },
    };

    // Generate PDF
    const pdfBuffer = await this.generatePDF(invoice);

    // Store invoice PDF (in production, store in S3 or similar)
    // For now, store reference in metadata
    await this.storeInvoice(invoice, pdfBuffer);

    // Send email if requested
    if (options.sendEmail) {
      await this.sendInvoiceEmail(invoice, pdfBuffer);
    }

    return invoice;
  }

  /**
   * Calculate revenue share for organization
   */
  private async calculateRevenueShare(orgId: string, amount: number): Promise<number> {
    const revenueShare = await prisma.orgRevenueShare.findUnique({
      where: { orgId },
    });

    if (!revenueShare) {
      return 0;
    }

    // Calculate based on basis points (0-10000 = 0% to 100%)
    const shareAmount = Math.round((amount * revenueShare.basisPoints) / 10000);

    // Apply min/max caps if applicable
    if (revenueShare.minGuarantee && shareAmount < revenueShare.minGuarantee) {
      return revenueShare.minGuarantee;
    }

    if (revenueShare.maxCap && shareAmount > revenueShare.maxCap) {
      return revenueShare.maxCap;
    }

    return shareAmount;
  }

  /**
   * Generate invoice number
   */
  private generateInvoiceNumber(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 6).toUpperCase();
    return `INV-${timestamp}-${random}`;
  }

  /**
   * Generate PDF invoice
   * Note: This is a simplified implementation. In production, use pdfkit or similar
   */
  private async generatePDF(invoice: InvoiceData): Promise<Buffer> {
    // Create a simple text-based invoice
    const lines: string[] = [];

    lines.push('='.repeat(60));
    lines.push('INVOICE');
    lines.push('='.repeat(60));
    lines.push('');
    lines.push(`Invoice Number: ${invoice.invoiceNumber}`);
    lines.push(`Issue Date: ${invoice.issueDate.toLocaleDateString()}`);
    lines.push(`Due Date: ${invoice.dueDate.toLocaleDateString()}`);
    lines.push('');
    lines.push(`Bill To: ${invoice.orgName || invoice.orgId}`);
    lines.push('');
    lines.push('-'.repeat(60));
    lines.push('Line Items:');
    lines.push('-'.repeat(60));

    invoice.lineItems.forEach((item, index) => {
      lines.push(`${index + 1}. ${item.description}`);
      lines.push(`   Quantity: ${item.quantity}`);
      lines.push(`   Unit Price: ${this.formatCurrency(item.unitPrice)}`);
      lines.push(`   Total: ${this.formatCurrency(item.total)}`);
      lines.push('');
    });

    lines.push('-'.repeat(60));
    lines.push(`Subtotal: ${this.formatCurrency(invoice.subtotal)}`);
    lines.push(`Tax (${((invoice.tax / invoice.subtotal) * 100).toFixed(2)}%): ${this.formatCurrency(invoice.tax)}`);

    if (invoice.revenueShare) {
      lines.push(`Revenue Share: ${this.formatCurrency(invoice.revenueShare)}`);
    }

    lines.push('-'.repeat(60));
    lines.push(`Total: ${this.formatCurrency(invoice.total)}`);
    lines.push('='.repeat(60));

    const content = lines.join('\n');
    return Buffer.from(content, 'utf-8');
  }

  /**
   * Store invoice
   */
  private async storeInvoice(invoice: InvoiceData, pdfBuffer: Buffer): Promise<void> {
    // In production, store PDF in S3 or similar storage
    // For now, store invoice metadata in a separate table or in existing tables
    // This is a placeholder - you'd create an Invoice model in Prisma schema

    // Store reference in BillingEvent if applicable
    if (invoice.metadata?.purchaseId) {
      await prisma.billingEvent.updateMany({
        where: {
          invoiceId: invoice.invoiceNumber,
        },
        data: {
          metadata: {
            invoice: {
              invoiceNumber: invoice.invoiceNumber,
              total: invoice.total,
              issueDate: invoice.issueDate.toISOString(),
              dueDate: invoice.dueDate.toISOString(),
              pdfSize: pdfBuffer.length,
            },
          },
        },
      });
    }
  }

  /**
   * Send invoice via email
   */
  private async sendInvoiceEmail(invoice: InvoiceData, pdfBuffer: Buffer): Promise<void> {
    // Get organization email
    const org = await prisma.organization.findUnique({
      where: { id: invoice.orgId },
    });

    if (!org) {
      throw new Error(`Organization not found: ${invoice.orgId}`);
    }

    // In production, get email from UserOrgLink or User table
    // For now, use a placeholder
    const email = invoice.orgEmail || 'billing@example.com';

    // Enqueue email with invoice PDF attachment
    await enqueueEmail(
      email,
      'invoice',
      {
        invoiceNumber: invoice.invoiceNumber,
        orgName: invoice.orgName,
        total: this.formatCurrency(invoice.total),
        dueDate: invoice.dueDate.toLocaleDateString(),
        pdfAttachment: pdfBuffer.toString('base64'), // In production, use proper attachment handling
      }
    );
  }

  /**
   * Format currency
   */
  private formatCurrency(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
  }

  /**
   * Get invoice by number
   */
  async getInvoice(invoiceNumber: string): Promise<InvoiceData | null> {
    // In production, query from Invoice table
    // For now, reconstruct from BillingEvent
    const billingEvent = await prisma.billingEvent.findFirst({
      where: {
        invoiceId: invoiceNumber,
      },
    });

    if (!billingEvent || !billingEvent.metadata) {
      return null;
    }

    const invoiceMeta = (billingEvent.metadata as any).invoice;
    if (!invoiceMeta) {
      return null;
    }

    // Reconstruct invoice data
    return {
      invoiceNumber: invoiceMeta.invoiceNumber,
      orgId: billingEvent.organizationId,
      issueDate: new Date(invoiceMeta.issueDate),
      dueDate: new Date(invoiceMeta.dueDate),
      lineItems: [], // Would need to store line items separately
      subtotal: invoiceMeta.total,
      tax: 0,
      total: invoiceMeta.total,
      currency: 'USD',
    };
  }
}

