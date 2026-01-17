import { createLogger, type Logger } from './logger';
import { runWithLogContext, updateLogContext } from './context';

export interface RequestLike {
  headers?: Record<string, unknown>;
  user?: Record<string, any>;
  log?: Logger;
  requestId?: string;
  traceContext?: { trace_id: string; span_id: string; trace_flags: string };
  [key: string]: any;
}

export interface ResponseLike {
  setHeader(name: string, value: string): void;
}

export type NextFunctionLike = (err?: unknown) => void;

export interface RequestContextOptions {
  serviceName: string;
}

function extractHeader(headers: Record<string, unknown> | undefined, name: string): string | undefined {
  if (!headers) {
    return undefined;
  }
  const header = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(header)) {
    return header[0] as string;
  }
  return header as string | undefined;
}

function extractUserId(user: Record<string, any> | undefined): string | undefined {
  if (!user) {
    return undefined;
  }
  return user.id ?? user.userId ?? user.sub;
}

function extractOrgId(user: Record<string, any> | undefined): string | undefined {
  if (!user) {
    return undefined;
  }
  return user.orgId ?? user.organizationId ?? user.org?.id;
}

export function createRequestContextMiddleware(options: RequestContextOptions) {
  const baseLogger = createLogger({ service: options.serviceName });

  return (req: RequestLike, res: ResponseLike, next: NextFunctionLike) => {
    const headerRequestId =
      extractHeader(req.headers, 'x-request-id') ??
      extractHeader(req.headers, 'x-correlation-id');

    const requestId =
      headerRequestId ??
      `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

    const userId = extractUserId(req.user);
    const orgId = extractOrgId(req.user);

    // Extract trace context from request (set by tracing middleware)
    const traceId = req.traceContext?.trace_id;
    const spanId = req.traceContext?.span_id;

    try {
      res.setHeader('x-request-id', requestId);
    } catch {
      // ignore
    }

    const requestLogger = baseLogger.child({
      requestId,
      userId,
      orgId,
      ...(traceId && { trace_id: traceId }),
      ...(spanId && { span_id: spanId }),
    });

    req.requestId = requestId;
    req.log = requestLogger;

    runWithLogContext(
      {
        requestId,
        userId,
        orgId,
        service: options.serviceName,
        ...(traceId && { trace_id: traceId }),
        ...(spanId && { span_id: spanId }),
      },
      () => next(),
    );
  };
}

export function bindUserContextToRequest(
  req: RequestLike,
  context: { userId?: string; orgId?: string },
) {
  updateLogContext(context);
  if (req.log) {
    req.log = req.log.child({
      userId: context.userId,
      orgId: context.orgId,
    });
  }
}

