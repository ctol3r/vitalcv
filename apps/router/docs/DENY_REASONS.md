# Router Deny Reason Catalog

## Overview

The Router service uses standardized error codes for all denial reasons. This catalog provides a complete reference for all deny codes, their meanings, and how clients should handle them.

## Standardized Error Codes

All deny codes follow the format: `ROUTER_DENY_<CATEGORY>_<SPECIFIC>`

### Categories

- **MISSING**: Required fields or claims are missing
- **INVALID**: Invalid format or value
- **MISMATCH**: Value mismatch (audience, environment, etc.)
- **UNAUTHORIZED**: Authorization failures
- **SIGNATURE**: Signature verification failures
- **SYSTEM**: System or configuration errors

## Error Response Format

When a message is denied, the router returns a JSON response with the following structure:

```json
{
  "error": "ROUTER_DENY",
  "code": "ROUTER_DENY_MISSING_SINK_ID",
  "reason": "Missing sink ID",
  "description": "The message envelope does not contain a sink identifier...",
  "sink": "svc.example-service",
  "requestId": "req-1234567890",
  "hashAnchor": "abc123...",
  "retryable": false,
  "clientActionable": true
}
```

### Response Fields

- `error`: Always `"ROUTER_DENY"` for denied messages
- `code`: Standardized deny code (see catalog below)
- `reason`: Short human-readable message
- `description`: Detailed explanation of the error
- `sink`: The sink ID that was denied (if applicable)
- `requestId`: Request identifier for tracing
- `hashAnchor`: Hash anchor for audit trail
- `retryable`: Whether the client should retry the request
- `clientActionable`: Whether the client can fix the issue

## Deny Code Catalog

### Missing Fields

#### `ROUTER_DENY_MISSING_SINK_ID`
- **HTTP Status**: 400
- **Category**: missing
- **Retryable**: No
- **Client Actionable**: Yes
- **Description**: The message envelope does not contain a sink identifier. All messages must specify their intended destination sink.

#### `ROUTER_DENY_MISSING_SIGNATURE`
- **HTTP Status**: 401
- **Category**: missing
- **Retryable**: No
- **Client Actionable**: Yes
- **Description**: Signature verification is required for this router, but the message does not include a detached JWS signature.

#### `ROUTER_DENY_MISSING_AUDIENCE`
- **HTTP Status**: 400
- **Category**: missing
- **Retryable**: No
- **Client Actionable**: Yes
- **Description**: The message must include an audience claim matching the router environment (dev/staging/prod).

#### `ROUTER_DENY_MISSING_ALLOWED_SINKS`
- **HTTP Status**: 400
- **Category**: missing
- **Retryable**: No
- **Client Actionable**: Yes
- **Description**: The message must include an allowed_sinks claim specifying which sinks the producer authorizes.

### Invalid Format/Values

#### `ROUTER_DENY_INVALID_SINK_FORMAT`
- **HTTP Status**: 400
- **Category**: invalid
- **Retryable**: No
- **Client Actionable**: Yes
- **Description**: The sink ID does not match the expected format (e.g., svc.service-name or etl.pipeline-name).

#### `ROUTER_DENY_INVALID_SIGNATURE_FORMAT`
- **HTTP Status**: 400
- **Category**: invalid
- **Retryable**: No
- **Client Actionable**: Yes
- **Description**: The signature is not a valid JWT or detached JWS format.

#### `ROUTER_DENY_INVALID_PAYLOAD_FORMAT`
- **HTTP Status**: 400
- **Category**: invalid
- **Retryable**: No
- **Client Actionable**: Yes
- **Description**: The message payload is malformed or does not match the expected schema.

#### `ROUTER_DENY_INVALID_TIMESTAMP`
- **HTTP Status**: 400
- **Category**: invalid
- **Retryable**: No
- **Client Actionable**: Yes
- **Description**: The message timestamp is missing, invalid, or outside acceptable range.

### Mismatch Errors

#### `ROUTER_DENY_AUDIENCE_MISMATCH`
- **HTTP Status**: 403
- **Category**: mismatch
- **Retryable**: No
- **Client Actionable**: Yes
- **Description**: The message audience claim does not match the router environment. Expected audience for current environment does not match provided audience.

#### `ROUTER_DENY_ENVIRONMENT_MISMATCH`
- **HTTP Status**: 403
- **Category**: mismatch
- **Retryable**: No
- **Client Actionable**: Yes
- **Description**: The message environment claim does not match the router environment (dev/staging/prod).

