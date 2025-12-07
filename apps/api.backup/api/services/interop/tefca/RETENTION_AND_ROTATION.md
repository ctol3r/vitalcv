# TEFCA Harness: Data Masking, Rotation, and Retention Policy

**Task**: B127B-TEFCA-025: TEFCA harness mask/redact tests + rotation + retention docs

This document describes the data masking, log rotation, and retention policies implemented in the TEFCA interoperability harness.

## Overview

The TEFCA (Trusted Exchange Framework and Common Agreement) harness implements comprehensive PHI/PII protection through:
1. **Data Masking/Redaction**: Automated masking of sensitive data in logs
2. **Daily Log Rotation**: Automatic rotation of log files with SSRAA key rotation
3. **30-Day Retention Policy**: Compliance-oriented retention and archival

## Data Masking Patterns

### Supported Patterns

The harness masks/redacts the following types of sensitive data:

| Data Type | Pattern | Example | Masked Output | Description |
|-----------|---------|---------|---------------|-------------|
| SSN | `XXX-XX-XXXX` | 123-45-6789 | XXX-XX-6789 | Shows only last 4 digits |
| Credit Card | 16 digits | 4532-1234-5678-9010 | XXXX-XXXX-XXXX-9010 | Shows only last 4 digits |
| Email | username@domain | john.doe@example.com | jo***@example.com | Masks username, keeps domain |
| Phone | (XXX) XXX-XXXX | (555) 123-4567 | XXX-XXX-4567 | Shows only last 4 digits |
| Date | MM/DD/YYYY | 01/15/1990 | [REDACTED_DATE] | Fully redacted |
| MRN | MRN: number | MRN: 12345678 | MRN:[REDACTED] | Fully redacted |
| IP Address | IPv4 | 192.168.1.1 | [REDACTED_IP] | Fully redacted |
| Full Name | First Last | John Smith | [REDACTED_NAME] | Fully redacted |
| NPI | 10 digits | 1234567890 | 12XXXX7890 | Shows first 2 and last 4 digits |
| Account Number | ACCT: number | Account: 1234567890 | ACCT:[REDACTED] | Fully redacted |
| Driver's License | DL: alphanumeric | DL: A1234567 | DL:[REDACTED] | Fully redacted |
| Passport | PASSPORT: alphanumeric | PASSPORT: A12345678 | PASSPORT:[REDACTED] | Fully redacted |

### Usage

```typescript
import { maskSensitiveData } from './services/interop/tefca/harness';

const rawLog = 'Patient John Smith, SSN: 123-45-6789, Phone: 555-123-4567';
const maskedLog = maskSensitiveData(rawLog);
// Output: "Patient [REDACTED_NAME], SSN: XXX-XX-6789, Phone: XXX-XXX-4567"
```

### Testing Patterns

The `testMaskingPatterns()` function validates all regex patterns against test cases:

```typescript
import { testMaskingPatterns } from './services/interop/tefca/harness';

const results = testMaskingPatterns();
console.log(`Passed: ${results.passed}, Failed: ${results.failed}`);
// Review results.results for detailed test output
```

## Log Rotation

### Daily Rotation Schedule

Logs rotate automatically at midnight (00:00:00 local time) every day.

**Configuration:**
```typescript
export const DEFAULT_ROTATION_CONFIG: LogRotationConfig = {
  logDirectory: process.env.TEFCA_LOG_DIR || './logs/tefca',
  rotationInterval: 'daily',
  maxFiles: 30, // Keep 30 days of logs
  compressOldLogs: true,
};
```

### Rotation Process

1. **New Log File**: Creates a new log file for each day named `tefca-YYYY-MM-DD.log`
2. **Old File Management**: Keeps the most recent `maxFiles` log files
3. **Cleanup**: Automatically deletes log files older than the `maxFiles` limit
4. **Compression**: Marks old log files for gzip compression (optional)

### SSRAA Key Rotation

**B121A-TEFCA-007**: SSRAA (Secure Service Registry and Authorization Agent) keys rotate daily alongside log files.

**Keys Rotated:**
- `SSRAA_API_KEY`
- `SSRAA_CLIENT_SECRET`
- `SSRAA_AUTHORIZATION_TOKEN`

**Rotation Log Location:** `logs/tefca/ssraa-key-rotation.log`

### Scheduling Rotation

```typescript
import { scheduleDailyRotation } from './services/interop/tefca/harness';

// Schedule automatic daily rotation at midnight
scheduleDailyRotation();
```

## Retention Policy

