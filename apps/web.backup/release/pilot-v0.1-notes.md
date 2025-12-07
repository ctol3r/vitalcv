# Pilot Release v0.1 - Release Notes

**Release Date**: TBD  
**Version**: 0.1.0  
**Status**: Pilot / Development

## Overview

This is the initial pilot release of the Chai VC Platform, focused on credential claim verification workflows for healthcare providers. This release provides core functionality for NPI validation, document upload, and claim status tracking.

## Features

### Backend APIs

#### NPI Lookup Service
- **Endpoint**: `POST /api/npi/lookup`
- **Description**: Validates and looks up National Provider Identifier (NPI) information from NPPES API
- **Features**:
  - NPI format validation
  - NPPES API integration with caching (Redis)
  - Database persistence (Prisma)
  - Audit logging

#### Claim Document Upload
- **Endpoint**: `POST /api/claim/doc`
- **Description**: Upload claim documents (multipart/form-data)
- **Features**:
  - File upload via Multer
  - NPI validation on upload
  - Initial claim creation
  - Status tracking

#### Claim Workflow Initiation
- **Endpoint**: `POST /api/claim/basic`
- **Description**: Kick off verification workflow
- **Features**:
  - Claim validation
  - OCR/liveness job queuing (stub)
  - Status progression (Level 2)
  - Audit logging

#### Claim Status Tracking
- **Endpoint**: `GET /api/claim/status`
- **Description**: Get claim status by statusId
- **Features**:
  - Real-time status updates
  - Status progression tracking
  - Level-based status (1: Uploaded, 2: Processing, 3: Attested)

### Frontend Components

#### ClaimWizard Component
- **Route**: `/start`
- **Description**: Multi-step wizard for claim submission
- **Features**:
  - Step 1: NPI validation
  - Step 2: Document upload
  - Step 3: Claim submission and status tracking
  - Real-time status polling
  - Error handling

### Infrastructure

#### Metrics & Monitoring
- **Endpoint**: `GET /metrics`
- **Description**: Prometheus metrics export
- **Metrics**:
  - Command execution counter
  - Command latency histogram
  - NPI lookup counter (cache hits/misses, successes, errors)

#### Audit Logging
- Event tracking for all critical operations
- PHI redaction support
- In-memory audit scrapbook (pilot)

## Technical Stack

### Backend
- **Framework**: Express.js (Node.js/TypeScript)
- **Database**: PostgreSQL with Prisma ORM
- **Cache**: Redis (ioredis)
- **File Upload**: Multer
- **Metrics**: Prometheus (prom-client)
- **Job Queue**: Bull (for future worker implementation)

### Frontend
- **Framework**: Next.js 14 (React/TypeScript)
- **Router**: App Router
- **State Management**: React Hooks

### DevOps
- **Containerization**: Docker Compose
- **CI/CD**: GitHub Actions (planned)

## Known Limitations

### Pilot Mode Restrictions
- In-memory storage for claims and statuses (not persistent across restarts)
- Stub implementations for:
  - OCR processing
  - ACA-Py integration
  - VC issuance
- No production-grade security hardening
- Limited error handling and recovery

### Missing Features
- Database persistence for claims (currently in-memory)
- Background job processing (worker implementation incomplete)
- User authentication and authorization
- Multi-tenant support
- Production deployment configuration

## Setup Instructions

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- PostgreSQL (via Docker)
- Redis (via Docker)

### Local Development

1. **Clone and Install**
   ```bash
   git clone <repo>
   cd backend && npm install
   cd ../frontend && npm install
   ```

2. **Environment Variables**
   - Copy `.env.example` to `.env` (if exists)
   - Configure database, Redis, and API keys

3. **Start Services**
   ```bash
   docker-compose up -d postgres redis
   cd backend && npx prisma migrate deploy
   npm run dev
   cd ../frontend && npm run dev
   ```

4. **Access**
   - Frontend: http://localhost:3001
   - Backend API: http://localhost:3000
   - Metrics: http://localhost:3000/metrics

## Testing

### Manual Testing
1. Navigate to `/start`
2. Enter a valid NPI (10 digits)
3. Upload test documents
4. Monitor status updates

### Automated Tests
- Backend: `cd backend && npm test`
- Frontend: `cd frontend && npm test`

## Documentation

- **API Documentation**: `docs/api/claim-api.md` (planned)
- **Developer Guide**: `README.dev.md` (planned)
- **Demo Runbook**: `docs/demo-runbook.md`
- **7-Week Plan**: `docs/7-week-plan.md`

## Security Notes

⚠️ **PILOT ONLY** - Not for production use

- No authentication required
- Limited input validation
- In-memory stores (no persistence)
- Stub implementations for critical security features
- PHI redaction is basic (not production-grade)

See `docs/privacy-notes.md` for HIPAA & privacy considerations.

## Support

### Troubleshooting
- See `docs/demo-runbook.md` for common issues
- Check logs: `docker-compose logs backend frontend`
- Health check: `curl http://localhost:3000/health`

### Known Issues
- [ ] Bolt publish error (dd290d24) - investigation needed
- [ ] Status polling may timeout after 30s
- [ ] File upload size limits not enforced

## Roadmap

### Next Release (v0.2)
- Database persistence for claims
- Worker implementation for background jobs
- Improved error handling
- Enhanced security features
- User authentication

### Future Releases
- Production deployment configuration
- Multi-tenant support
- Enhanced PHI redaction
- Full ACA-Py integration
- VC issuance workflow

## Changelog

### v0.1.0 (Initial Pilot)
- ✅ Backend route separation (npi, claimDoc, claimBasic, claimStatus)
- ✅ Frontend ClaimWizard component
- ✅ App Router page at `/start`
- ✅ Metrics endpoint
- ✅ Audit logging infrastructure
- ✅ NPI lookup with Redis caching
- ✅ File upload with Multer
- ✅ Status tracking workflow

## Contributors

[Add contributors]

## License

[Add license]

---

**⚠️ WARNING**: This is a pilot release. Not recommended for production use. See security notes above.
