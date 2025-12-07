# API Integration Guide

This document provides detailed specifications for all backend API endpoints required by the governance and audit features.

## 🔐 Authentication

All API requests should include authentication:

```typescript
headers: {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
}
```

## 📋 API Endpoints

### 1. Organization Security Status

**Endpoint:** `GET /api/org/security/status`

**Purpose:** Retrieve overall security and governance status for the dashboard

**Response:**
```json
{
  "status": {
    "policiesAccepted": false,
    "lastPolicyAcceptedAt": "2025-11-01T10:00:00Z",
    "pendingPolicyVersion": "2.1.0",
    "twoFactorEnabled": true,
    "twoFactorEnrollmentRate": 68,
    "rolesConfigured": true,
    "totalRoles": 6,
    "customRoles": 0,
    "totalMembers": 45,
    "membersWithRoles": 42,
    "recentAuditEvents": 1247,
    "lastAuditExport": "2025-11-01"
  }
}
```

---

### 2. List Roles

**Endpoint:** `GET /api/org/roles`

**Purpose:** Get all roles in the organization

**Query Parameters:**
- `search` (optional): Filter roles by name or description

**Response:**
```json
{
  "roles": [
    {
      "id": "role-001",
      "name": "OrgAdmin",
      "description": "Full administrative access",
      "permissionsCount": 15,
      "membersCount": 3,
      "permissions": ["perm1", "perm2"],
      "isSystemRole": true,
      "riskLevel": "critical"
    }
  ]
}
```

---

### 3. Get Role Details

**Endpoint:** `GET /api/org/roles/{roleId}`

**Purpose:** Get detailed information about a specific role

**Response:**
```json
{
  "role": {
    "id": "role-001",
    "name": "OrgAdmin",
    "description": "Full administrative access",
    "isSystemRole": true,
    "membersCount": 3,
    "permissions": ["perm1", "perm2", "perm3"]
  }
}
```

---

### 4. Update Role Permissions

**Endpoint:** `PATCH /api/org/roles/{roleId}`

**Purpose:** Update the permissions assigned to a role

**Request Body:**
```json
{
  "permissions": ["perm1", "perm2", "perm3"]
}
```

**Response:**
```json
{
  "role": {
    "id": "role-001",
    "name": "OrgAdmin",
    "permissions": ["perm1", "perm2", "perm3"],
    "updatedAt": "2025-11-13T14:30:00Z"
  }
}
```

---

### 5. List Available Permissions

**Endpoint:** `GET /api/org/permissions`

**Purpose:** Get all available permissions that can be assigned to roles

**Response:**
```json
{
  "permissions": [
    {
      "id": "perm1",
      "name": "org.members.read",
      "description": "View organization members",
      "category": "Organization",
      "riskLevel": "low"
    },
    {
      "id": "perm2",
      "name": "org.members.write",
      "description": "Add or remove members",
      "category": "Organization",
      "riskLevel": "high"
    }
  ]
}
```

---

### 6. List Organization Members

**Endpoint:** `GET /api/org/members`

**Purpose:** Get all members in the organization

**Query Parameters:**
- `search` (optional): Filter by name or email
- `roleId` (optional): Filter by assigned role

**Response:**
```json
{
  "members": [
    {
      "id": "user-001",
      "name": "Alice Johnson",
      "email": "alice@example.com",
      "currentRoles": ["role-001", "role-005"],
      "joinedAt": "2024-01-15T00:00:00Z",
      "lastActive": "2025-11-12T10:30:00Z"
    }
  ]
}
```

---

### 7. Update Member Roles

**Endpoint:** `PUT /api/org/members/{memberId}/roles`

**Purpose:** Assign or remove roles for a specific member

**Request Body:**
```json
{
  "roleIds": ["role-001", "role-005"]
}
```

**Response:**
```json
{
  "member": {
    "id": "user-001",
    "name": "Alice Johnson",
    "email": "alice@example.com",
    "currentRoles": ["role-001", "role-005"],
    "updatedAt": "2025-11-13T14:35:00Z"
  }
}
```

