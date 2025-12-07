# TEFCA Log Retention Policy

**B128B-TEFCA-025: TEFCA harness: mask/redact tests + rotation + retention docs**

## Overview

This document defines the log retention, rotation, and data masking policies for TEFCA (Trusted Exchange Framework and Common Agreement) interoperability logs.

## Retention Periods

### Log Files
- **Active Logs**: 30 days (configurable via `logRetentionDays`)
- **Archive Logs**: 90 days (configurable via `auditRetentionDays`)
- **Archive After**: 7 days (configurable via `archiveAfterDays`)
- **Delete After**: 365 days (configurable via `deleteAfterDays`)

### Audit Logs
- **Retention**: 90 days minimum (HIPAA compliance)
- **Archive**: After 30 days
- **Deletion**: After 1 year (unless legal hold applies)

### SSRAA Key Rotation Logs
- **Retention**: Indefinite (security audit trail)
- **Archive**: After 90 days
- **Compression**: After 30 days

## Log Rotation Schedule

### Daily Rotation
- **Frequency**: Daily at midnight UTC
- **File Naming**: `tefca-YYYY-MM-DD.log`
- **Compression**: Enabled for files older than 1 day
- **Max Files**: 30 (configurable via `maxFiles`)

### SSRAA Key Rotation
- **Frequency**: Daily at midnight UTC
- **Keys Rotated**:
  - SSRAA API Key
  - SSRAA Client Secret
  - SSRAA Authorization Token
- **Rotation Log**: `ssraa-key-rotation.log`
- **Notification**: Dependent services notified via webhook

## Data Masking & Redaction

### PHI/PII Patterns Masked

All logs are automatically masked for the following sensitive data types:

1. **SSN (Social Security Number)**
   - Pattern: `XXX-XX-XXXX`
   - Shows: Last 2 digits of middle group
   - Example: `123-45-6789` → `XXX-XX-45`

2. **Credit Card Numbers**
   - Pattern: `XXXX-XXXX-XXXX-XXXX`
   - Shows: Last 4 digits
   - Example: `4532-1234-5678-9010` → `XXXX-XXXX-XXXX-9010`

3. **Email Addresses**
   - Pattern: `XX***@domain.com`
   - Shows: First 2 characters of username + domain
   - Example: `john.doe@example.com` → `jo***@example.com`

4. **Phone Numbers**
   - Pattern: `XXX-XXX-XXXX`
   - Shows: Last 4 digits
   - Example: `(555) 123-4567` → `XXX-XXX-4567`

5. **Dates (DOB, etc.)**
   - Pattern: `[REDACTED_DATE]`
   - Shows: Nothing
   - Example: `01/15/1990` → `[REDACTED_DATE]`

6. **Medical Record Numbers (MRN)**
   - Pattern: `MRN:[REDACTED]`
   - Shows: Nothing
   - Example: `MRN: 12345678` → `MRN:[REDACTED]`

7. **IP Addresses**
   - Pattern: `[REDACTED_IP]`
   - Shows: Nothing
   - Example: `192.168.1.1` → `[REDACTED_IP]`

8. **Full Names**
   - Pattern: `[REDACTED_NAME]`
   - Shows: Nothing
   - Example: `John Smith` → `[REDACTED_NAME]`

9. **NPI (National Provider Identifier)**
   - Pattern: `XXXXXXXXXXXX`
   - Shows: First 2 and last 4 digits
   - Example: `1234567890` → `12XXXX7890`

10. **Account Numbers**
    - Pattern: `ACCT:[REDACTED]`
    - Shows: Nothing
    - Example: `Account: 1234567890` → `ACCT:[REDACTED]`

11. **Driver's License**
    - Pattern: `DL:[REDACTED]`
    - Shows: Nothing
    - Example: `DL: A1234567` → `DL:[REDACTED]`

12. **Passport Numbers**
    - Pattern: `PASSPORT:[REDACTED]`
    - Shows: Nothing
    - Example: `PASSPORT: 123456789` → `PASSPORT:[REDACTED]`

### Redaction Audit Trail

All redactions are logged with:
- Timestamp
- Event type: `PHI_REDACTION`
- Redaction count
- Source: `TEFCA_HARNESS`

Example redaction log:
```json
{
  "timestamp": "2025-11-12T10:00:00.000Z",
  "event": "PHI_REDACTION",
  "redactionCount": 5,
  "source": "TEFCA_HARNESS"
}
```

## Configuration

### Environment Variables

```bash
# Log Directory
TEFCA_LOG_DIR=./logs/tefca

# Rotation Settings
LOG_ROTATION_INTERVAL=daily
LOG_MAX_FILES=30
LOG_COMPRESS_OLD=true

# Retention Policy
LOG_RETENTION_DAYS=30
AUDIT_RETENTION_DAYS=90
ARCHIVE_AFTER_DAYS=7
DELETE_AFTER_DAYS=365

# SSRAA Key Rotation
SSRAA_KEY_ROTATION_ENABLED=true
SSRAA_KEY_ROTATION_INTERVAL=daily
```

