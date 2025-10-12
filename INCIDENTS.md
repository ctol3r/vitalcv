# Incident Response & Audit Log Retrieval

## Overview

VitalCV generates comprehensive audit logs for all security-relevant operations. This guide explains how to retrieve and analyze audit logs for incident investigation, debugging, and compliance audits.

## Audit Log Structure

All audit logs are output as structured JSON to stdout with the following format:

```json
{
  "timestamp": "2025-01-15T10:30:45.123Z",
  "level": "info",
  "event": "token.issued",
  "request_id": "req_abc123xyz789",
  "outcome": "success",
  "message": "Access token issued successfully",
  "metadata": {
    "credential_type": "MedicalLicense",
    "pkce_used": true,
    "ip_address": "192.168.1.100"
  }
}
```

### Key Fields

- **timestamp**: ISO 8601 timestamp
- **level**: Log severity (debug|info|warn|error|critical)
- **event**: Event type (22 types documented below)
- **request_id**: Unique identifier for tracing requests across services
- **outcome**: Result (success|failure|error)
- **metadata**: Event-specific contextual data

## Event Types

### OIDC4VCI Events

| Event | Description |
|-------|-------------|
| `offer.created` | Credential offer generated |
| `offer.expired` | Offer expired without being claimed |
| `token.issued` | Access token issued successfully |
| `token.rejected` | Token request rejected (invalid grant, PKCE failure) |
| `pkce.failed` | PKCE validation failed |
| `credential.issued` | Verifiable credential issued |
| `credential.rejected` | Credential request rejected |
| `nonce.generated` | c_nonce generated for proof |

### Verifier Events

| Event | Description |
|-------|-------------|
| `verification.requested` | Presentation verification initiated |
| `verification.success` | Credential verified successfully |
| `verification.failed` | Verification failed (invalid signature, revoked) |
| `dcql.processed` | DCQL selective disclosure processed |

### Security Events

| Event | Description |
|-------|-------------|
| `auth.failed` | Authentication failed (missing/invalid token) |
| `rate_limit.exceeded` | Rate limit exceeded for endpoint |
| `rate_limit.warning` | Rate limit threshold warning (80% reached) |

### System Events

| Event | Description |
|-------|-------------|
| `api.request` | API request received |
| `api.response` | API response sent |
| `api.error` | API error occurred |
| `health.check` | Health check performed |
| `redis.connect` | Redis connection established |
| `redis.error` | Redis operation failed |

## Retrieving Audit Logs

### Docker Compose Logs

```bash
# View real-time logs
docker-compose logs -f app

# Filter by request_id
docker-compose logs app | grep "req_abc123xyz789"

# Filter by event type
docker-compose logs app | grep "\"event\":\"token.issued\""

# Filter by level (errors only)
docker-compose logs app | grep "\"level\":\"error\""
```

### JSON Log Parsing

```bash
# Parse and pretty-print logs
docker-compose logs app --no-log-prefix | jq '.'

# Extract all failed events
docker-compose logs app --no-log-prefix | jq 'select(.outcome=="failure")'

# Count events by type
docker-compose logs app --no-log-prefix | jq -r '.event' | sort | uniq -c

# Find all requests for a specific credential type
docker-compose logs app --no-log-prefix | jq 'select(.metadata.credential_type=="MedicalLicense")'
```

### CloudWatch Logs (AWS)

```bash
# Query logs by request_id
aws logs filter-log-events \
  --log-group-name /aws/ecs/vitalcv \
  --filter-pattern '{ $.request_id = "req_abc123xyz789" }'

# Query credential issuance failures
aws logs filter-log-events \
  --log-group-name /aws/ecs/vitalcv \
  --filter-pattern '{ $.event = "credential.rejected" }'
```

## Common Incident Scenarios

### Scenario 1: Credential Issuance Failure

**Symptom**: User reports credential not being issued

**Investigation Steps**:

1. Get request_id from user or verify page UI
2. Search logs for all events with that request_id:
   ```bash
   docker-compose logs app | grep "req_abc123xyz789"
   ```
3. Check for these failure points:
   - `offer.expired`: Offer timed out (default 10 min)
   - `token.rejected`: PKCE failure or invalid grant
   - `credential.rejected`: Invalid proof or format

**Resolution**: Check metadata fields for specific error reasons

### Scenario 2: PKCE Validation Failure

**Symptom**: Token endpoint returns 401 Unauthorized

**Log Pattern**:
```json
{
  "event": "pkce.failed",
  "outcome": "failure",
  "message": "PKCE validation failed: code_verifier does not match",
  "metadata": {
    "code_challenge_method": "S256",
    "ip_address": "192.168.1.100"
  }
}
```

**Investigation**:
- Verify wallet is sending correct `code_verifier`
- Check if `code_challenge` was stored correctly during offer creation
- Ensure `code_challenge_method` is S256

### Scenario 3: Rate Limit Exceeded

**Symptom**: API returns 429 Too Many Requests

**Log Pattern**:
```json
{
  "event": "rate_limit.exceeded",
  "level": "warn",
  "message": "Rate limit exceeded",
  "metadata": {
    "endpoint": "/api/oidc4vci/token",
    "client_id": "192.168.1.100",
    "limit": 5,
    "window_ms": 60000
  }
}
```