### 30-Day Retention (Default)

**Configuration:**
```typescript
export const DEFAULT_RETENTION_POLICY: RetentionPolicy = {
  logRetentionDays: 30,      // Keep logs for 30 days
  auditRetentionDays: 90,    // Keep audit logs for 90 days
  archiveAfterDays: 7,        // Archive after 7 days
  deleteAfterDays: 365,       // Delete after 1 year
};
```

### Retention Lifecycle

| Age | Action | Description |
|-----|--------|-------------|
| 0-7 days | **Active** | Logs remain in active directory |
| 7-30 days | **Archived** | Logs compressed and marked for archival |
| 30-365 days | **Long-term Retention** | Logs kept for audit/compliance purposes |
| 365+ days | **Deleted** | Logs permanently deleted |

### Applying Retention Policy

```typescript
import { applyRetentionPolicy } from './services/interop/tefca/harness';

// Apply retention policy manually
const result = await applyRetentionPolicy();
console.log(`Deleted: ${result.deleted}, Archived: ${result.archived}, Kept: ${result.kept}`);
```

### Automated Retention

Retention policies are applied automatically during the daily log rotation process.

## Audit and Compliance

### Redaction Logging

**B121A-TEFCA-007**: All redactions are logged with timestamp and source for audit purposes.

**Redaction Log Format:**
```json
{
  "timestamp": "2025-11-12T10:00:00.000Z",
  "event": "PHI_REDACTION",
  "redactionCount": 3,
  "source": "TEFCA_HARNESS"
}
```

### Log Entry Format

Each log entry includes:
- **Timestamp**: ISO 8601 format
- **Hash**: SHA-256 hash (first 16 characters) of masked content
- **Masked Data**: All sensitive fields redacted according to masking patterns

**Example:**
```json
{
  "timestamp": "2025-11-12T10:00:00.000Z",
  "hash": "a1b2c3d4e5f6g7h8",
  "event": "TEFCA_EXCHANGE",
  "patient": "[REDACTED_NAME]",
  "ssn": "XXX-XX-6789"
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TEFCA_LOG_DIR` | `./logs/tefca` | Directory for TEFCA logs |
| `PAGERDUTY_INTEGRATION_KEY` | (none) | PagerDuty key for alerts |

## Testing

### Unit Tests

Run the comprehensive test suite:

```bash
npm test services/interop/tefca/__tests__/harness.test.ts
```

**Test Coverage:**
- ✅ All masking patterns validated
- ✅ Log rotation functionality
- ✅ 30-day retention policy
- ✅ Redaction logging
- ✅ SSRAA key rotation

### Manual Testing

Test masking patterns:
```typescript
import { testMaskingPatterns } from './services/interop/tefca/harness';

const results = testMaskingPatterns();
console.log(results);
```

## Security Considerations

1. **PHI Protection**: All PHI/PII is masked before writing to logs
2. **Key Rotation**: SSRAA keys rotate daily to minimize exposure
3. **Retention Compliance**: 30-day retention aligns with HIPAA minimum requirements
4. **Audit Trail**: All redactions and rotations are logged for compliance audits
5. **Access Control**: Log directory should have restricted permissions (0700)

## Compliance References

- **HIPAA**: 18 PHI identifiers covered by masking patterns
- **TEFCA**: Secure exchange requirements for interoperability
- **SSRAA**: Daily key rotation for authorization agents

## Troubleshooting

### Logs Not Rotating

**Check:**
1. `scheduleDailyRotation()` is called during application startup
2. Application has write permissions to log directory
3. System time is correct

### Masking Not Working

**Check:**
1. Regex patterns are correctly configured in `MASKING_PATTERNS`
2. Run `testMaskingPatterns()` to verify pattern functionality
3. Review test failures for pattern adjustments

### Retention Policy Not Applied

**Check:**
1. Retention policy is configured correctly
2. File system allows file deletion
3. Check application logs for retention errors

## References

- **Implementation**: `services/interop/tefca/harness.ts`
- **Tests**: `services/interop/tefca/__tests__/harness.test.ts`
- **TEFCA Routes**: `services/interop/tefca/routes.ts`

## Changelog

- **B127B-TEFCA-025**: Initial documentation for mask/redact, rotation, and retention
- **B121A-TEFCA-007**: Added SSRAA key rotation and redaction logging
- **B108B-TEFCA-027**: Implemented regex pattern tests

---

**Last Updated**: 2025-11-12
**Task**: B127B-TEFCA-025
**Status**: ✅ Complete