### Programmatic Configuration

```typescript
import {
  DEFAULT_ROTATION_CONFIG,
  DEFAULT_RETENTION_POLICY,
  rotateLogs,
  applyRetentionPolicy,
  scheduleDailyRotation,
} from './harness';

// Custom rotation configuration
const rotationConfig = {
  logDirectory: './logs/tefca',
  rotationInterval: 'daily',
  maxFiles: 30,
  compressOldLogs: true,
};

// Custom retention policy
const retentionPolicy = {
  logRetentionDays: 30,
  auditRetentionDays: 90,
  archiveAfterDays: 7,
  deleteAfterDays: 365,
};

// Schedule daily rotation
scheduleDailyRotation();

// Manual rotation
await rotateLogs(rotationConfig);

// Apply retention policy
await applyRetentionPolicy(retentionPolicy, rotationConfig.logDirectory);
```

## Compliance

### HIPAA Compliance
- **Minimum Retention**: 6 years from creation or last use
- **Audit Logs**: Must be retained for compliance audits
- **PHI Masking**: All PHI must be masked in logs
- **Access Controls**: Logs must be access-controlled

### TEFCA Requirements
- **Interoperability Logs**: Must be retained for 90 days minimum
- **SSRAA Key Rotation**: Daily rotation required for security
- **Data Minimization**: Only necessary data should be logged
- **Encryption**: Logs must be encrypted at rest and in transit

### GDPR Compliance
- **Right to Erasure**: Logs containing personal data must be deletable
- **Data Minimization**: Only necessary data should be logged
- **Purpose Limitation**: Logs should only be used for intended purposes
- **Retention Limits**: Data should not be retained longer than necessary

## Monitoring & Alerts

### Rotation Monitoring
- **Success**: Log rotation completed successfully
- **Failure**: Log rotation failed (alert sent)
- **Metrics**: Number of files rotated, compressed, deleted

### Retention Monitoring
- **Compliance**: Retention policy compliance status
- **Breaches**: Files exceeding retention period
- **Alerts**: Automated alerts for retention breaches

### SSRAA Key Rotation Monitoring
- **Success**: Key rotation completed successfully
- **Failure**: Key rotation failed (critical alert)
- **Next Rotation**: Scheduled time for next rotation

## Testing

### Mask/Redact Tests
Run regex pattern tests:
```typescript
import { testMaskingPatterns } from './harness';

const results = testMaskingPatterns();
console.log(`Passed: ${results.passed}, Failed: ${results.failed}`);
```

### Rotation Tests
Test log rotation:
```bash
npm test -- harness.test.ts
```

### Retention Tests
Test retention policy:
```bash
npm test -- harness.test.ts -t "Retention Policy"
```

## Operations

### Daily Operations
1. **Midnight UTC**: Automatic log rotation and SSRAA key rotation
2. **Daily**: Review rotation logs for errors
3. **Weekly**: Verify retention policy compliance
4. **Monthly**: Audit log access and usage

### Manual Operations

#### Force Log Rotation
```typescript
import { rotateLogs } from './harness';
await rotateLogs();
```

#### Force Retention Policy Application
```typescript
import { applyRetentionPolicy } from './harness';
await applyRetentionPolicy();
```

#### Force SSRAA Key Rotation
```typescript
import { rotateSSRAAKeys } from './harness';
await rotateSSRAAKeys();
```

### Emergency Procedures

#### Log Breach Response
1. Identify compromised logs
2. Revoke access to log directory
3. Rotate SSRAA keys immediately
4. Notify security team
5. Audit log access history
6. Apply additional masking if needed

#### Retention Policy Violation
1. Identify files exceeding retention period
2. Apply retention policy immediately
3. Archive or delete as appropriate
4. Document violation and remediation
5. Review retention policy settings

## Audit Trail

All log operations are audited:
- **Log Rotation**: Timestamp, files rotated, files deleted
- **Retention Policy**: Timestamp, files deleted, files archived
- **SSRAA Key Rotation**: Timestamp, keys rotated, next rotation
- **Redactions**: Timestamp, redaction count, source

Audit logs are stored in:
- `logs/tefca/tefca-YYYY-MM-DD.log` (daily logs)
- `logs/tefca/ssraa-key-rotation.log` (key rotation logs)

## Support

For questions or issues:
- **Email**: security@vitalcv.com
- **Slack**: #tefca-support
- **On-Call**: PagerDuty escalation

## References

- [HIPAA Security Rule](https://www.hhs.gov/hipaa/for-professionals/security/index.html)
- [TEFCA Common Agreement](https://www.healthit.gov/topic/interoperability/policy/trusted-exchange-framework-and-common-agreement-tefca)
- [GDPR Article 5](https://gdpr-info.eu/art-5-gdpr/)
- [NIST SP 800-53 AU-11](https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final) (Log Retention)

---

**Last Updated**: 2025-11-12
**Version**: 1.0.0
**Owner**: Security & Compliance Team

