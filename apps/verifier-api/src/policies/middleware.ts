import { Request, Response, NextFunction } from 'express';
import {
  validateFieldsAgainstAllowlist,
  validateRoleBasedPolicy,
  PurposeOfUse,
  RequesterRole
} from '../policies/pouPolicy';

/**
 * B110A-POLICY-005: Middleware to enforce min-necessary field allowlists per PoU + role-based policy guard
 *
 * Extracts requested fields from request body and validates against PoU allowlist.
 * Also enforces role-based restrictions.
 * Rejects requests exceeding allowlist with 400 error.
 * Over-disclosure blocked; coverage ≥90%
 */
export function pouAllowlistEnforcer(req: Request, res: Response, next: NextFunction) {
  // Extract PoU from request (header or body)
  const pou = (req.headers['x-purpose-of-use'] as PurposeOfUse) ||
              (req.body?.purpose_of_use as PurposeOfUse) ||
              'TREATMENT'; // Default to TREATMENT

  // B110A-POLICY-005: Extract requester role from request (header, body, or auth context)
  const role = (req.headers['x-requester-role'] as RequesterRole) ||
               (req.body?.requester_role as RequesterRole) ||
               ((req as any).user?.role as RequesterRole) ||
               'verifier'; // Default to verifier

  // Extract requested fields from request body
  // Fields can be in various formats:
  // - presentation_definition.claims.vc.credentialSubject.*
  // - credential_request.claims.*
  // - fields array
  const requestedFields: string[] = [];

  // Try to extract from different request formats
  if (req.body?.presentation_definition?.input_descriptors) {
    for (const descriptor of req.body.presentation_definition.input_descriptors) {
      if (descriptor.constraints?.fields) {
        for (const field of descriptor.constraints.fields) {
          if (field.path) {
            requestedFields.push(...field.path);
          }
        }
      }
    }
  }

  if (req.body?.credential_request?.claims) {
    requestedFields.push(...Object.keys(req.body.credential_request.claims));
  }

  if (req.body?.fields && Array.isArray(req.body.fields)) {
    requestedFields.push(...req.body.fields);
  }

  // If no fields specified, allow (may be a discovery/metadata request)
  if (requestedFields.length === 0) {
    return next();
  }

  // B110A-POLICY-005: First validate role-based policy
  const roleValidation = validateRoleBasedPolicy(pou, role, requestedFields);
  if (!roleValidation.valid) {
    return res.status(403).json({
      error: 'role_policy_violation',
      error_description: roleValidation.error,
      purpose_of_use: pou,
      requester_role: role,
      hint: `Role '${role}' is not authorized for PoU '${pou}' or exceeds field limits`,
    });
  }

  // B110A-POLICY-005: Then validate fields against PoU allowlist (over-disclosure blocked)
  const validation = validateFieldsAgainstAllowlist(requestedFields, pou);

  if (!validation.valid) {
    return res.status(400).json({
      error: 'field_not_allowed',
      error_description: validation.error,
      purpose_of_use: pou,
      requester_role: role,
      denied_fields: validation.deniedFields,
      allowed_fields: validation.allowedFields,
      hint: `Requested fields exceed minimum-necessary allowlist for PoU: ${pou}. Only the following fields are allowed: ${validation.allowedFields.join(', ')}`,
    });
  }

  // Attach validation result to request for downstream use
  (req as any).pouValidation = {
    pou,
    role,
    requestedFields: validation.allowedFields,
  };

  next();
}

