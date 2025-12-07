# Evidence Registry API

B110C-EVID-027: Evidence Registry seed (ambient-AI) + SHA256 anchor

## Overview

API server for Evidence Registry that provides:
- Evidence query endpoints (by DOI, tag, journal, ID)
- Evidence seeding endpoint with SHA256 hash anchoring
- On-chain anchor support via PolkadotService

## Endpoints

### GET /api/evidence/registry
Query evidence registry.

**Query Parameters:**
- `doi` - Filter by DOI
- `tag` - Filter by tag (e.g., `ambient-AI`)
- `journal` - Filter by journal (e.g., `JAMA`)
- `id` - Get single evidence by ID

**Example:**
```bash
curl "http://localhost:4005/api/evidence/registry?tag=ambient-AI&journal=JAMA"
```

### GET /api/evidence/registry/:id
Get single evidence by ID.

**Example:**
```bash
curl "http://localhost:4005/api/evidence/registry/clxyz123"
```

### POST /api/evidence/registry/seed
Seed evidence registry with JAMA ambient-AI study.

**Example:**
```bash
curl -X POST http://localhost:4005/api/evidence/registry/seed
```

**Response:**
```json
{
  "message": "Evidence Registry seeded successfully",
  "evidence": {
    "id": "clxyz123",
    "doi": "10.1001/jamanetworkopen.2025.34976",
    "hash": "sha256-hash-here",
    "chainTxHash": "0x..."
  }
}
```

## SHA256 Anchor

The seed endpoint:
1. Calculates SHA256 hash of `DOI + abstract`
2. Anchors hash on-chain via PolkadotService
3. Stores evidence record with hash and chainTxHash

## KPI Integration

The seeded evidence includes:
- `metadata.kpiReference: 'minutes-in-notes'` - Used by KPI dashboard
- `metadata.srLabel: 'JAMA Network Open 2025'` - Systematic Review label for tooltip
- `metadata.tags: ['ambient-AI', 'minutes-in-notes']` - For filtering

## Running

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build
npm run build

# Start production server
npm start
```

## Environment Variables

- `PORT` - Server port (default: 4005)
- `DATABASE_URL` - PostgreSQL connection string
- `POLKADOT_ENDPOINT` - Polkadot WebSocket endpoint (optional, uses mock if not provided)