---

### 8. Get Latest Policy

**Endpoint:** `GET /api/org/{orgId}/policies/latest`

**Purpose:** Get the latest policy version and acceptance status

**Response:**
```json
{
  "policy": {
    "id": "policy-001",
    "version": "2.1.0",
    "title": "Updated Privacy and Data Protection Policy",
    "publishedAt": "2025-11-10T00:00:00Z",
    "content": "# Policy Content...",
    "requiresAcceptance": true
  },
  "accepted": false
}
```

---

### 9. Accept Policy

**Endpoint:** `POST /api/org/{orgId}/policies/{policyId}/accept`

**Purpose:** Mark a policy as accepted by the current user

**Response:**
```json
{
  "acceptance": {
    "policyId": "policy-001",
    "userId": "user-001",
    "acceptedAt": "2025-11-13T14:40:00Z"
  }
}
```

---

### 10. Get Access Logs

**Endpoint:** `GET /api/org/audit/access-logs`

**Purpose:** Retrieve access logs for security monitoring

**Query Parameters:**
- `actionType` (optional): Filter by event type (authentication, access_control, data_access, configuration, api_key)
- `startDate` (optional): ISO date string
- `endDate` (optional): ISO date string
- `limit` (optional): Number of logs to return (default: 100)
- `offset` (optional): Pagination offset

**Response:**
```json
{
  "logs": [
    {
      "id": "log-001",
      "actor": {
        "id": "user-001",
        "name": "Alice Johnson",
        "email": "alice@example.com"
      },
      "action": "Logged in successfully",
      "actionType": "authentication",
      "resource": "Auth Service",
      "resourceType": "authentication",
      "timestamp": "2025-11-13T14:32:15Z",
      "outcome": "success",
      "ipAddress": "192.168.1.100",
      "userAgent": "Mozilla/5.0...",
      "relatedLink": "/org/settings/members"
    }
  ],
  "pagination": {
    "total": 1247,
    "limit": 100,
    "offset": 0,
    "hasMore": true
  }
}
```

---

### 11. Export Audit Logs

**Endpoint:** `POST /api/org/audit/export`

**Purpose:** Export audit logs in CSV or NDJSON format

**Request Body:**
```json
{
  "startDate": "2025-11-01",
  "endDate": "2025-11-13",
  "eventTypes": [
    "auth.login",
    "auth.logout",
    "role.assigned",
    "credential.viewed"
  ],
  "format": "csv"
}
```

**Response:**
- Content-Type: `text/csv` or `application/x-ndjson`
- Content-Disposition: `attachment; filename="audit-export-2025-11-01-to-2025-11-13.csv"`
- Body: File content

**CSV Format:**
```csv
Timestamp,Actor Name,Actor Email,Action,Action Type,Resource,Outcome,IP Address
2025-11-13T14:32:15Z,Alice Johnson,alice@example.com,Logged in,authentication,Auth Service,success,192.168.1.100
```

**NDJSON Format:**
```json
{"timestamp":"2025-11-13T14:32:15Z","actorName":"Alice Johnson","actorEmail":"alice@example.com","action":"Logged in","actionType":"authentication","resource":"Auth Service","outcome":"success","ipAddress":"192.168.1.100"}
{"timestamp":"2025-11-13T14:15:42Z","actorName":"Bob Smith","actorEmail":"bob@example.com","action":"Assigned role","actionType":"access_control","resource":"Member: Carol","outcome":"success","ipAddress":"192.168.1.101"}
```

---

## 🛠️ Implementation Example

### Next.js API Route Handler (Example)

