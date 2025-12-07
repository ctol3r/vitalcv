const log = getServiceLogger('billing/events');
/**
 * Billing Events for Partner Monetization
 *
 * This module defines and emits billing events for partner job postings
 * and successful hires via the Apply-with-VitalCV flow.
 *
 * Events are consumed by the billing pipeline for partner invoicing.
 */

import { EventEmitter } from 'events';
import { getServiceLogger } from '../logging/serviceLogger';

export interface BillingEvent {
  eventType: 'jobPostCreated' | 'applyWithVC' | 'applicationCreated' | 'hireConfirmed';
  timestamp: Date;
  organizationId: string;
  partnerId: string;
  jobId?: string;
  applicationId?: string;
  metadata?: Record<string, any>;
}

export interface JobPostCreatedEvent extends BillingEvent {
  eventType: 'jobPostCreated';
  jobId: string;
  jobTitle: string;
  jobCategory?: string;
  postedBy: string;
}

export interface ApplyWithVCEvent extends BillingEvent {
  eventType: 'applyWithVC';
  jobId: string;
  applicationId: string;
  candidateId: string;
  vcCredentialId: string;
  applicationStatus: 'submitted' | 'hired' | 'rejected';
}

export interface ApplicationCreatedEvent extends BillingEvent {
  eventType: 'applicationCreated';
  jobId: string;
  applicationId: string;
  candidateId: string;
  applicantDid: string;
  evidenceIds: string[];
}

export interface HireConfirmedEvent extends BillingEvent {
  eventType: 'hireConfirmed';
  jobId: string;
  applicationId: string;
  candidateId: string;
  hireDate: Date;
  estimatedSalary?: number;
}

class BillingEventEmitter extends EventEmitter {
  private static instance: BillingEventEmitter;

  private constructor() {
    super();
  }

  public static getInstance(): BillingEventEmitter {
    if (!BillingEventEmitter.instance) {
      BillingEventEmitter.instance = new BillingEventEmitter();
    }
    return BillingEventEmitter.instance;
  }

  /**
   * Emit a job post created event for partner billing
   */
  public emitJobPostCreated(event: JobPostCreatedEvent): void {
    this.emit('billing:jobPostCreated', {
      ...event,
      timestamp: new Date(),
    });
    log.info(`[Billing Event] jobPostCreated - Partner: ${event.partnerId}, Job: ${event.jobId}`);
  }

  /**
   * Emit an apply with VC event for partner billing
   */
  public emitApplyWithVC(event: ApplyWithVCEvent): void {
    this.emit('billing:applyWithVC', {
      ...event,
      timestamp: new Date(),
    });
    log.info(`[Billing Event] applyWithVC - Partner: ${event.partnerId}, Job: ${event.jobId}, App: ${event.applicationId}, Status: ${event.applicationStatus}`);
  }

  /**
   * Register a consumer for billing events
   */
  public onJobPostCreated(handler: (event: JobPostCreatedEvent) => void | Promise<void>): void {
    this.on('billing:jobPostCreated', handler);
  }

  /**
   * Register a consumer for apply with VC events
   */
  public onApplyWithVC(handler: (event: ApplyWithVCEvent) => void | Promise<void>): void {
    this.on('billing:applyWithVC', handler);
  }

  /**
   * Emit an application created event for billing
   */
  public emitApplicationCreated(event: ApplicationCreatedEvent): void {
    this.emit('billing:applicationCreated', {
      ...event,
      timestamp: new Date(),
    });
    log.info(`[Billing Event] applicationCreated - Org: ${event.organizationId}, Job: ${event.jobId}, App: ${event.applicationId}`);
  }

  /**
   * Emit a hire confirmed event for billing
   */
  public emitHireConfirmed(event: HireConfirmedEvent): void {
    this.emit('billing:hireConfirmed', {
      ...event,
      timestamp: new Date(),
    });
    log.info(`[Billing Event] hireConfirmed - Org: ${event.organizationId}, Job: ${event.jobId}, App: ${event.applicationId}, Date: ${event.hireDate}`);
  }

  /**
   * Register a consumer for application created events
   */
  public onApplicationCreated(handler: (event: ApplicationCreatedEvent) => void | Promise<void>): void {
    this.on('billing:applicationCreated', handler);
  }

  /**
   * Register a consumer for hire confirmed events
   */
  public onHireConfirmed(handler: (event: HireConfirmedEvent) => void | Promise<void>): void {
    this.on('billing:hireConfirmed', handler);
  }
}

// Export singleton instance
export const billingEvents = BillingEventEmitter.getInstance();

/**
 * Helper function to emit job post created event
 */
export function emitJobPostCreated(
  organizationId: string,
  partnerId: string,
  jobId: string,
  jobTitle: string,
  postedBy: string,
  metadata?: { jobCategory?: string; [key: string]: any }
): void {
  billingEvents.emitJobPostCreated({
    eventType: 'jobPostCreated',
    timestamp: new Date(),
    organizationId,
    partnerId,
    jobId,
    jobTitle,
    jobCategory: metadata?.jobCategory,
    postedBy,
    metadata,
  });
}