#### `ROUTER_DENY_SINK_NOT_IN_ALLOWED_SINKS`
- **HTTP Status**: 403
- **Category**: mismatch
- **Retryable**: No
- **Client Actionable**: Yes
- **Description**: The target sink is not included in the producer's allowed_sinks claim, indicating the producer did not authorize routing to this sink.

### Authorization Failures

#### `ROUTER_DENY_SINK_NOT_ALLOWED`
- **HTTP Status**: 403
- **Category**: unauthorized
- **Retryable**: No
- **Client Actionable**: No
- **Description**: The target sink is not in the router's configured allowed_sinks list. This sink is not permitted by router policy.

#### `ROUTER_DENY_PRODUCER_SINK_NOT_ALLOWED`
- **HTTP Status**: 403
- **Category**: unauthorized
- **Retryable**: No
- **Client Actionable**: No
- **Description**: The producer's allowed_sinks claim does not include the target sink, indicating unauthorized routing intent.

### Signature Verification Failures

#### `ROUTER_DENY_SIGNATURE_INVALID`
- **HTTP Status**: 401
- **Category**: signature
- **Retryable**: No
- **Client Actionable**: Yes
- **Description**: The detached JWS signature is malformed or cannot be parsed.

#### `ROUTER_DENY_SIGNATURE_VERIFICATION_FAILED`
- **HTTP Status**: 401
- **Category**: signature
- **Retryable**: No
- **Client Actionable**: Yes
- **Description**: The signature verification failed. The signature may be invalid, expired, or signed with a different key.

#### `ROUTER_DENY_SIGNATURE_KEY_MISSING`
- **HTTP Status**: 500
- **Category**: signature
- **Retryable**: Yes
- **Client Actionable**: No
- **Description**: Signature verification is required but the router does not have a public key configured.

#### `ROUTER_DENY_SIGNATURE_ALGORITHM_MISMATCH`
- **HTTP Status**: 400
- **Category**: signature
- **Retryable**: No
- **Client Actionable**: Yes
- **Description**: The signature uses an algorithm that does not match the expected algorithm (expected EdDSA).

### System/Configuration Errors

#### `ROUTER_DENY_CONFIGURATION_ERROR`
- **HTTP Status**: 500
- **Category**: system
- **Retryable**: Yes
- **Client Actionable**: No
- **Description**: The router has a configuration error that prevents message processing.

#### `ROUTER_DENY_PUBLIC_KEY_NOT_CONFIGURED`
- **HTTP Status**: 500
- **Category**: system
- **Retryable**: Yes
- **Client Actionable**: No
- **Description**: Signature verification is required but no public key is configured in the router.

#### `ROUTER_DENY_ROUTER_ERROR`
- **HTTP Status**: 500
- **Category**: system
- **Retryable**: Yes
- **Client Actionable**: No
- **Description**: An internal error occurred while processing the message. This is a system error, not a message validation failure.

## API Endpoints

### Get Deny Reason Catalog

```http
GET /router/deny-reasons
```

Returns the complete catalog of all deny reason codes.

**Response:**
```json
{
  "catalog": {
    "ROUTER_DENY_MISSING_SINK_ID": { ... },
    ...
  },
  "codes": ["ROUTER_DENY_MISSING_SINK_ID", ...],
  "version": "1.0.0"
}
```

### Get Specific Deny Reason

```http
GET /router/deny-reasons/:code
```

Returns metadata for a specific deny reason code.

**Response:**
```json
{
  "code": "ROUTER_DENY_MISSING_SINK_ID",
  "message": "Missing sink ID",
  "description": "...",
  "httpStatus": 400,
  "category": "missing",
  "retryable": false,
  "clientActionable": true
}
```

## Client Handling Guidelines

### Client-Actionable Errors

When `clientActionable: true`, the client can fix the issue:

1. **Missing fields**: Add the required field to the message envelope
2. **Invalid format**: Fix the format of the field (e.g., sink ID format)
3. **Mismatch errors**: Update the claim to match the router environment
4. **Signature errors**: Regenerate the signature with correct key/algorithm

### Non-Client-Actionable Errors

When `clientActionable: false`, the error is due to router configuration:

1. **Sink not allowed**: Contact router administrator to add sink to allowlist
2. **System errors**: Log and retry if `retryable: true`, otherwise contact support

### Retry Logic

- **`retryable: false`**: Do not retry - fix the issue first
- **`retryable: true`**: May retry with exponential backoff (typically system errors)

## Examples

See `examples/client-example.ts` for a complete client implementation example.