**Resolution**:
- Check if legitimate traffic spike or potential attack
- Review rate limit configuration in `lib/middleware/rate-limit.ts`
- Consider scaling Redis or adjusting limits

### Scenario 4: Verification Failure

**Symptom**: Credential verification fails

**Investigation**:

1. Find verification request log:
   ```bash
   docker-compose logs app | jq 'select(.event=="verification.requested")'
   ```
2. Check subsequent failure event:
   ```json
   {
     "event": "verification.failed",
     "outcome": "failure",
     "metadata": {
       "credential_id": "CRED-12345",
       "reason": "Signature verification failed",
       "dcql_used": true
     }
   }
   ```
3. Common reasons:
   - Credential expired (check `expirationDate`)
   - Credential revoked (check StatusList2021)
   - Invalid signature (issuer key mismatch)
   - Tampered credential data

### Scenario 5: Authentication Failure

**Symptom**: API returns 401 with "invalid_token"

**Log Pattern**:
```json
{
  "event": "auth.failed",
  "level": "warn",
  "outcome": "failure",
  "metadata": {
    "reason": "Missing or invalid Authorization header",
    "error_code": "invalid_token",
    "endpoint": "/api/oidc4vci/credential"
  }
}
```

**Resolution**:
- Verify client is including `Authorization: Bearer <token>` header
- Check token was issued in previous `/token` request
- Ensure token hasn't expired (default 1 hour)

## Request Tracing

### Full Request Lifecycle

To trace a complete OIDC4VCI flow, search for all events with the same request_id:

```bash
docker-compose logs app | jq 'select(.request_id=="req_abc123xyz789")' | jq -s 'sort_by(.timestamp)'
```

**Expected flow**:
1. `offer.created` - Issuer generates offer
2. `token.issued` - Wallet exchanges code for token
3. `nonce.generated` - System generates c_nonce for proof
4. `credential.issued` - Credential issued to wallet

### Cross-Service Correlation

When integrating with external services (wallets, verifiers), use request_id to correlate:

- Frontend UI displays request_id in debug accordions
- API responses include `X-Request-ID` header
- Include request_id in support tickets

## Compliance & Retention

### HIPAA Compliance

Audit logs contain:
- **When**: Timestamp of all PHI access
- **Who**: IP address, subject_id (if provided)
- **What**: Operation type, credential type
- **Where**: Endpoint, service component
- **Result**: Success or failure with reason

### Log Retention

**Production**: Retain logs for minimum 6 years per HIPAA requirements

```bash
# Export logs for archival
docker-compose logs app --no-log-prefix > vitalcv-audit-$(date +%Y%m%d).json

# Compress and encrypt
gzip vitalcv-audit-*.json
gpg --encrypt --recipient compliance@vitalcv.com vitalcv-audit-*.json.gz
```

**Development**: Retain logs for 90 days

### Log Forwarding

Configure log forwarding to centralized systems:

**CloudWatch**:
```yaml
# docker-compose.yml
logging:
  driver: awslogs
  options:
    awslogs-group: /aws/ecs/vitalcv
    awslogs-region: us-east-1
    awslogs-stream-prefix: vitalcv
```

**DataDog**:
```bash
# .env.production
DATADOG_API_KEY=your-api-key
DATADOG_SITE=datadoghq.com
```

**Splunk**:
```yaml
logging:
  driver: splunk
  options:
    splunk-token: "{{SPLUNK_TOKEN}}"
    splunk-url: "https://splunk.example.com:8088"
    splunk-source: "vitalcv"
    splunk-format: "json"
```

## Security Considerations

### Sensitive Data

Audit logs **DO NOT** contain:
- Full credential payload (only metadata)
- Private keys or secrets
- Full PII (only hashed identifiers)

Audit logs **DO** contain:
- IP addresses (for security monitoring)
- Request IDs (for tracing)
- Timestamp and outcome (for compliance)

### Access Control

**Production**: Restrict log access to:
- Security team
- Compliance officers
- On-call engineers (during incidents)

```bash
# Set restrictive permissions
chmod 600 /var/log/vitalcv/*.log
chown vitalcv-admin:security /var/log/vitalcv/*.log
```

## Alerting

### Critical Alerts

Set up alerts for these patterns:

```bash
# Multiple authentication failures from same IP
docker-compose logs app | jq 'select(.event=="auth.failed")' | jq -r '.metadata.ip_address' | sort | uniq -c

# PKCE failures (potential attack)
docker-compose logs app | jq 'select(.event=="pkce.failed")' | wc -l

# System errors
docker-compose logs app | jq 'select(.level=="critical")'
```

### Example Alert Rules

**PagerDuty**:
- 5+ `auth.failed` events from same IP in 5 minutes → Page on-call
- Any `level=="critical"` event → Page immediately
- 10+ `rate_limit.exceeded` events in 1 minute → Warning alert

**Slack Webhook**:
```bash
# Alert on credential issuance failures
if jq 'select(.event=="credential.rejected")' | wc -l > 10; then
  curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
    -d '{"text": "⚠️ Multiple credential issuance failures detected"}'
fi
```

## Support

For incident response assistance:
- **Emergency**: security@vitalcv.com
- **Non-urgent**: support@vitalcv.com
- **GitHub Issues**: https://github.com/your-org/vitalcv/issues

Always include:
1. Request ID (if available)
2. Timestamp of incident
3. Affected credential type or user
4. Relevant log excerpts (sanitized)