/**
 * Helper function to emit apply with VC event
 */
export function emitApplyWithVC(
  organizationId: string,
  partnerId: string,
  jobId: string,
  applicationId: string,
  candidateId: string,
  vcCredentialId: string,
  applicationStatus: 'submitted' | 'hired' | 'rejected',
  metadata?: Record<string, any>
): void {
  billingEvents.emitApplyWithVC({
    eventType: 'applyWithVC',
    timestamp: new Date(),
    organizationId,
    partnerId,
    jobId,
    applicationId,
    candidateId,
    vcCredentialId,
    applicationStatus,
    metadata,
  });
}

/**
 * Helper function to emit application created event
 */
export function emitApplicationCreated(
  organizationId: string,
  partnerId: string,
  jobId: string,
  applicationId: string,
  candidateId: string,
  applicantDid: string,
  evidenceIds: string[],
  metadata?: Record<string, any>
): void {
  billingEvents.emitApplicationCreated({
    eventType: 'applicationCreated',
    timestamp: new Date(),
    organizationId,
    partnerId,
    jobId,
    applicationId,
    candidateId,
    applicantDid,
    evidenceIds,
    metadata,
  });
}

/**
 * Helper function to emit hire confirmed event
 */
export function emitHireConfirmed(
  organizationId: string,
  partnerId: string,
  jobId: string,
  applicationId: string,
  candidateId: string,
  hireDate: Date,
  estimatedSalary?: number,
  metadata?: Record<string, any>
): void {
  billingEvents.emitHireConfirmed({
    eventType: 'hireConfirmed',
    timestamp: new Date(),
    organizationId,
    partnerId,
    jobId,
    applicationId,
    candidateId,
    hireDate,
    estimatedSalary,
    metadata,
  });
}

/**
 * Billing pipeline consumer - processes events and records them to database
 * This is consumed by the billing worker for invoice generation
 */
export function initializeBillingPipeline(): void {
  billingEvents.onJobPostCreated(async (event) => {
    // Record event in billing database
    // Queue for invoice generation
    // Track usage for partner dashboard
    log.info(`[Billing Pipeline] Processing job post: ${event.jobId} for org ${event.organizationId}`);

    // TODO: Insert into BillingEvent table
    // await prisma.billingEvent.create({
    //   data: {
    //     eventType: 'jobPostCreated',
    //     organizationId: event.organizationId,
    //     partnerId: event.partnerId,
    //     jobId: event.jobId,
    //     metadata: event.metadata,
    //   }
    // });
  });

  billingEvents.onApplyWithVC(async (event) => {
    // Track application submissions
    // Trigger billing on successful hire
    // Update partner metrics
    log.info(`[Billing Pipeline] Processing application: ${event.applicationId} for org ${event.organizationId}`);

    // TODO: Insert into BillingEvent table if hired
    // if (event.applicationStatus === 'hired') {
    //   await prisma.billingEvent.create({
    //     data: {
    //       eventType: 'hireConfirmed',
    //       organizationId: event.organizationId,
    //       partnerId: event.partnerId,
    //       jobId: event.jobId,
    //       applicationId: event.applicationId,
    //       metadata: event.metadata,
    //     }
    //   });
    // }
  });

  billingEvents.onApplicationCreated(async (event) => {
    // Record application creation for billing
    log.info(`[Billing Pipeline] Processing application created: ${event.applicationId} for org ${event.organizationId}`);

    // TODO: Insert into BillingEvent table
    // await prisma.billingEvent.create({
    //   data: {
    //     eventType: 'applicationCreated',
    //     organizationId: event.organizationId,
    //     partnerId: event.partnerId,
    //     jobId: event.jobId,
    //     applicationId: event.applicationId,
    //     metadata: {
    //       candidateId: event.candidateId,
    //       applicantDid: event.applicantDid,
    //       evidenceIds: event.evidenceIds,
    //       ...event.metadata,
    //     },
    //   }
    // });
  });

  billingEvents.onHireConfirmed(async (event) => {
    // Record hire confirmation for billing
    // This is the primary revenue event for successful-hire pricing
    log.info(`[Billing Pipeline] Processing hire confirmed: ${event.applicationId} for org ${event.organizationId}`);

    // TODO: Insert into BillingEvent table with calculated amount
    // const pricing = await getOrganizationPricing(event.organizationId);
    // const amount = calculateSuccessfulHirePrice(pricing, event.estimatedSalary);
    //
    // await prisma.billingEvent.create({
    //   data: {
    //     eventType: 'hireConfirmed',
    //     organizationId: event.organizationId,
    //     partnerId: event.partnerId,
    //     jobId: event.jobId,
    //     applicationId: event.applicationId,
    //     amount,
    //     metadata: {
    //       candidateId: event.candidateId,
    //       hireDate: event.hireDate,
    //       estimatedSalary: event.estimatedSalary,
    //       ...event.metadata,
    //     },
    //   }
    // });
  });
}