Create `apps/web/src/app/api/org/roles/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Get auth token from request
    const token = request.headers.get('authorization')?.replace('Bearer ', '')

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Forward request to backend API
    const backendUrl = process.env.BACKEND_API_URL
    const response = await fetch(`${backendUrl}/api/org/roles`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      throw new Error('Backend API error')
    }

    const data = await response.json()
    return NextResponse.json(data)

  } catch (error) {
    console.error('Error fetching roles:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

---

## 🔒 Authorization Requirements

### Role-Based Access Control

| Feature | Required Role/Permission |
|---------|-------------------------|
| View Security Dashboard | `OrgAdmin`, `AuditViewer` |
| View Roles List | `OrgAdmin`, `MemberViewer` |
| Edit Role Permissions | `OrgAdmin` |
| View Members | `OrgAdmin`, `MemberViewer` |
| Assign Roles | `OrgAdmin` |
| View Access Logs | `OrgAdmin`, `AuditViewer` |
| Export Audit Logs | `OrgAdmin`, `AuditViewer` |
| Accept Policies | `OrgAdmin` (only) |

### Backend Authorization Check Example

```typescript
// Middleware example
export async function checkPermission(
  userId: string,
  requiredPermission: string
): Promise<boolean> {
  // Get user's roles
  const userRoles = await getUserRoles(userId)

  // Get permissions for each role
  const permissions = await getRolePermissions(userRoles)

  // Check if user has required permission
  return permissions.includes(requiredPermission)
}
```

---

## 📊 Event Types Reference

### Authentication Events
- `auth.login` - Successful login
- `auth.logout` - User logout
- `auth.failed` - Failed login attempt
- `auth.2fa.enabled` - 2FA enabled
- `auth.2fa.disabled` - 2FA disabled

### Access Control Events
- `role.assigned` - Role assigned to member
- `role.removed` - Role removed from member
- `permission.changed` - Role permissions modified
- `role.created` - New role created
- `role.deleted` - Role deleted

### Data Access Events
- `credential.viewed` - Credential accessed
- `credential.verified` - Credential verified
- `phi.accessed` - PHI accessed
- `document.downloaded` - Document downloaded

### Configuration Events
- `config.changed` - Settings modified
- `policy.published` - Policy published
- `policy.accepted` - Policy accepted
- `org.updated` - Organization updated

### API Key Events
- `api_key.created` - API key generated
- `api_key.revoked` - API key revoked
- `api_key.used` - API key used

---

## 🧪 Testing API Integration

### Unit Tests

```typescript
import { GET } from './route'
import { NextRequest } from 'next/server'

describe('GET /api/org/roles', () => {
  it('returns roles when authenticated', async () => {
    const request = new NextRequest('http://localhost:3000/api/org/roles', {
      headers: {
        'Authorization': 'Bearer valid-token',
      },
    })

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.roles).toBeInstanceOf(Array)
  })

  it('returns 401 when not authenticated', async () => {
    const request = new NextRequest('http://localhost:3000/api/org/roles')
    const response = await GET(request)

    expect(response.status).toBe(401)
  })
})
```

---

## 🚀 Deployment Considerations

### Environment Variables

```bash
# Backend API
BACKEND_API_URL=https://api.example.com

# Authentication
AUTH_SECRET=your-secret-key
AUTH_COOKIE_NAME=auth_token

# Feature Flags
ENABLE_AUDIT_EXPORT=true
ENABLE_POLICY_MANAGEMENT=true
```

### Rate Limiting

Consider implementing rate limiting for sensitive endpoints:

```typescript
import rateLimit from 'express-rate-limit'

const auditExportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 export requests per windowMs
  message: 'Too many export requests, please try again later.'
})
```

### Logging & Monitoring

All API calls should be logged for audit purposes:

```typescript
async function logApiCall(
  endpoint: string,
  userId: string,
  action: string,
  outcome: 'success' | 'failure'
) {
  await db.auditLogs.create({
    endpoint,
    userId,
    action,
    outcome,
    timestamp: new Date(),
  })
}
```

---

## 📞 Support

For API integration questions or issues:
- Check the [main README](./README.md)
- Review backend API documentation
- Contact the backend team

---

**Last Updated:** November 13, 2025

