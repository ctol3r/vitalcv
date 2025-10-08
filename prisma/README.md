# VitalCV Database Schema

This directory contains the Prisma schema and migrations for the VitalCV verifiable credentials platform.

## Schema Overview

The database is designed to support W3C Verifiable Credentials with the following key models:

### Core Models

- **User**: User accounts with DID authentication support
- **Issuer**: Trusted issuer registry for credential issuance
- **CredentialSchema**: Credential type definitions and JSON schemas
- **Credential**: Verifiable credentials with W3C VC format support

### Authentication & Security

- **AuthChallenge**: DID authentication challenges (challenge-response flow)
- **Session**: User session management with JWT tokens
- **RateLimit**: API rate limiting tracking

### Verification & Audit

- **Verification**: Audit trail for credential verifications
- **PerformanceMetric**: Core Web Vitals tracking
- **ErrorLog**: Application error tracking and monitoring

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Database

Update `.env` with your PostgreSQL connection string:

```bash
DATABASE_URL="postgresql://user:password@localhost:5432/vitalcv?schema=public"
```

For local development, you can use Docker:

```bash
docker run --name vitalcv-postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=vitalcv \
  -p 5432:5432 \
  -d postgres:16-alpine
```

### 3. Run Migrations

Create and apply migrations:

```bash
# Create initial migration
npx prisma migrate dev --name init

# Apply migrations to production
npx prisma migrate deploy
```

### 4. Generate Prisma Client

```bash
npx prisma generate
```

### 5. Seed Database (Optional)

Create seed data for development:

```bash
npx prisma db seed
```

## Database Commands

### View Database in Prisma Studio

```bash
npx prisma studio
```

This opens a GUI at http://localhost:5555 to browse and edit data.

### Reset Database

```bash
npx prisma migrate reset
```

⚠️ **Warning**: This will delete all data and re-run migrations.

### Create Migration

```bash
npx prisma migrate dev --name <migration-name>
```

### Format Schema

```bash
npx prisma format
```

## Schema Features

### DID Authentication

The schema supports Decentralized Identifier (DID) authentication:

- Users have a unique `did` field
- `AuthChallenge` model stores challenge-response data
- Challenges expire after 5 minutes
- Public keys stored for signature verification

### Credential Privacy Modes

Credentials support three privacy modes:

1. **Plain**: Full disclosure (all fields visible)
2. **BBS+**: Selective disclosure (choose which fields to reveal)
3. **ZKP**: Zero-knowledge proofs (prove properties without revealing data)

### Audit Trail

All credential verifications are logged:

- Timestamp of verification
- Verifier DID
- Presentation type (full, selective, zkp)
- Revealed fields (for selective disclosure)
- Result (valid, invalid, expired, revoked)
- IP address and user agent

### Performance Monitoring

Core Web Vitals are tracked:

- LCP (Largest Contentful Paint)
- FID (First Input Delay)
- CLS (Cumulative Layout Shift)
- FCP (First Contentful Paint)
- TTFB (Time to First Byte)

## Indexes

All models have appropriate indexes for:

- Primary lookups (DID, credential ID, etc.)
- Common queries (status, expiry dates)
- Foreign key relationships
- Time-based queries (created_at, expires_at)

## Relationships

```
User
├── sessions (1:N)
├── issuedCredentials (1:N)
├── ownedCredentials (1:N)
├── verifications (1:N)
└── challenges (1:N)

Credential
├── schema (N:1)
├── issuer (N:1)
├── issuerUser (N:1, optional)
├── subjectUser (N:1, optional)
└── verifications (1:N)
```

## Migration Strategy

### Development

- Use `prisma migrate dev` for iterative schema changes
- Migrations are created automatically with descriptive names
- Database is reset if needed

### Production

- Use `prisma migrate deploy` in CI/CD pipeline
- Never use `migrate dev` or `db push` in production
- Always review migrations before deploying
- Keep migrations small and focused

## Best Practices

1. **Never modify existing migrations** - create new ones instead
2. **Use transactions** for multi-step operations
3. **Index frequently queried fields** - already done in schema
4. **Use soft deletes** for audit trail (revoked flag instead of DELETE)
5. **Encrypt sensitive data** - use `encryptedData` field for PII
6. **Validate data** - use Zod schemas before Prisma operations
7. **Monitor query performance** - use Prisma logging in development

## Troubleshooting

### Connection Errors

```bash
# Check if PostgreSQL is running
pg_isready -h localhost -p 5432

# Test connection
psql -h localhost -U user -d vitalcv
```

### Migration Conflicts

```bash
# Mark migration as applied (if already applied manually)
npx prisma migrate resolve --applied <migration-name>

# Mark migration as rolled back
npx prisma migrate resolve --rolled-back <migration-name>
```

### Schema Drift

```bash
# Check for drift between schema and database
npx prisma migrate diff

# Push schema changes without creating migration (dev only)
npx prisma db push
```

## Security Considerations

1. **Never commit `.env`** - use `.env.example` as template
2. **Use strong passwords** for database users
3. **Enable SSL** for production database connections
4. **Limit database user permissions** - use least privilege
5. **Regular backups** - automate with pg_dump or cloud provider
6. **Encrypt at rest** - enable PostgreSQL encryption
7. **Monitor access logs** - track database connections

## Resources

- [Prisma Documentation](https://www.prisma.io/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [W3C Verifiable Credentials](https://www.w3.org/TR/vc-data-model/)
- [DID Core Specification](https://www.w3.org/TR/did-core/)
