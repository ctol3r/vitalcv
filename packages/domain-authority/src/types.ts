/**
 * Domain types for authority lifecycle.
 *
 * Pure TypeScript only. State is derived from events + time.
 */

export enum AuthorityKind {
  HUMAN = 'HUMAN',
  SYSTEM = 'SYSTEM',
}

export enum AuthorityAction {
  ASSERT = 'ASSERT',
  REVOKE = 'REVOKE',
}

export enum AuthorityEventType {
  GRANT = 'GRANT',
  REVOKE = 'REVOKE',
  OVERRIDE = 'OVERRIDE',
  EXPIRE = 'EXPIRE',
}

export enum AuthorityScopeStatus {
  ACTIVE = 'ACTIVE',
  REVOKED = 'REVOKED',
  EXPIRED = 'EXPIRED',
  PENDING = 'PENDING',
}

export class DomainAuthorityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainAuthorityError';
  }
}

export class AuthorityInvariantError extends DomainAuthorityError {
  constructor(message: string) {
    super(message);
    this.name = 'AuthorityInvariantError';
  }
}

export class AuthorityEventError extends DomainAuthorityError {
  constructor(message: string) {
    super(message);
    this.name = 'AuthorityEventError';
  }
}

export class AuthorityScopeError extends DomainAuthorityError {
  constructor(message: string) {
    super(message);
    this.name = 'AuthorityScopeError';
  }
}

export class AmbiguousAuthorityStateError extends DomainAuthorityError {
  constructor(message: string) {
    super(message);
    this.name = 'AmbiguousAuthorityStateError';
  }
}
