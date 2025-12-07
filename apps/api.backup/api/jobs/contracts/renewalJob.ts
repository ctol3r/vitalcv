/**
 * B231A-CON-005: ContractRenewalJob
 *
 * Periodic job that identifies contracts nearing expiry; generates renewal offers;
 * notifies relevant stakeholders and updates status.
 */

import { PrismaClient } from '@prisma/client';
import {
  findContractsExpiringSoon,
  PartnerContract,
} from '../../services/contracts/models/PartnerContract.js';
import { renewContract } from '../../services/contracts/contractService.js';
import { createNotification } from '../../services/notifications/notificationService.js';
import { getServiceLogger } from '../../services/logging/serviceLogger.js';

const prisma = new PrismaClient();
const log = getServiceLogger('contracts/renewal-job');

export interface RenewalJobOptions {
  daysAhead?: number; // How many days ahead to check (default: 30, 60, 90)
  autoRenew?: boolean; // Whether to auto-renew contracts (default: false)
  dryRun?: boolean; // If true, don't actually renew, just log what would happen
}

export interface RenewalOffer {
  contractId: string;
  currentExpiryDate: Date;
  proposedEffectiveDate: Date;
  proposedExpiryDate: Date;
  renewalTerms?: Record<string, any>;
}

export interface RenewalJobResult {
  processedAt: Date;
  contractsChecked: number;
  contractsExpiringSoon: number;
  renewalOffersGenerated: number;
  contractsRenewed: number;
  notificationsSent: number;
  errors: Array<{ contractId: string; error: string }>;
  offers: RenewalOffer[];
}

/**
 * Run contract renewal job
 */
