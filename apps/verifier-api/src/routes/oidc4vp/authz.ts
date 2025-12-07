/**
 * OIDC4VP Authorization Endpoint with Presentation Definition Support
 *
 * S72-STRETCH-A-002: OIDC4VP authorization details + presentation definition support (minimal)
 * Verifier can send presentation_definition requesting specific VC type
 * Wallet receives & displays constraints
 * Verifier validates returned VP structure
 */

import { Request, Response, NextFunction } from 'express';
import { decodeJwt } from 'jose';

const VERIFIER_URL = process.env.PUBLIC_VERIFIER_URL || process.env.VERIFIER_URL || 'https://vitalcv.ai';

/**
 * Presentation Definition structure (minimal per OIDC4VP spec)
 */
export interface PresentationDefinition {
  id: string;
  input_descriptors: Array<{
    id: string;
    name?: string;
    purpose?: string;
    constraints: {
      fields: Array<{
        path: string[];
        filter?: {
          type: string;
          pattern?: string;
        };
      }>;
    };
  }>;
}

/**
 * Authorization Request with Presentation Definition
 */
export interface AuthorizationRequest {
  client_id: string;
  redirect_uri: string;
  response_type: string;
  scope: string;
  state: string;
  nonce: string;
  presentation_definition?: PresentationDefinition;
  presentation_definition_uri?: string;
}

/**
 * Generate authorization request with presentation definition
 * S72-STRETCH-A-002: Creates authorization request with presentation_definition
 */
export function generateAuthorizationRequest(
  clientId: string,
  redirectUri: string,
  requestedVcTypes: string[],
  options?: {
    purpose?: string;
    state?: string;
    nonce?: string;
  }
): AuthorizationRequest {
  const state = options?.state || Buffer.from(Math.random().toString(36)).toString('base64url').slice(0, 16);
  const nonce = options?.nonce || Buffer.from(Math.random().toString(36)).toString('base64url').slice(0, 16);

  // S72-STRETCH-A-002: Create presentation definition requesting specific VC types
  const presentationDefinition: PresentationDefinition = {
    id: `pd-${Date.now()}`,
    input_descriptors: requestedVcTypes.map((vcType, index) => ({
      id: `input-${vcType}-${index}`,
      name: `Request for ${vcType}`,
      purpose: options?.purpose || 'Verification of credential',
      constraints: {
        fields: [
          {
            path: ['$.type'],
            filter: {
              type: 'string',
              pattern: `.*${vcType}.*`,
            },
          },
        ],
      },
    })),
  };

  return {
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'vp_token',
    scope: 'openid',
    state,
    nonce,
    presentation_definition: presentationDefinition,
  };
}

/**
 * Validate presentation definition structure
 * S72-STRETCH-A-002: Validates presentation_definition format
 */
export function validatePresentationDefinition(pd: any): { valid: boolean; error?: string } {
  if (!pd || typeof pd !== 'object') {
    return { valid: false, error: 'Presentation definition must be an object' };
  }

  if (!pd.id || typeof pd.id !== 'string') {
    return { valid: false, error: 'Presentation definition must have an id field' };
  }

  if (!pd.input_descriptors || !Array.isArray(pd.input_descriptors)) {
    return { valid: false, error: 'Presentation definition must have input_descriptors array' };
  }

  for (const descriptor of pd.input_descriptors) {
    if (!descriptor.id || typeof descriptor.id !== 'string') {
      return { valid: false, error: 'Each input_descriptor must have an id field' };
    }

    if (!descriptor.constraints || !descriptor.constraints.fields || !Array.isArray(descriptor.constraints.fields)) {
      return { valid: false, error: 'Each input_descriptor must have constraints.fields array' };
    }

    for (const field of descriptor.constraints.fields) {
      if (!field.path || !Array.isArray(field.path)) {
        return { valid: false, error: 'Each field must have a path array' };
      }
    }
  }

  return { valid: true };
}

/**
 * Extract requested VC types from presentation definition
 * S72-STRETCH-A-002: Extracts constraints to determine what VC types are requested
 */
export function extractRequestedVcTypes(pd: PresentationDefinition): string[] {
  const vcTypes: string[] = [];

  for (const descriptor of pd.input_descriptors) {
    for (const field of descriptor.constraints.fields) {
      if (field.filter?.pattern) {
        // Extract VC type from pattern (e.g., ".*PhysicianCredential.*" -> "PhysicianCredential")
        const match = field.filter.pattern.match(/\*?([A-Za-z]+Credential)[A-Za-z]*\*?/);
        if (match && match[1]) {
          vcTypes.push(match[1]);
        }
      }
    }
  }

  return [...new Set(vcTypes)]; // Deduplicate
}

/**
 * Validate VP structure against presentation definition
 * S72-STRETCH-A-002: Verifier validates returned VP structure matches constraints
 */
