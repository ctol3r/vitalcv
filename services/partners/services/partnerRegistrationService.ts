/**
 * B248A-PARTNER-004: PartnerRegistrationService
 *
 * Handles new partner applications: validates data, creates PartnerProfile and default ContactPerson;
 * sets status to 'under_review'; emits event for review; includes unit tests and error handling
 */

import { PrismaClient, PartnerStatus } from '@prisma/client';
import { createPartnerProfile, PartnerProfileInput } from '../models/PartnerProfile.js';
import { createContactPerson, ContactPersonInput } from '../models/ContactPerson.js';
import { EventEmitter } from 'events';

// Partner domain events
export type PartnerDomainEvent =
  | { type: 'PARTNER_REGISTERED'; partnerId: string; name: string }
  | { type: 'PARTNER_STATUS_CHANGED'; partnerId: string; from: PartnerStatus; to: PartnerStatus }
  | { type: 'PARTNER_APPROVED'; partnerId: string }
  | { type: 'PARTNER_SUSPENDED'; partnerId: string };

// Event bus for partner events
export const partnerEventBus = new EventEmitter();

export function emitPartnerEvent(event: PartnerDomainEvent) {
  partnerEventBus.emit(event.type, event);
}

export interface PartnerRegistrationInput {
  profile: PartnerProfileInput;
  primaryContact: Omit<ContactPersonInput, 'partnerId'>;
}

export interface PartnerRegistrationResult {
  partnerId: string;
  contactPersonId: string;
  status: PartnerStatus;
}

export class PartnerRegistrationService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Register a new partner application
   */
  async registerPartner(input: PartnerRegistrationInput): Promise<PartnerRegistrationResult> {
    try {
      // Validate profile data
      const profileInput: PartnerProfileInput = {
        ...input.profile,
        status: PartnerStatus.under_review, // Set to under_review as per requirements
      };

      // Create partner profile
      const partner = await createPartnerProfile(this.prisma, profileInput);

      // Create default contact person
      const contactPerson = await createContactPerson(this.prisma, {
        ...input.primaryContact,
        partnerId: partner.id,
      });

      // Emit event for review
      emitPartnerEvent({
        type: 'PARTNER_REGISTERED',
        partnerId: partner.id,
        name: partner.name,
      });

      return {
        partnerId: partner.id,
        contactPersonId: contactPerson.id,
        status: partner.status,
      };
    } catch (error: any) {
      throw new Error(`Failed to register partner: ${error.message}`);
    }
  }

  /**
   * Get registration status
   */
  async getRegistrationStatus(partnerId: string): Promise<{
    status: PartnerStatus;
    createdAt: Date;
    contactPersonsCount: number;
  }> {
    const partner = await this.prisma.partnerProfile.findUnique({
      where: { id: partnerId },
      include: {
        contactPersons: true,
      },
    });

    if (!partner) {
      throw new Error(`Partner not found: ${partnerId}`);
    }

    return {
      status: partner.status,
      createdAt: partner.createdAt,
      contactPersonsCount: partner.contactPersons.length,
    };
  }
}

