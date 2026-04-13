# Environment Configuration

This document describes the three VitalCV environments and their configuration.

## Environments

### 1. Local Development

**URL**: `localhost:3000`

**Purpose**: Developer workstations and local testing

**Database**: Local PostgreSQL (Docker)

**Configuration**:
```bash
NODE_ENV=development
DATABASE_URL=postgresql://postgres:password@localhost:5432/vitalcv_local
# Add other dev-specific config
```

**Rules**:
- All feature flags can be overridden
- Debug logging enabled
- Hot reload active
- No rate limiting

### 2. Staging

**URL**: `staging.vitalcv.io`

**Purpose**: Pre-production testing, feature validation

**Database**: Staging PostgreSQL instance

**Configuration**:
```bash
NODE_ENV=production
DATABASE_URL=postgresql://user:password@staging-db.vitalcv.io:5432/vitalcv_staging
# Add other staging-specific config
```

**Rules**:
- Feature flags at 100% for testing
- Production-like configuration
- Monitoring active
- Rate limiting enabled (relaxed)

### 3. Production

**URL**: `vitalcv.io`

**Purpose**: Live production environment

**Database**: Production PostgreSQL (with read replicas)

**Configuration**:
```bash
NODE_ENV=production
DATABASE_URL=postgresql://user:password@prod-db.vitalcv.io:5432/vitalcv_prod
DATABASE_READ_URL=postgresql://user:password@prod-db-read.vitalcv.io:5432/vitalcv_prod
# Add other production-specific config
```

**Rules**:
- Feature flags at gradual rollout
- Full monitoring and alerting
- Strict rate limiting
- No debug logging

## Required Environment Variables

### Core

- `NODE_ENV` - Environment (development/production)
- `DATABASE_URL` - Primary database connection string
- `DATABASE_READ_URL` - Read replica connection (production only)

### API Keys

- `NPPES_API_KEY` - NPI database API key
- `STATE_BOARD_API_KEY` - State board verification API key
- `OIG_API_KEY` - OIG exclusion list API key

### Security

- `JWT_SECRET` - JWT signing secret
- `SESSION_SECRET` - Session encryption secret
- `API_KEY` - Internal API authentication

### External Services

- `REDIS_URL` - Redis connection string
- `AWS_ACCESS_KEY_ID` - AWS credentials (if using S3)
- `AWS_SECRET_ACCESS_KEY` - AWS credentials (if using S3)
- `S3_BUCKET` - S3 bucket name (if using S3)

### Feature Flags

Feature flags can be overridden via environment variables:

```bash
# Enable specific feature
FEATURE_FLAGS__ENHANCED_READINESS_SUMMARY__enabled=true

# Set rollout percentage
FEATURE_FLAGS__EMPLOYER_RISK_INTELLIGENCE__rollout=50
```

## Security Rules

**NEVER commit these to the repository**:
- Database passwords
- API keys
- Secret keys
- Private keys
- Any credential or token

## Environment-Specific Behavior

### Logging

| Environment | Level | Destination |
|------------|-------|-------------|
| Local      | Debug | Console     |
| Staging    | Info  | Console + Logs |
| Production | Warn/Error | Logs + Monitoring Service |

### Rate Limiting

| Environment | Requests/Minute |
|------------|-----------------|
| Local      | Unlimited       |
| Staging    | 1000            |
| Production | 100             |

### Cache TTL

| Environment | Default TTL |
|------------|-------------|
| Local      | 5 minutes   |
| Staging    | 10 minutes  |
| Production | 1 hour      |

## Deployment Commands

### Staging

```bash
# Automatic deployment on merge to develop
# Manual deployment:
pnpm deploy:staging
```

### Production

```bash
# Requires explicit approval
pnpm deploy:production
```

## Rollback

If deployment fails:

```bash
# Revert to previous commit
pnpm deploy:rollback

# Or disable feature flags
# via admin panel or environment variables
```

## Monitoring

- Staging: `https://monitoring-staging.vitalcv.io`
- Production: `https://monitoring.vitalcv.io`

Check dashboards after each deployment.
