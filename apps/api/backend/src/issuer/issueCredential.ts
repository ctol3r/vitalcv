import { Request } from 'express';

export async function issueCredential(req: Request) {
  /**
   * TODO:
   * - Move full OIDC4VCI issuance logic here
   * - Validate credential_request
   * - Enforce policy
   * - Issue VC
   * - Emit audit events
   */
  throw new Error('Not implemented: issueCredential');
}
