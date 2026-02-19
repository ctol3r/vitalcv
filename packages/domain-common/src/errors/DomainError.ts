/**
 * DomainError
 *
 * Single canonical error type for ALL domain invariants.
 * Tests rely on instanceof DomainError — do not duplicate this class.
 */
export class DomainError extends Error {
  readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "DomainError";
    this.code = code;

    // Required for instanceof to work across transpilation
    Object.setPrototypeOf(this, new.target.prototype);
  }
}