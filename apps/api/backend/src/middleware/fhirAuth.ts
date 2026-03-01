import type { NextFunction, Request, Response } from 'express';

export function fhirAuthGuard(req: Request, res: Response, next: NextFunction): void {
  // Stub for SMART on FHIR Backend Services authorization
  // Expects system/Practitioner.read scope
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      resourceType: 'OperationOutcome',
      issue: [{
        severity: 'error',
        code: 'login',
        diagnostics: 'Missing or invalid Bearer token'
      }]
    });
    return;
  }

  // In a real implementation: verify JWT and check for 'system/Practitioner.read' scope

  // For the stub, we just accept the token as valid and proceed
  next();
}
