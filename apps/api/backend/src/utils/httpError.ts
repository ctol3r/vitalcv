/**
 * Structured HTTP error for consistent API error responses.
 *
 * All routes should use:
 *   throw new HttpError(code, message)
 *
 * The global error handler normalizes these into:
 *   { error: { code, message } }
 */
export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  /**
   * Extra machine-readable context, merged into the error body when present.
   *
   * Exists so a client can act on a refusal rather than just print it — a
   * field-level validation failure has to name its field for the surface to
   * attach the message to the right input instead of dumping it at the top of
   * a form. Omitted entirely when unset, so every existing error response is
   * byte-identical to what it was before.
   *
   * Not for anything sensitive: this is serialized straight to the caller.
   */
  readonly details?: Record<string, string>;

  constructor(status: number, message: string, code?: string, details?: Record<string, string>) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code ?? statusToCode(status);
    if (details) this.details = details;
  }
}

function statusToCode(status: number): string {
  switch (status) {
    case 400:
      return 'BAD_REQUEST';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 422:
      return 'UNPROCESSABLE_ENTITY';
    case 429:
      return 'RATE_LIMITED';
    case 500:
      return 'INTERNAL_ERROR';
    case 502:
      return 'SOURCE_UNAVAILABLE';
    case 503:
      return 'SERVICE_UNAVAILABLE';
    default:
      return 'ERROR';
  }
}

/**
 * Thrown when an upstream data source (NPPES, OIG/LEIE, etc.) cannot be reached.
 * Route handlers should catch this and return 502 with a clean
 * "Source Temporarily Unavailable" message — never fake data.
 */
export class SourceUnavailableError extends HttpError {
  readonly source: string;
  readonly sourceUrl: string;

  constructor(source: string, sourceUrl: string, detail?: string) {
    super(
      502,
      detail
        ? `${source} source temporarily unavailable: ${detail}`
        : `${source} source temporarily unavailable`,
      'SOURCE_UNAVAILABLE',
    );
    this.name = 'SourceUnavailableError';
    this.source = source;
    this.sourceUrl = sourceUrl;
  }
}
