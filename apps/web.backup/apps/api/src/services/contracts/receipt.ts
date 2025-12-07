import { createHash, createHmac, randomUUID } from 'crypto';
import type { ContractEscrow } from '@prisma/client';

const SIGNING_KEY = process.env.CONTRACT_RECEIPT_SIGNING_KEY || 'demo-contract-secret';

export interface ContractReceipt {
  receiptId: string;
  contractId: string;
  status: string;
  amount: number;
  currency: string;
  employerId: string;
  clinicianId: string;
  blockHash: string;
  txHash: string;
  issuedAt: string;
  signature: string;
}

export function generateContractReceipt(contract: ContractEscrow): ContractReceipt {
  const issuedAt = new Date().toISOString();
  const receiptPayload = {
    contractId: contract.id,
    status: contract.status,
    amount: contract.amount,
    currency: contract.currency,
    employerId: contract.employerId,
    clinicianId: contract.clinicianId,
    issuedAt,
    metadata: contract.metadata ?? {},
  };

  const blockHash = hashPayload(receiptPayload);
  const txHash = hashPayload({ blockHash, issuedAt });
  const signature = createHmac('sha256', SIGNING_KEY).update(blockHash).digest('hex');

  return {
    receiptId: randomUUID(),
    contractId: contract.id,
    status: contract.status,
    amount: contract.amount,
    currency: contract.currency,
    employerId: contract.employerId,
    clinicianId: contract.clinicianId,
    blockHash,
    txHash,
    issuedAt,
    signature,
  };
}

function hashPayload(payload: unknown): string {
  return `0x${createHash('sha256').update(JSON.stringify(payload)).digest('hex')}`;
}











