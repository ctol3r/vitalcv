# STATE-AGENT System Overview

**Purpose**: System intelligence generator & AI onboarding module for VitalCV

**Location**: `/packages/state-agent` + `/apps/api/src/state-agent`

**Version**: 1.0.0

---

## Overview

The STATE-AGENT system provides comprehensive system introspection and state reporting capabilities for VitalCV. It generates detailed reports about the monorepo structure, API endpoints, blockchain runtime, active services, and compliance posture. These reports are designed to help new AI agents understand the system architecture and current state.

---

## Core Components

### 1. Scanners (`/packages/state-agent/src/scanners/`)

**Monorepo Scanner** (`monorepo.ts`)
- Scans `pnpm-workspace.yaml` to discover workspaces
- Reads root `package.json` for metadata
- Counts packages and apps
- Discovers package dependencies

**API Routes Scanner** (`apiRoutes.ts`)
- Scans `/apps/api/src/routes` directory
- Extracts route patterns and HTTP methods
- Discovers middleware and services
- Builds comprehensive API map

**Substrate Scanner** (`substrate.ts`)
- Scans blockchain runtime configuration
- Discovers Substrate pallets
- Extracts validator count and chain ID
- Identifies runtime type

### 2. Collectors (`/packages/state-agent/src/collectors/`)

**Credential Registry Collector** (`credentialRegistry.ts`)
- Queries credential database tables
- Counts active/revoked credentials
- Tracks issuers and holders
- Lists credential types

**Audit Scrapbook Collector** (`auditScrapbook.ts`)
- Collects audit event history
- Groups events by type
- Tracks recent activity
- Verifies audit integrity

**OIDC Config Collector** (`oidc.ts`)
- Discovers OIDC/OID4VCI/OID4VP providers
- Lists supported flows
- Finds well-known endpoints

**FHIR Resources Collector** (`fhir.ts`)
- Scans FHIR gateway routes
- Lists available resources
- Checks conformance statement
- Tracks resource counts

**PSV Sources Collector** (`psv.ts`)
- Discovers Provider Source Verification connectors
- Lists active sources
- Tracks sync status

**Matching Engine Collector** (`matching.ts`)
- Identifies matching service components
- Lists AI matcher models
- Checks service availability

**Sanctions Graph Collector** (`sanctions.ts`)
- Queries sanctions graph database
- Counts nodes and edges
- Tracks update timestamps

### 3. Compliance Layer (`/packages/state-agent/src/compliance/`)

**Redaction Module** (`redaction.ts`)
- Detects PII/PHI patterns
- Applies GDPR peppered-hash policy
- Implements HIPAA-safe summaries
- Enforces POU (Purpose of Use) constraints
- Supports three compliance levels: `strict`, `standard`, `minimal`

### 4. Formatters (`/packages/state-agent/src/formatters/`)

**Markdown Formatter** (`markdown.ts`)
- Converts state report to Markdown
- Structured sections with headers
- Human-readable format
- Suitable for documentation

**JSON Formatter** (`json.ts`)
- Converts state report to JSON
- Machine-readable format
- Suitable for API responses

### 5. Narrative Generator (`/packages/state-agent/src/narrative/`)

**AI Narrative Layer** (`generator.ts`)
- Converts structured data into coherent narrative
- Explains system purpose and architecture
- Describes active modules and flows
- Highlights known gaps and priorities
- Provides task queue recommendations

### 6. Archival System (`/packages/state-agent/src/archival/`)

**Snapshot Management** (`snapshot.ts`)
- Saves snapshots to database (Postgres)
- Lists historical snapshots
- Compares snapshots for drift detection
- Tracks subsystem deltas

---

## API Usage

### Generate State Report

**Endpoint**: `GET /api/state-agent/report`

**Query Parameters**:
- `format`: `'json'` | `'markdown'` (default: `'json'`)
- `includeNarrative`: `'true'` | `'false'` (default: `'true'`)
- `complianceLevel`: `'strict'` | `'standard'` | `'minimal'` (default: `'standard'`)
- `pouRole`: string (default: `'Introspection'`)
- `waveNumber`: number (optional)
- `commitHash`: string (optional)

**Authentication**: Requires admin, state-agent, or internal-ai role, or `X-Internal-AI-Agent: true` header

