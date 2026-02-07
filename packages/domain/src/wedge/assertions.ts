import { DomainError } from "@vitalcv/domain-common";

export function assertCanAccept(recognition: unknown): void {
  if (!recognition) {
    throw new DomainError("Recognition is required before acceptance");
  }
}

export function assertCanStart(
  acceptance: unknown,
  receipts: unknown[]
): void {
  if (!acceptance) {
    throw new DomainError("Acceptance is required before start");
  }

  if (!receipts || receipts.length === 0) {
    throw new DomainError("Valid verification is required before start");
  }
}