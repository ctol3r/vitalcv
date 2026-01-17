const log = getServiceLogger('flags/wireVita');
/**
 * B149B-FF-014: Guard VITA features with `billing.vita.enabled` flag
 *
 * Centralized service for all VITA issuance and usage operations.
 * All calls to VITA issuance/usage check flag; if off, returns 501 Not Implemented with helpful message.
 */

type PrismaClient = any;
import { getServiceLogger } from '../logging/serviceLogger';
import { checkFeatureFlag } from './featureFlags';

/**
 * Error class for VITA feature disabled
 */
export class VITANotImplementedError extends Error {
  constructor(
    message: string = 'VITA billing features are not currently implemented. Please contact support for more information.',
  ) {
    super(message);
    this.name = 'VITANotImplementedError';
  }
}

/**
 * Check if VITA features are enabled
 * @param prisma - Prisma client instance
 * @param orgId - Optional organization ID for per-org flags
 * @returns true if VITA features are enabled
 * @throws VITANotImplementedError if disabled
 */
export async function requireVITAEnabled(prisma: PrismaClient, orgId?: string): Promise<boolean> {
  const enabled = await checkFeatureFlag(prisma, 'billing.vita.enabled', orgId);
  if (!enabled) {
    throw new VITANotImplementedError();
  }
  return true;
}

/**
 * Issue VITA tokens to an organization
 * @param prisma - Prisma client instance
 * @param orgId - Organization ID to issue tokens to
 * @param amount - Amount of VITA tokens to issue
 * @param reason - Reason for issuance
 * @param metadata - Additional metadata
 * @returns Transaction ID
 */
export async function issueVITA(
  prisma: PrismaClient,
  orgId: string,
  amount: number,
  reason: string,
  metadata?: Record<string, any>,
): Promise<string> {
  // Check if VITA features are enabled
  await requireVITAEnabled(prisma, orgId);

  // Record in VITA ledger
  const ledgerEntry = await prisma.vitaLedger.create({
    data: {
      orgId,
      amount, // Positive for credits
      type: 'issuance',
      txId: `VITA-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      reference: reason,
      metadata: metadata || {},
    },
  });

  log.info(`[wireVita] Issued ${amount} VITA tokens to org ${orgId}`, {
    txId: ledgerEntry.txId,
    reason,
  });

  return ledgerEntry.txId;
}

/**
 * Debit VITA tokens from an organization
 * @param prisma - Prisma client instance
 * @param orgId - Organization ID to debit tokens from
 * @param amount - Amount of VITA tokens to debit
 * @param reason - Reason for debit
 * @param metadata - Additional metadata
 * @returns Transaction ID
 */
export async function debitVITA(
  prisma: PrismaClient,
  orgId: string,
  amount: number,
  reason: string,
  metadata?: Record<string, any>,
): Promise<string> {
  // Check if VITA features are enabled
  await requireVITAEnabled(prisma, orgId);

  // Record in VITA ledger
  const ledgerEntry = await prisma.vitaLedger.create({
    data: {
      orgId,
      amount: -Math.abs(amount), // Negative for debits
      type: 'debit',
      txId: `VITA-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      reference: reason,
      metadata: metadata || {},
    },
  });

  log.info(`[wireVita] Debited ${amount} VITA tokens from org ${orgId}`, {
    txId: ledgerEntry.txId,
    reason,
  });

  return ledgerEntry.txId;
}

/**
 * Get VITA balance for an organization
 * @param prisma - Prisma client instance
 * @param orgId - Organization ID
 * @returns Current VITA balance
 */
export async function getVITABalance(prisma: PrismaClient, orgId: string): Promise<number> {
  // Check if VITA features are enabled
  await requireVITAEnabled(prisma, orgId);

  // Sum all ledger entries for this org
  const entries = await prisma.vitaLedger.findMany({
    where: { orgId },
  });

  const balance = entries.reduce((sum: number, entry: { amount: number }) => sum + entry.amount, 0);
  return balance;
}

/**
 * Verify VITA transaction
 * @param prisma - Prisma client instance
 * @param txId - Transaction ID to verify
 * @returns true if transaction exists and is valid
 */
export async function verifyVITATransaction(prisma: PrismaClient, txId: string): Promise<boolean> {
  // Check if VITA features are enabled (no orgId needed for verification)
  const enabled = await checkFeatureFlag(prisma, 'billing.vita.enabled');
  if (!enabled) {
    throw new VITANotImplementedError();
  }

  const entry = await prisma.vitaLedger.findUnique({
    where: { txId },
  });

  return !!entry;
}