**Example**:
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:4000/api/state-agent/report?format=json&includeNarrative=true"
```

### Trigger Wave Completion

**Endpoint**: `POST /api/state-agent/wave/complete`

**Body**:
```json
{
  "waveNumber": 42,
  "triggeredBy": "coordinator-agent"
}
```

**Response**:
```json
{
  "success": true,
  "waveNumber": 42,
  "snapshotPath": "/state-snapshots/wave-42-2025-01-15T10-30-00.md",
  "reportId": "wave-42-2025-01-15T10-30-00"
}
```

### List Snapshots

**Endpoint**: `GET /api/state-agent/snapshots`

**Query Parameters**:
- `waveNumber`: number (optional)
- `limit`: number (default: 50)
- `offset`: number (default: 0)

**Response**:
```json
[
  {
    "id": "uuid",
    "waveNumber": 42,
    "timestamp": "2025-01-15T10:30:00Z",
    "commitHash": "abc1234",
    "createdAt": "2025-01-15T10:30:00Z"
  }
]
```

---

## Redaction Rules

### PII Detection Patterns
- Social Security Numbers (SSN): `\d{3}-\d{2}-\d{4}`
- Email addresses: `[user]@[domain]`
- Phone numbers: `\d{3}-\d{3}-\d{4}`
- Dates (potential DOB): `\d{1,2}/\d{1,2}/\d{4}`

### PHI Detection Patterns
- Medical terminology: `patient`, `diagnosis`, `treatment`, `medical record`
- Medical codes: `ICD-10`, `CPT`, `HCPCS`

### Compliance Levels

**Strict**:
- All PII/PHI redacted
- Sensitive keys removed entirely
- Maximum privacy protection

**Standard**:
- PII redacted with context preservation (e.g., email domain kept)
- PHI redacted
- Balanced privacy and utility

**Minimal**:
- Only obvious PII redacted
- PHI warnings only
- Maximum utility

### POU Constraints

For `Introspection` role:
- No PII/PHI allowed
- Minimum necessary principle
- Aggregated data only

---

## Wave Lifecycle

### Wave Completion Hook

When a wave completes (manually triggered or from coordinator agent):

1. **Event Triggered**: `wave.complete` event with wave number
2. **State Report Generated**: Full system introspection
3. **Snapshot Saved**: Both Markdown and JSON formats
4. **Database Record**: Stored in `StateSnapshot` table (if exists)
5. **File System**: Saved to `/state-snapshots/` directory

### Snapshot Naming

Format: `wave-{waveNumber}-{timestamp}.{ext}`

Example: `wave-42-2025-01-15T10-30-00-000Z.md`

---

## Agent Onboarding Instructions

### For New AI Agents

1. **Request State Report**:
   ```bash
   GET /api/state-agent/report?format=json&includeNarrative=true
   ```

2. **Read Narrative Section**: Provides high-level system overview

3. **Review Architecture**: Understand subsystems, pipelines, and flows

4. **Check Compliance**: Verify POU constraints and redaction status

5. **Examine Metadata**: Review API routes, services, and packages

6. **Compare Snapshots**: If available, compare with previous snapshots to detect drift

### Integration Points

- **API Routes**: `/apps/api/src/routes/state-agent/`
- **Services**: `/apps/api/src/services/state-agent/`
- **Package**: `/packages/state-agent/`
- **Frontend UI**: `/apps/web/src/app/(admin)/state-agent/`

---

## Report Format

### State Report Structure

```typescript
{
  generatedAt: string;
  waveNumber?: number;
  commitHash?: string;
  timestamp: string;
  metadata: {
    monorepo: MonorepoMetadata;
    api: ApiMetadata;
    blockchain: BlockchainMetadata;
    services: ServiceMetadata[];
    packages: PackageMetadata[];
  };
  compliance: ComplianceMetadata;
  architecture: ArchitectureSummary;
  narrative?: string;
  version: string;
}
```

### Architecture Summary

- **Subsystems**: Active system components with purpose and status
- **Pipelines**: Active data processing pipelines
- **Endpoints**: Key API endpoints with descriptions
- **Flows**: Credential flows (VC, SD-JWT, OIDC, FHIR)
- **Compliance Posture**: GDPR/HIPAA compliance status

---

## CI/CD Integration

### Recommended CI Checks

1. **Monorepo Integrity**: Ensure all packages are discoverable
2. **API Route Validation**: Verify route registration
3. **Documentation Sync**: Check if architecture docs match code
4. **Compliance Verification**: Ensure redaction is applied

### Example CI Script

```bash
#!/bin/bash
# Generate state report and check for issues

npm run build --workspace=@vitalcv/state-agent
node -e "
  const { generateStateReport } = require('@vitalcv/state-agent');
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();

  generateStateReport(prisma, { complianceLevel: 'strict' })
    .then(report => {
      if (report.compliance.piiDetected || report.compliance.phiDetected) {
        console.error('PII/PHI detected in state report!');
        process.exit(1);
      }
      console.log('State report generated successfully');
      process.exit(0);
    });
"
```

---

## Troubleshooting

### Common Issues

1. **StateSnapshot table not found**
   - This is expected if the table hasn't been created in Prisma schema
   - Snapshots will still be saved to file system
   - Add table to schema if database archival is needed

2. **Git commit hash unavailable**
   - Occurs if not in a git repository
   - Report will still generate without commit hash

3. **Database queries fail**
   - Collectors gracefully handle missing tables
   - Returns safe defaults (0 counts, empty arrays)

4. **Route scanning misses routes**
   - Route scanner uses regex pattern matching
   - Some dynamic routes may not be detected
   - Manual route registration may be needed

---

## Future Enhancements

### Planned Features (SA-013 to SA-015)

- **Subsystem Drift Detector**: Compare snapshots to detect architecture changes
- **VitalCV Map Generator**: Generate SVG/Graphviz diagrams
- **Agent Readiness Launcher**: Auto-feed reports to new AI agents

---

## Security Considerations

- State reports contain system metadata, not user data
- PII/PHI redaction is applied by default
- Access is restricted to authorized roles
- Reports should not be exposed publicly
- Consider rate limiting for report generation

---

## License

Part of VitalCV platform. Internal use only.

