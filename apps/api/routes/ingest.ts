import crypto from 'crypto';
import type { Express, Request, Response } from 'express';
import { apiKeyAuth } from '../backend/src/middleware/publicSafety';
import { withHttpToolSpan, withNpiLookupToolSpan } from '../backend/src/tools/tracing';
import {
  detectIntakeConflicts,
  ingestNpiIdentity,
  NpiIngestError,
  parseCandidateCredential,
  ResumeIngestError,
  summarizeCandidateCredentials,
} from '../../../packages/ingest';
import {
  appendCandidateCredentials,
  emitIngestAuditEvent,
  getClinicianIdentity,
  hasUnresolvedIntakeConflicts,
  listCandidateCredentials,
  listIntakeConflicts,
  readIdempotentResponse,
  resolveRequestHash,
  setIntakeConflicts,
  upsertClinicianIdentity,
  writeIdempotentResponse,
} from '../ingest';

type NpiBody = {
  clinician_id?: unknown;
  npi?: unknown;
};

type ResumeFileBody = {
  filename?: unknown;
  mime_type?: unknown;
  content_base64?: unknown;
};

type FilesBody = {
  clinician_id?: unknown;
  files?: unknown;
};

function requestCorrelationId(res: Response): string {
  if (typeof res.locals.request_id === 'string' && res.locals.request_id.trim().length > 0) {
    return res.locals.request_id.trim();
  }

  return crypto.randomUUID();
}