export async function runContractRenewalJob(
  options: RenewalJobOptions = {}
): Promise<RenewalJobResult> {
  const {
    daysAhead = 90, // Check contracts expiring in next 90 days
    autoRenew = false,
    dryRun = false,
  } = options;

  log.info('Starting contract renewal job', {
    daysAhead,
    autoRenew,
    dryRun,
  });

  const result: RenewalJobResult = {
    processedAt: new Date(),
    contractsChecked: 0,
    contractsExpiringSoon: 0,
    renewalOffersGenerated: 0,
    contractsRenewed: 0,
    notificationsSent: 0,
    errors: [],
    offers: [],
  };

  try {
    // Find contracts expiring soon
    const expiringContracts = await findContractsExpiringSoon(prisma, daysAhead);
    result.contractsChecked = expiringContracts.length;
    result.contractsExpiringSoon = expiringContracts.length;

    log.info('Found contracts expiring soon', {
      count: expiringContracts.length,
      daysAhead,
    });

    // Process each contract
    for (const contract of expiringContracts) {
      try {
        await processContractRenewal(contract, {
          autoRenew,
          dryRun,
          result,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log.error('Error processing contract renewal', {
          contractId: contract.id,
          error: errorMessage,
        });
        result.errors.push({
          contractId: contract.id,
          error: errorMessage,
        });
      }
    }

    log.info('Contract renewal job completed', {
      contractsChecked: result.contractsChecked,
      renewalOffersGenerated: result.renewalOffersGenerated,
      contractsRenewed: result.contractsRenewed,
      notificationsSent: result.notificationsSent,
      errors: result.errors.length,
    });

    return result;
  } catch (error) {
    log.error('Contract renewal job failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Process renewal for a single contract
 */
async function processContractRenewal(
  contract: PartnerContract,
  options: {
    autoRenew: boolean;
    dryRun: boolean;
    result: RenewalJobResult;
  }
): Promise<void> {
  const { autoRenew, dryRun, result } = options;

  if (!contract.expiryDate) {
    log.warn('Contract has no expiry date', { contractId: contract.id });
    return;
  }

  // Calculate renewal dates
  const daysUntilExpiry = Math.ceil(
    (contract.expiryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );

  // Generate renewal offer
  const renewalOffer = generateRenewalOffer(contract, daysUntilExpiry);
  result.offers.push(renewalOffer);
  result.renewalOffersGenerated++;

  log.info('Generated renewal offer', {
    contractId: contract.id,
    daysUntilExpiry,
    proposedEffectiveDate: renewalOffer.proposedEffectiveDate,
    proposedExpiryDate: renewalOffer.proposedExpiryDate,
  });

  // Send notification to stakeholders
  if (!dryRun) {
    await sendRenewalNotification(contract, renewalOffer);
    result.notificationsSent++;
  } else {
    log.info('Dry run: would send renewal notification', { contractId: contract.id });
  }

  // Auto-renew if enabled and contract expires soon (within 7 days)
  if (autoRenew && daysUntilExpiry <= 7) {
    if (!dryRun) {
      try {
        await renewContract({
          contractId: contract.id,
          newEffectiveDate: renewalOffer.proposedEffectiveDate,
          newExpiryDate: renewalOffer.proposedExpiryDate,
          updatedTerms: renewalOffer.renewalTerms,
        });
        result.contractsRenewed++;
        log.info('Contract auto-renewed', { contractId: contract.id });
      } catch (error) {
        log.error('Failed to auto-renew contract', {
          contractId: contract.id,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    } else {
      log.info('Dry run: would auto-renew contract', { contractId: contract.id });
    }
  }
}

/**
 * Generate renewal offer for a contract
 */
function generateRenewalOffer(
  contract: PartnerContract,
  daysUntilExpiry: number
): RenewalOffer {
  const currentExpiryDate = contract.expiryDate!;

  // Calculate new dates
  // Effective date: day after current expiry
  const proposedEffectiveDate = new Date(currentExpiryDate);
  proposedEffectiveDate.setDate(proposedEffectiveDate.getDate() + 1);

  // Expiry date: same duration as original contract, or default to 1 year
  const originalDuration = contract.effectiveDate && contract.expiryDate
    ? Math.ceil(
        (contract.expiryDate.getTime() - contract.effectiveDate.getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : 365; // Default to 1 year

  const proposedExpiryDate = new Date(proposedEffectiveDate);
  proposedExpiryDate.setDate(proposedExpiryDate.getDate() + originalDuration);

  // Prepare renewal terms (can be customized)
  const renewalTerms = {
    ...(contract.terms as any),
    renewalFrom: contract.id,
    renewalDate: new Date().toISOString(),
    originalContractStart: contract.effectiveDate?.toISOString(),
    originalContractEnd: contract.expiryDate?.toISOString(),
  };

  return {
    contractId: contract.id,
    currentExpiryDate,
    proposedEffectiveDate,
    proposedExpiryDate,
    renewalTerms,
  };
}

/**
 * Send renewal notification to stakeholders
 */
async function sendRenewalNotification(
  contract: PartnerContract,
  offer: RenewalOffer
): Promise<void> {
  const daysUntilExpiry = Math.ceil(
    (contract.expiryDate!.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );

  // Notify contract owner
  await createNotification(
    contract.orgId,
    'contract.renewal_offer',
    {
      contractId: contract.id,
      counterpartyId: contract.counterpartyId,
      daysUntilExpiry,
      currentExpiryDate: offer.currentExpiryDate.toISOString(),
      proposedEffectiveDate: offer.proposedEffectiveDate.toISOString(),
      proposedExpiryDate: offer.proposedExpiryDate.toISOString(),
      renewalTerms: offer.renewalTerms,
    }
  );

  // In a real implementation, you'd also notify users associated with the counterparty org
  log.info('Renewal notification sent', {
    contractId: contract.id,
    orgId: contract.orgId,
    counterpartyId: contract.counterpartyId,
    daysUntilExpiry,
  });
}

/**
 * Schedule contract renewal job (to be called by cron/scheduler)
 */
export async function scheduleContractRenewalJob(): Promise<void> {
  // This would typically be called by a cron scheduler
  // For example: run daily at 2 AM
  log.info('Scheduling contract renewal job');

  try {
    const result = await runContractRenewalJob({
      daysAhead: 90, // Check contracts expiring in next 90 days
      autoRenew: false, // Don't auto-renew by default
      dryRun: false,
    });

    log.info('Contract renewal job scheduled execution completed', {
      contractsChecked: result.contractsChecked,
      renewalOffersGenerated: result.renewalOffersGenerated,
      contractsRenewed: result.contractsRenewed,
      notificationsSent: result.notificationsSent,
    });
  } catch (error) {
    log.error('Scheduled contract renewal job failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

