import { Request, Response, NextFunction } from 'express';
import { TefcaPurposeOfUse } from '../../../services/tefca/models/QhinConfig.js';
import { applyPouRedaction, applyPouRedactionToBundle } from '../../../services/tefca/pouMatrix.js';
import { applyDirectoryConsent } from '../../../services/tefca/consent.js';

export interface PouRequest extends Request {
  tefcaPou?: TefcaPurposeOfUse;
}

function isValidPou(value: unknown): value is TefcaPurposeOfUse {
  return typeof value === 'string' && Object.values(TefcaPurposeOfUse).includes(value as TefcaPurposeOfUse);
}

function sanitizeResource(resource: any, pou: TefcaPurposeOfUse): any {
  if (!resource || typeof resource !== 'object') {
    return resource;
  }

  let redacted = applyPouRedaction(resource, pou);

  if (redacted.resourceType === 'PractitionerRole') {
    redacted = applyDirectoryConsent(redacted);
  }

  if (Array.isArray(redacted.contained)) {
    redacted = {
      ...redacted,
      contained: redacted.contained.map((contained: any) => sanitizeResource(contained, pou)),
    };
  }

  return redacted;
}

function sanitizeBody(body: any, pou: TefcaPurposeOfUse): any {
  if (!body) {
    return body;
  }

  if (body.resourceType === 'Bundle') {
    const sanitizedBundle = applyPouRedactionToBundle(body, pou);
    sanitizedBundle.entry = sanitizedBundle.entry?.map((entry: any) => ({
      ...entry,
      resource: sanitizeResource(entry.resource, pou),
    }));
    return sanitizedBundle;
  }

  if (Array.isArray(body)) {
    return body.map((item) => (item?.resourceType ? sanitizeResource(item, pou) : item));
  }

  if (body.resourceType) {
    return sanitizeResource(body, pou);
  }

  return body;
}

export function pouEnforce(req: PouRequest, res: Response, next: NextFunction): void {
  const pouClaim = (req as any).auth?.pou || req.headers['x-purpose-of-use'];

  if (!isValidPou(pouClaim)) {
    res.status(403).json({
      error: 'pou_required',
      message: 'Purpose of Use claim is required for TEFCA resources',
    });
    return;
  }

  req.tefcaPou = pouClaim;
  const originalJson = res.json.bind(res);

  res.json = (body: any) => {
    const sanitized = sanitizeBody(body, pouClaim);
    return originalJson(sanitized);
  };

  next();
}
/**
 * B166B-TEFCA-002: PoU enforcement middleware for FHIR facade
 *
 * - Extracts Purpose of Use from access token claims
 * - Ensures PoU is one of TEFCA-approved values
 * - Redacts disallowed FHIR fields before sending responses
 */

import { NextFunction, Request, Response } from 'express';
import { TefcaPurposeOfUse } from '../../../../services/tefca/models/QhinConfig.js';
import {
  applyPouMatrix,
  applyPouMatrixToBundle,
  isDirectoryResource,
} from '../../../../services/tefca/pouMatrix.js';

export interface PouContext {
  purpose: TefcaPurposeOfUse;
  requester: string;
  subject?: string;
}

export interface PouEnforcedRequest extends Request {
  tefcaPou?: PouContext;
}

interface JwtPayload {
  purpose_of_use?: string;
  pou?: string;
  PoU?: string;
  requester?: string;
  client_id?: string;
  sub?: string;
  subject?: string;
}

export function pouEnforce() {
  return (req: PouEnforcedRequest, res: Response, next: NextFunction): void => {
    const token = extractBearerToken(req);
    if (!token) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Bearer token with PoU claim is required',
      });
      return;
    }

    const payload = decodeJwtPayload(token);
    if (!payload) {
      res.status(400).json({
        error: 'BadRequest',
        message: 'Unable to parse PoU token payload',
      });
      return;
    }

    const purpose = normalizePurpose(payload);
    if (!purpose || !Object.values(TefcaPurposeOfUse).includes(purpose)) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Purpose of Use is missing or invalid for TEFCA directory access',
      });
      return;
    }

    req.tefcaPou = {
      purpose,
      requester: payload.requester || payload.client_id || 'unknown-requester',
      subject: payload.sub || payload.subject,
    };

    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      let transformed = body;
      if (body && req.tefcaPou) {
        transformed = redactBodyForPou(body, req.tefcaPou.purpose);
      }
      return originalJson(transformed);
    };

    next();
  };
}

function extractBearerToken(req: Request): string | null {
  const authorization = req.headers.authorization || req.headers.Authorization;
  if (!authorization || typeof authorization !== 'string') {
    return null;
  }
  const [scheme, value] = authorization.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !value) {
    return null;
  }
  return value;
}

function decodeJwtPayload(token: string): JwtPayload | null {
  const segments = token.split('.');
  if (segments.length < 2) {
    return null;
  }
  try {
    const payloadSegment = segments[1];
    const padded = padBase64(payloadSegment);
    const json = Buffer.from(padded, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function padBase64(value: string): string {
  let padded = value.replace(/-/g, '+').replace(/_/g, '/');
  while (padded.length % 4 !== 0) {
    padded += '=';
  }
  return padded;
}

function normalizePurpose(payload: JwtPayload): TefcaPurposeOfUse | null {
  const rawPurpose =
    payload.purpose_of_use ||
    payload.pou ||
    payload.PoU;

  if (!rawPurpose) {
    return null;
  }

  return rawPurpose as TefcaPurposeOfUse;
}

function redactBodyForPou(body: any, purpose: TefcaPurposeOfUse) {
  if (body?.resourceType === 'Bundle') {
    return applyPouMatrixToBundle(body, purpose);
  }

  if (body?.resourceType && isDirectoryResource(body.resourceType)) {
    return applyPouMatrix(body, purpose);
  }

  return body;
}


