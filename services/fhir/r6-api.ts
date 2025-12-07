const log = getServiceLogger('fhir/r6-api');
/**
 * B119A-FHIR6-008: FHIR R6 PractitionerRole API endpoints
 *
 * Exposes REST API for FHIR R6 normative PractitionerRole resources
 */

import express, { Request, Response } from 'express';
import { getFHIRR6Service } from './practitioner-role-r6';
import { getServiceLogger } from '../logging/serviceLogger';

const router = express.Router();
const fhirService = getFHIRR6Service();

/**
 * GET /fhir/R6/Practitioner/:id
 * Get Practitioner resource (R6 normative)
 */
router.get('/Practitioner/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const practitioner = fhirService.getPractitioner(id);

    if (!practitioner) {
      return res.status(404).json({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'not-found',
          diagnostics: `Practitioner ${id} not found`,
        }],
      });
    }

    res.json(practitioner);
  } catch (error: any) {
    log.error('Practitioner query error:', error);
    res.status(500).json({
      resourceType: 'OperationOutcome',
      issue: [{
        severity: 'error',
        code: 'exception',
        diagnostics: error.message,
      }],
    });
  }
});

/**
 * GET /fhir/R6/PractitionerRole
 * Search PractitionerRole resources (R6 normative)
 */
router.get('/PractitionerRole', (req: Request, res: Response) => {
  try {
    const { practitioner, organization, active } = req.query;

    // Get all roles (in production, this would query a database)
    const allRoles: any[] = [];
    for (const roles of (fhirService as any).roles.values()) {
      allRoles.push(...roles);
    }

    let filteredRoles = allRoles;

    // Filter by practitioner
    if (practitioner) {
      const practitionerId = (practitioner as string).replace('Practitioner/', '');
      filteredRoles = filteredRoles.filter(r =>
        r.practitioner?.reference === `Practitioner/${practitionerId}`
      );
    }

    // Filter by organization
    if (organization) {
      const organizationId = (organization as string).replace('Organization/', '');
      filteredRoles = filteredRoles.filter(r =>
        r.organization?.reference === `Organization/${organizationId}`
      );
    }

    // Filter by active status
    if (active !== undefined) {
      const isActive = active === 'true';
      filteredRoles = filteredRoles.filter(r => r.active === isActive);
    }

    res.json({
      resourceType: 'Bundle',
      type: 'searchset',
      total: filteredRoles.length,
      entry: filteredRoles.map(role => ({
        resource: role,
      })),
    });
  } catch (error: any) {
    log.error('PractitionerRole search error:', error);
    res.status(500).json({
      resourceType: 'OperationOutcome',
      issue: [{
        severity: 'error',
        code: 'exception',
        diagnostics: error.message,
      }],
    });
  }
});

/**
 * GET /fhir/R6/PractitionerRole/:id
 * Get PractitionerRole resource by ID (R6 normative)
 */
router.get('/PractitionerRole/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const role = fhirService.getPractitionerRoleById(id);

    if (!role) {
      return res.status(404).json({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'not-found',
          diagnostics: `PractitionerRole ${id} not found`,
        }],
      });
    }

    // Validate R6 conformance
    const validation = fhirService.validatePractitionerRole(role);
    if (!validation.valid) {
      return res.status(400).json({
        resourceType: 'OperationOutcome',
        issue: validation.errors.map(error => ({
          severity: 'error',
          code: 'invalid',
          diagnostics: error,
        })),
      });
    }

    res.json(role);
  } catch (error: any) {
    log.error('PractitionerRole query error:', error);
    res.status(500).json({
      resourceType: 'OperationOutcome',
      issue: [{
        severity: 'error',
        code: 'exception',
        diagnostics: error.message,
      }],
    });
  }
});

/**
 * POST /fhir/R6/PractitionerRole
 * Create PractitionerRole resource (R6 normative)
 */
router.post('/PractitionerRole', (req: Request, res: Response) => {
  try {
    const role = req.body as any;

    // Validate R6 conformance
    const validation = fhirService.validatePractitionerRole(role);
    if (!validation.valid) {
      return res.status(400).json({
        resourceType: 'OperationOutcome',
        issue: validation.errors.map(error => ({
          severity: 'error',
          code: 'invalid',
          diagnostics: error,
        })),
      });
    }

    // Extract practitioner ID
    const practitionerRef = role.practitioner?.reference;
    if (!practitionerRef) {
      return res.status(400).json({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'required',
          diagnostics: 'PractitionerRole.practitioner.reference is required',
        }],
      });
    }

    const practitionerId = practitionerRef.replace('Practitioner/', '');

    // Store role
    const existingRoles = fhirService.getPractitionerRoles(practitionerId);
    existingRoles.push(role);
    (fhirService as any).roles.set(practitionerId, existingRoles);

    res.status(201).json(role);
  } catch (error: any) {
    log.error('PractitionerRole creation error:', error);
    res.status(500).json({
      resourceType: 'OperationOutcome',
      issue: [{
        severity: 'error',
        code: 'exception',
        diagnostics: error.message,
      }],
    });
  }
});

/**
 * GET /fhir/R6/Organization/:id
 * Get Organization resource (R6 normative)
 */
router.get('/Organization/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const organization = fhirService.getOrganization(id);

    if (!organization) {
      return res.status(404).json({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'not-found',
          diagnostics: `Organization ${id} not found`,
        }],
      });
    }

    res.json(organization);
  } catch (error: any) {
    log.error('Organization query error:', error);
    res.status(500).json({
      resourceType: 'OperationOutcome',
      issue: [{
        severity: 'error',
        code: 'exception',
        diagnostics: error.message,
      }],
    });
  }
});

export default router;

