/**
 * B231A-CON-003: ContractService
 *
 * Manages contract lifecycle: create from template, save draft, propose revisions,
 * sign via e-signature API, cancel or renew; sends notifications on status changes.
 */

import { PrismaClient } from '@prisma/client';
import {
  PartnerContract,
  PartnerContractInput,
  ContractStatus,
  createPartnerContract,
  getPartnerContract,
  updateContractStatus,
  updatePartnerContract,
  setSignedPdfUrl,
  recordSignatureEvents,
} from './models/PartnerContract.js';
import {
  ContractTemplate,
  ContractTemplateInput,
  getContractTemplate,
  renderTemplate,
} from './models/ContractTemplate.js';
import { createNotification } from '../notifications/notificationService.js';
import { getServiceLogger } from '../logging/serviceLogger.js';

const prisma = new PrismaClient();
const log = getServiceLogger('contracts/service');

export interface CreateContractFromTemplateInput {
  orgId: string;
  counterpartyId: string;
  templateId: string;
  variables?: Record<string, string>; // Variables for template placeholders
  effectiveDate?: Date;
  expiryDate?: Date;
  terms?: Record<string, any>;
  revenueShareId?: string;
  metadata?: Record<string, any>;
}

export interface ProposeRevisionInput {
  contractId: string;
  proposedTerms: Record<string, any>;
  proposedEffectiveDate?: Date;
  proposedExpiryDate?: Date;
  revisionNotes?: string;
}

export interface RenewContractInput {
  contractId: string;
  newEffectiveDate: Date;
  newExpiryDate: Date;
  updatedTerms?: Record<string, any>;
}

/**
 * Create a contract from a template
 */
export async function createContractFromTemplate(
  input: CreateContractFromTemplateInput
): Promise<PartnerContract> {
  log.info('Creating contract from template', {
    orgId: input.orgId,
    counterpartyId: input.counterpartyId,
    templateId: input.templateId,
  });

  // Get template
  const template = await getContractTemplate(prisma, input.templateId);
  if (!template) {
    throw new Error(`Template ${input.templateId} not found`);
  }

  // Render template with variables
  const renderedContent = renderTemplate(template, input.variables || {});

  // Create contract
  const contract = await createPartnerContract(prisma, {
    orgId: input.orgId,
    counterpartyId: input.counterpartyId,
    templateId: input.templateId,
    status: 'draft',
    effectiveDate: input.effectiveDate,
    expiryDate: input.expiryDate,
    terms: {
      ...input.terms,
      renderedContent,
      templateVersion: template.version,
    },
    revenueShareId: input.revenueShareId,
    metadata: input.metadata,
  });

  // Send notification
  await sendContractNotification(contract, 'contract.created', {
    templateName: template.name,
  });

  log.info('Contract created from template', { contractId: contract.id });
  return contract;
}

/**
 * Save contract draft
 */
export async function saveContractDraft(
  contractId: string,
  updates: Partial<PartnerContractInput>
): Promise<PartnerContract> {
  log.info('Saving contract draft', { contractId });

  const contract = await getPartnerContract(prisma, contractId);
  if (!contract) {
    throw new Error(`Contract ${contractId} not found`);
  }

  if (contract.status !== 'draft') {
    throw new Error(`Cannot save draft for contract with status ${contract.status}`);
  }

  const updated = await updatePartnerContract(prisma, contractId, updates);
  log.info('Contract draft saved', { contractId });
  return updated;
}

/**
 * Propose contract revision
 */
export async function proposeRevision(
  input: ProposeRevisionInput
): Promise<PartnerContract> {
  log.info('Proposing contract revision', {
    contractId: input.contractId,
  });

  const contract = await getPartnerContract(prisma, input.contractId);
  if (!contract) {
    throw new Error(`Contract ${input.contractId} not found`);
  }

  if (contract.status !== 'signed' && contract.status !== 'negotiating') {
    throw new Error(`Cannot propose revision for contract with status ${contract.status}`);
  }

  // Update contract to negotiating status if signed
  if (contract.status === 'signed') {
    await updateContractStatus(prisma, input.contractId, 'negotiating');
  }

  // Update with proposed terms
  const updated = await updatePartnerContract(prisma, input.contractId, {
    terms: {
      ...(contract.terms as any),
      proposedTerms: input.proposedTerms,
      proposedEffectiveDate: input.proposedEffectiveDate,
      proposedExpiryDate: input.proposedExpiryDate,
      revisionNotes: input.revisionNotes,
      revisionProposedAt: new Date().toISOString(),
    },
  });

  // Send notification to counterparty
  await sendContractNotification(updated, 'contract.revision_proposed', {
    revisionNotes: input.revisionNotes,
  });

  log.info('Contract revision proposed', { contractId: input.contractId });
  return updated;
}