export function validateVPAgainstPresentationDefinition(
  vpToken: string,
  presentationDefinition: PresentationDefinition
): { valid: boolean; error?: string; matchedTypes?: string[] } {
  try {
    // Decode VP token
    const decoded = decodeJwt(vpToken);
    const vp = decoded.vp as any;

    if (!vp || !vp.verifiableCredential) {
      return { valid: false, error: 'VP token missing verifiableCredential field' };
    }

    const credentials = Array.isArray(vp.verifiableCredential)
      ? vp.verifiableCredential
      : [vp.verifiableCredential];

    const matchedTypes: string[] = [];

    // Check each input descriptor
    for (const descriptor of presentationDefinition.input_descriptors) {
      let descriptorMatched = false;

      for (const field of descriptor.constraints.fields) {
        // Check if any credential matches the field constraints
        for (const credential of credentials) {
          let credentialData: any;

          // Handle JWT credentials
          if (typeof credential === 'string') {
            try {
              const credDecoded = decodeJwt(credential);
              credentialData = credDecoded;
            } catch {
              // Not a JWT, treat as JSON
              credentialData = JSON.parse(credential);
            }
          } else {
            credentialData = credential;
          }

          // Check path constraints
          for (const path of field.path) {
            if (path === '$.type') {
              const types = credentialData.type || [];
              if (Array.isArray(types)) {
                for (const type of types) {
                  if (field.filter?.pattern) {
                    const regex = new RegExp(field.filter.pattern.replace(/\*/g, '.*'));
                    if (regex.test(type)) {
                      descriptorMatched = true;
                      matchedTypes.push(type);
                    }
                  } else {
                    descriptorMatched = true;
                    matchedTypes.push(...types);
                  }
                }
              }
            }
          }
        }
      }

      if (!descriptorMatched) {
        return {
          valid: false,
          error: `No credential matched input_descriptor ${descriptor.id}`,
        };
      }
    }

    return { valid: true, matchedTypes: [...new Set(matchedTypes)] };
  } catch (error) {
    return {
      valid: false,
      error: `VP validation error: ${error instanceof Error ? error.message : 'unknown'}`,
    };
  }
}

/**
 * Authorization Endpoint Handler
 * GET /oidc4vp/authorize
 *
 * S72-STRETCH-A-002: Handles authorization request with presentation_definition
 */
export function authorizationHandler(req: Request, res: Response, next: NextFunction): void {
  const {
    client_id,
    redirect_uri,
    response_type,
    scope,
    state,
    nonce,
    presentation_definition,
    presentation_definition_uri,
  } = req.query;

  // Validate required parameters
  if (!client_id || !redirect_uri || !state || !nonce) {
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'Missing required parameters: client_id, redirect_uri, state, nonce',
    });
  }

  // S72-STRETCH-A-002: Validate presentation_definition if provided
  if (presentation_definition) {
    let pd: any;
    try {
      pd = typeof presentation_definition === 'string'
        ? JSON.parse(presentation_definition)
        : presentation_definition;
    } catch {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Invalid presentation_definition JSON',
      });
    }

    const validation = validatePresentationDefinition(pd);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: validation.error,
      });
    }

    // Store presentation definition for later validation
    (req as any).presentationDefinition = pd;
    (req as any).requestedVcTypes = extractRequestedVcTypes(pd);
  }

  // S72-STRETCH-A-002: If presentation_definition_uri is provided, fetch it
  if (presentation_definition_uri) {
    // TODO: Fetch presentation definition from URI
    // For now, return error indicating URI fetching not yet implemented
    return res.status(501).json({
      error: 'not_implemented',
      error_description: 'presentation_definition_uri fetching not yet implemented',
    });
  }

  // Store authorization request parameters
  (req as any).authorizationRequest = {
    client_id,
    redirect_uri,
    response_type,
    scope,
    state,
    nonce,
  };

  // Continue to next middleware (e.g., authentication, consent)
  next();
}

/**
 * Authorization Response Handler
 * Handles callback from wallet with VP token
 *
 * S72-STRETCH-A-002: Validates returned VP structure against presentation_definition
 */
export function authorizationResponseHandler(req: Request, res: Response): void {
  const { vp_token, state, presentation_submission } = req.query;

  if (!vp_token) {
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'Missing vp_token',
    });
  }

  const presentationDefinition = (req as any).presentationDefinition;

  if (presentationDefinition) {
    // S72-STRETCH-A-002: Validate VP structure against presentation_definition
    const validation = validateVPAgainstPresentationDefinition(
      vp_token as string,
      presentationDefinition
    );

    if (!validation.valid) {
      return res.status(400).json({
        error: 'invalid_vp',
        error_description: validation.error || 'VP does not match presentation definition',
      });
    }

    // Return success with matched types
    return res.json({
      verified: true,
      matched_vc_types: validation.matchedTypes,
      presentation_submission,
      state,
    });
  }

  // No presentation definition - basic validation
  res.json({
    verified: true,
    state,
  });
}

export default {
  authorizationHandler,
  authorizationResponseHandler,
  generateAuthorizationRequest,
  validatePresentationDefinition,
  extractRequestedVcTypes,
  validateVPAgainstPresentationDefinition,
};