function parseStringField(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} is required`);
  }

  return value.trim();
}

function parseOptionalStringField(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function toJsonError(res: Response, status: number, message: string): Response {
  return res.status(status).json({ error: message });
}

function mapIngestErrorStatus(error: unknown): number {
  if (error instanceof NpiIngestError) {
    if (
      error.code === 'INVALID_NPI' ||
      error.code === 'INVALID_NPI_CHECKSUM' ||
      error.code === 'NPPES_NOT_FOUND'
    ) {
      return 400;
    }
    return 502;
  }

  if (error instanceof ResumeIngestError) {
    if (error.code === 'UNSUPPORTED_FILE_TYPE') return 415;
    if (error.code === 'FILE_TOO_LARGE') return 413;
    return 400;
  }

  if (error instanceof Error && /required/i.test(error.message)) {
    return 400;
  }

  return 500;
}

function resolveClinicianIdFromInput(input: {
  clinician_id: unknown;
  npi?: unknown;
}): string {
  const clinicianFromInput = parseOptionalStringField(input.clinician_id);
  if (clinicianFromInput) return clinicianFromInput;

  const npiCandidate = parseOptionalStringField(input.npi);
  if (npiCandidate) {
    return `clinician:npi:${npiCandidate}`;
  }

  throw new Error('clinician_id is required');
}

async function detectAndPersistConflicts(clinician_id: string): Promise<readonly string[]> {
  const identity = getClinicianIdentity(clinician_id);
  const credentials = listCandidateCredentials(clinician_id);
  const priorConflictIds = new Set(
    listIntakeConflicts(clinician_id).map((conflict) => conflict.conflict_id),
  );
  const conflicts = detectIntakeConflicts({
    clinician_id,
    identity,
    credentials,
  });
  setIntakeConflicts(clinician_id, conflicts);

  if (conflicts.length > 0) {
    for (const conflict of conflicts) {
      if (priorConflictIds.has(conflict.conflict_id)) {
        continue;
      }
      await emitIngestAuditEvent({
        type: 'INGEST_CONFLICT_DETECTED',
        clinician_id,
        metadata: {
          conflict_id: conflict.conflict_id,
          conflict_type: conflict.conflict_type,
          sources: conflict.sources,
          values: conflict.values,
          status: conflict.status,
          detected_at: conflict.detected_at,
        },
      });
    }
  }

  return conflicts.map((conflict) => conflict.conflict_id);
}

function routePayload(route_key: string, payload: unknown): string {
  return resolveRequestHash(route_key, payload);
}

function parseResumeFiles(input: unknown): ResumeFileBody[] {
  if (!Array.isArray(input) || input.length === 0) {
    throw new Error('files is required');
  }

  return input.map((entry) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error('files must contain objects');
    }
    return entry as ResumeFileBody;
  });
}

async function emitErrorAuditEvent(input: {
  clinician_id: string;
  correlation_id: string;
  route: '/ingest/npi' | '/ingest/files';
  message: string;
  request_hash: string;
}): Promise<void> {
  await emitIngestAuditEvent({
    type: 'INGEST_ERROR',
    clinician_id: input.clinician_id,
    metadata: {
      route: input.route,
      message: input.message,
      request_hash: input.request_hash,
      correlation_id: input.correlation_id,
    },
  });
}

export function registerIngestRoutes(app: Express): void {
  app.post('/ingest/npi', apiKeyAuth, async (req: Request, res: Response) => {
    const correlation_id = requestCorrelationId(res);
    const body = (req.body ?? {}) as NpiBody;
    const clinician_id = parseOptionalStringField(body.clinician_id) ?? '';
    const request_hash = routePayload('POST:/ingest/npi', body);

    try {
      const resolvedClinicianId = resolveClinicianIdFromInput({
        clinician_id: body.clinician_id,
        npi: body.npi,
      });
      const normalizedClinicianId = parseStringField(resolvedClinicianId, 'clinician_id');
      const npi = parseStringField(body.npi, 'npi');
      const cached = readIdempotentResponse('POST:/ingest/npi', request_hash);
      if (cached) {
        return res.status(200).json({
          ...cached.payload,
          audit_ref: cached.audit_ref,
          request_hash,
          idempotent: true,
        });
      }

      const clinician_identity = await withNpiLookupToolSpan(
        {
          npi,
          input: { clinician_id: normalizedClinicianId },
        },
        () =>
          ingestNpiIdentity({
            clinician_id: normalizedClinicianId,
            npi,
            fetcher: (url, init) =>
              withHttpToolSpan(
                {
                  operation: 'nppes.lookup',
                  method: 'GET',
                  url,
                  input: { npi },
                },
                () => fetch(url, init),
              ),
          }),
      );
      upsertClinicianIdentity(clinician_identity);
      const conflict_ids = await detectAndPersistConflicts(normalizedClinicianId);

      const audit_ref = await emitIngestAuditEvent({
        type: 'NPI_INGESTED',
        clinician_id: normalizedClinicianId,
        metadata: {
          npi,
          source: 'NPPES',
          fetched_at: clinician_identity.fetched_at,
          request_hash,
          correlation_id,
        },
      });

      const payload = {
        clinician_identity: {
          ...clinician_identity,
          conflict_status: conflict_ids.length > 0 ? 'UNRESOLVED' : 'NONE',
        },
        conflicts: listIntakeConflicts(normalizedClinicianId),
      };
      writeIdempotentResponse('POST:/ingest/npi', request_hash, {
        audit_ref,
        payload,
      });

      return res.status(200).json({
        ...payload,
        audit_ref,
        request_hash,
        idempotent: false,
      });
    } catch (error) {
      const status = mapIngestErrorStatus(error);
      const message =
        error instanceof Error ? error.message : 'Unable to ingest NPI at this time';
      const derivedClinicianId =
        clinician_id || (parseOptionalStringField(body.npi) ? `clinician:npi:${body.npi}` : '');

      if (error instanceof NpiIngestError && error.code === 'INVALID_NPI_CHECKSUM') {
        await emitIngestAuditEvent({
          type: 'NPI_VALIDATION_FAILED',
          clinician_id: derivedClinicianId || 'clinician:unknown',
          metadata: {
            npi: body.npi ?? null,
            reason: 'INVALID_NPI_CHECKSUM',
            detected_at: new Date().toISOString(),
            request_hash,
            correlation_id,
          },
        });
      }

      if (derivedClinicianId) {
        await emitErrorAuditEvent({
          clinician_id: derivedClinicianId,
          correlation_id,
          route: '/ingest/npi',
          message,
          request_hash,
        });
      }
      return toJsonError(res, status, message);
    }
  });

  app.post('/ingest/files', apiKeyAuth, async (req: Request, res: Response) => {
    const correlation_id = requestCorrelationId(res);
    const body = (req.body ?? {}) as FilesBody;
    const clinician_id = parseOptionalStringField(body.clinician_id) ?? '';
    const request_hash = routePayload('POST:/ingest/files', body);

    try {
      const resolvedClinicianId = resolveClinicianIdFromInput({
        clinician_id: body.clinician_id,
        npi: (body as Record<string, unknown>).npi,
      });
      const normalizedClinicianId = parseStringField(resolvedClinicianId, 'clinician_id');
      const files = parseResumeFiles(body.files);
      const cached = readIdempotentResponse('POST:/ingest/files', request_hash);
      if (cached) {
        return res.status(200).json({
          ...cached.payload,
          audit_ref: cached.audit_ref,
          request_hash,
          idempotent: true,
        });
      }

      const extracted_at = new Date().toISOString();
      const normalizedFiles = files.map((file) => {
        const filename = parseStringField(file.filename, 'files[].filename');
        const mime_type = parseStringField(file.mime_type, 'files[].mime_type');
        const content_base64 = parseStringField(file.content_base64, 'files[].content_base64');
        return {
          filename,
          mime_type,
          content_base64,
          size_bytes: Buffer.byteLength(content_base64, 'base64'),
        };
      });

      const parsedCredentials = normalizedFiles.map((file) =>
        parseCandidateCredential({
          clinician_id: normalizedClinicianId,
          filename: file.filename,
          mime_type: file.mime_type,
          content_base64: file.content_base64,
          extracted_at,
        }),
      );

      appendCandidateCredentials(normalizedClinicianId, parsedCredentials);
      const conflict_ids = await detectAndPersistConflicts(normalizedClinicianId);

      for (const file of normalizedFiles) {
        await emitIngestAuditEvent({
          type: 'FILE_INGESTED',
          clinician_id: normalizedClinicianId,
          metadata: {
            filename: file.filename,
            mime_type: file.mime_type,
            size_bytes: file.size_bytes,
            request_hash,
            correlation_id,
          },
        });
      }

      const parseSummary = summarizeCandidateCredentials(parsedCredentials);
      const audit_ref = await emitIngestAuditEvent({
        type: 'INGEST_PARSE_SUMMARY',
        clinician_id: normalizedClinicianId,
        metadata: {
          fields_found: parseSummary.fields_found,
          fields_missing: parseSummary.fields_missing,
          candidate_credentials_count: parsedCredentials.length,
          request_hash,
          correlation_id,
        },
      });

      const payload = {
        candidate_credentials: parsedCredentials,
        total_candidate_credentials: listCandidateCredentials(normalizedClinicianId).length,
        conflicts: listIntakeConflicts(normalizedClinicianId),
        has_unresolved_conflicts: hasUnresolvedIntakeConflicts(normalizedClinicianId),
        conflict_ids,
      };

      writeIdempotentResponse('POST:/ingest/files', request_hash, {
        audit_ref,
        payload,
      });

      return res.status(200).json({
        ...payload,
        audit_ref,
        request_hash,
        idempotent: false,
      });
    } catch (error) {
      const status = mapIngestErrorStatus(error);
      const message =
        error instanceof Error ? error.message : 'Unable to ingest credential files at this time';
      const derivedClinicianId =
        clinician_id ||
        (parseOptionalStringField((body as Record<string, unknown>).npi)
          ? `clinician:npi:${(body as Record<string, unknown>).npi as string}`
          : '');
      if (derivedClinicianId) {
        await emitErrorAuditEvent({
          clinician_id: derivedClinicianId,
          correlation_id,
          route: '/ingest/files',
          message,
          request_hash,
        });
      }
      return toJsonError(res, status, message);
    }
  });
}