/**
 * Sign contract via e-signature integration
 * This will be called by the signature integration after signing ceremony completes
 */
export async function signContract(
  contractId: string,
  signedPdfUrl: string,
  signatureEvents: Array<{
    eventType: string;
    timestamp: Date;
    signerId: string;
    signerEmail: string;
    metadata?: Record<string, any>;
  }>
): Promise<PartnerContract> {
  log.info('Signing contract', { contractId });

  const contract = await getPartnerContract(prisma, contractId);
  if (!contract) {
    throw new Error(`Contract ${contractId} not found`);
  }

  if (contract.status !== 'draft' && contract.status !== 'negotiating') {
    throw new Error(`Cannot sign contract with status ${contract.status}`);
  }

  // Record signature events
  await recordSignatureEvents(prisma, contractId, signatureEvents);

  // Set signed PDF URL and update status
  const signed = await setSignedPdfUrl(prisma, contractId, signedPdfUrl);

  // Set effective date if not already set
  if (!signed.effectiveDate) {
    await updatePartnerContract(prisma, contractId, {
      effectiveDate: new Date(),
    });
  }

  // Send notification
  await sendContractNotification(signed, 'contract.signed', {
    signedPdfUrl,
  });

  log.info('Contract signed', { contractId });
  return signed;
}

/**
 * Cancel/terminate contract
 */
export async function cancelContract(
  contractId: string,
  reason?: string
): Promise<PartnerContract> {
  log.info('Cancelling contract', { contractId, reason });

  const contract = await getPartnerContract(prisma, contractId);
  if (!contract) {
    throw new Error(`Contract ${contractId} not found`);
  }

  if (contract.status === 'terminated') {
    throw new Error('Contract is already terminated');
  }

  const terminated = await updateContractStatus(prisma, contractId, 'terminated');

  // Update metadata with cancellation reason
  await updatePartnerContract(prisma, contractId, {
    metadata: {
      ...(contract.metadata as any),
      terminatedAt: new Date().toISOString(),
      terminationReason: reason,
    },
  });

  // Send notification
  await sendContractNotification(terminated, 'contract.terminated', {
    reason,
  });

  log.info('Contract terminated', { contractId });
  return terminated;
}

/**
 * Renew contract
 */
export async function renewContract(
  input: RenewContractInput
): Promise<PartnerContract> {
  log.info('Renewing contract', { contractId: input.contractId });

  const contract = await getPartnerContract(prisma, input.contractId);
  if (!contract) {
    throw new Error(`Contract ${input.contractId} not found`);
  }

  if (contract.status !== 'signed') {
    throw new Error(`Cannot renew contract with status ${contract.status}`);
  }

  // Create new contract based on existing one
  const renewed = await createPartnerContract(prisma, {
    orgId: contract.orgId,
    counterpartyId: contract.counterpartyId,
    templateId: contract.templateId ?? undefined,
    status: 'draft',
    effectiveDate: input.newEffectiveDate,
    expiryDate: input.newExpiryDate,
    terms: input.updatedTerms || contract.terms,
    revenueShareId: contract.revenueShareId ?? undefined,
    metadata: {
      ...(contract.metadata as any),
      renewedFrom: contract.id,
      renewedAt: new Date().toISOString(),
    },
  });

  // Send notification
  await sendContractNotification(renewed, 'contract.renewed', {
    previousContractId: contract.id,
  });

  log.info('Contract renewed', {
    contractId: input.contractId,
    newContractId: renewed.id,
  });
  return renewed;
}

/**
 * Send notification for contract status changes
 */
async function sendContractNotification(
  contract: PartnerContract,
  eventType: string,
  additionalData?: Record<string, any>
): Promise<void> {
  try {
    // Notify contract owner
    await createNotification(
      contract.orgId, // Using orgId as userId for org-level notifications
      `contract.${eventType}`,
      {
        contractId: contract.id,
        status: contract.status,
        counterpartyId: contract.counterpartyId,
        ...additionalData,
      }
    );

    // Notify counterparty (if they have a user associated)
    // In a real implementation, you'd look up users associated with the counterparty org
    // For now, we'll just log it
    log.info('Contract notification sent', {
      contractId: contract.id,
      eventType,
      orgId: contract.orgId,
      counterpartyId: contract.counterpartyId,
    });
  } catch (error) {
    log.error('Failed to send contract notification', {
      contractId: contract.id,
      eventType,
      error: error instanceof Error ? error.message : String(error),
    });
    // Don't throw - notification failure shouldn't break contract operations
  }
}

