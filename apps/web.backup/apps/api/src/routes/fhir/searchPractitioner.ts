/**
 * B166B-TEFCA-005: TEFCA /fhir/R6/Practitioner search (identifier + name)
 *
 * - Enforces Purpose of Use via middleware
 * - Filters mock directory for identifier or name prefix
 * - Logs TEFCA audit entries for every request
 */

import express, { Response } from 'express';
import { pouEnforce, PouEnforcedRequest } from '../../middleware/pouEnforce.js';
import {
  findEndpointByReference,
  findOrganizationByReference,
  findPractitionersByIdentifier,
  rolesForPractitioner,
  searchPractitionersByName,
  trustedParticipants,
} from '../../../../../services/tefca/trustedParticipants.js';
import { hasDirectoryConsent } from '../../../../../services/tefca/consent.js';
import { logTefcaAudit } from '../../../../../services/tefca/auditLogger.js';

const router = express.Router();

router.get('/Practitioner', pouEnforce(), async (req: PouEnforcedRequest, res: Response) => {
  const { identifier, name } = req.query;

  if (!identifier && !name) {
    return res.status(400).json({
      error: 'BadRequest',
      message: 'Query parameter identifier or name is required',
    });
  }

  const matches = identifier
    ? findPractitionersByIdentifier(String(identifier))
    : searchPractitionersByName(String(name));

  const bundle = buildBundle(matches);

  await logTefcaAudit({
    resourceType: 'Practitioner',
    subject: identifier ? `identifier=${identifier}` : `name=${name}`,
    pou: req.tefcaPou?.purpose || 'UNKNOWN',
    requester: req.tefcaPou?.requester || 'unknown-requester',
  });

  return res.json(bundle);
});

function buildBundle(practitioners: typeof trustedParticipants.practitioners) {
  const entries: any[] = [];
  const includedOrganizations = new Set<string>();
  const includedEndpoints = new Set<string>();

  for (const practitioner of practitioners) {
    entries.push(entryFor(practitioner));

    const roles = rolesForPractitioner(practitioner.id);
    for (const role of roles) {
      const clonedRole = deepClone(role);
      if (!hasDirectoryConsent(practitioner.id)) {
        delete clonedRole.location;
      }
      entries.push(entryFor(clonedRole));

      const organization = findOrganizationByReference(role.organization);
      if (organization && !includedOrganizations.has(organization.id)) {
        entries.push(entryFor(organization));
        includedOrganizations.add(organization.id);
      }

      const endpoint = role.endpoint?.map(findEndpointByReference).find(Boolean);
      if (endpoint && !includedEndpoints.has(endpoint.id)) {
        entries.push(entryFor(endpoint));
        includedEndpoints.add(endpoint.id);
      }
    }
  }

  return {
    resourceType: 'Bundle',
    type: 'searchset',
    total: practitioners.length,
    entry: entries,
  };
}

function entryFor(resource: any) {
  return {
    fullUrl: `${resource.resourceType}/${resource.id}`,
    resource,
  };
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export default router;


