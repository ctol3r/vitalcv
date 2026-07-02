// data-admin.jsx — Wave 29 Admin Console fixtures
// Org owner / admin surface · members, audit log, org settings, billing pointer.

const ADMIN_ORG = {
  id: 'org_demo_pilot_01',
  displayName: 'St. Mark Health Network',
  defaultWageUsd: 87,
  baselinePolicy: { statesServed: ['CA', 'OR', 'NV'], decisionSlaDays: 14 },
  logoUrl: null,
};

const ADMIN_ROLES_INVITABLE = ['admin', 'reviewer', 'read-only']; // owner excluded
const ADMIN_AUDIT_OUTCOMES  = ['success', 'denied', 'error'];

const ADMIN_MEMBERS = [
  { id: 'm1', name: 'Pat Owner',   email: 'pat@stmark.example',    role: 'owner',     status: 'active',    lastActiveTs: '12m ago' },
  { id: 'm2', name: 'Alex Admin',  email: 'alex@stmark.example',   role: 'admin',     status: 'active',    lastActiveTs: '4h ago'  },
  { id: 'm3', name: 'Riley Rev',   email: 'riley@stmark.example',  role: 'reviewer',  status: 'active',    lastActiveTs: '1d ago'  },
  { id: 'm4', name: 'Jordan Read', email: 'jordan@stmark.example', role: 'read-only', status: 'invited',   lastActiveTs: null      },
];

const ADMIN_MEMBERS_SINGLE_OWNER = [
  { id: 'm1', name: 'Pat Owner',   email: 'pat@stmark.example',    role: 'owner',     status: 'active',    lastActiveTs: 'just now' },
];

const ADMIN_AUDIT_ROWS = [
  {
    id: 'aud_001', ts: '2026-04-25 09:14:02 UTC',
    actorId: 'm2', surface: '/admin/members', action: 'member-invited',
    outcome: 'success',
    detail: { invitedEmail: 'jordan@stmark.example', invitedRole: 'read-only' },
    recordedBy: 'demo',
  },
  {
    id: 'aud_002', ts: '2026-04-25 09:11:48 UTC',
    actorId: 'm2', surface: '/admin/settings', action: 'org-settings-updated',
    outcome: 'success',
    detail: { field: 'defaultWageUsd', from: 82, to: 87 },
    recordedBy: 'demo',
  },
  {
    id: 'aud_003', ts: '2026-04-25 08:42:11 UTC',
    actorId: 'm3', surface: '/employer/console', action: 'clinician-application-viewed',
    outcome: 'success',
    detail: { clinicianRef: 'NPI-1346·xxxxxx', applicationId: 'VCV-APP-2026-000841' },
    recordedBy: 'demo',
  },
  {
    id: 'aud_004', ts: '2026-04-25 08:39:55 UTC',
    actorId: 'm3', surface: '/employer/console', action: 'acceptance-recorded',
    outcome: 'success',
    detail: { clinicianRef: 'NPI-1346·xxxxxx', decision: 'accept', gateState: 'open' },
    recordedBy: 'demo',
  },
  {
    id: 'aud_005', ts: '2026-04-25 08:30:02 UTC',
    actorId: 'm2', surface: '/admin/members', action: 'role-changed',
    outcome: 'success',
    detail: { memberId: 'm3', from: 'read-only', to: 'reviewer' },
    recordedBy: 'demo',
  },
  {
    id: 'aud_006', ts: '2026-04-25 08:14:39 UTC',
    actorId: 'm2', surface: '/admin/audit', action: 'audit-filter-applied',
    outcome: 'success',
    detail: { filter: { surface: '/employer/console' } },
    recordedBy: 'demo',
  },
  {
    id: 'aud_007', ts: '2026-04-24 17:58:24 UTC',
    actorId: 'm3', surface: '/file/credentialing', action: 'file-export-requested',
    outcome: 'denied',
    detail: { reason: 'role lacks export-permission', requiredRole: 'admin' },
    recordedBy: 'demo',
  },
  {
    id: 'aud_008', ts: '2026-04-24 17:21:08 UTC',
    actorId: 'm2', surface: '/admin/members', action: 'member-suspended',
    outcome: 'success',
    detail: { memberId: 'm5-removed', priorRole: 'reviewer' },
    recordedBy: 'demo',
  },
  {
    id: 'aud_009', ts: '2026-04-24 16:02:51 UTC',
    actorId: 'm3', surface: '/employer/console', action: 'request-info-sent',
    outcome: 'success',
    detail: { clinicianRef: 'NPI-1346·xxxxxx', laneId: 'sanctions' },
    recordedBy: 'demo',
  },
  {
    id: 'aud_010', ts: '2026-04-24 11:47:15 UTC',
    actorId: 'm2', surface: '/admin/billing', action: 'billing-portal-opened',
    outcome: 'success',
    detail: { plan: 'Pilot' },
    recordedBy: 'demo',
  },
  {
    id: 'aud_011', ts: '2026-04-24 09:33:29 UTC',
    actorId: 'm1', surface: '/admin/members', action: 'member-invited',
    outcome: 'success',
    detail: { invitedEmail: 'riley@stmark.example', invitedRole: 'reviewer' },
    recordedBy: 'demo',
  },
  {
    id: 'aud_012', ts: '2026-04-24 09:30:11 UTC',
    actorId: 'm1', surface: '/admin/members', action: 'member-invited',
    outcome: 'success',
    detail: { invitedEmail: 'alex@stmark.example', invitedRole: 'admin' },
    recordedBy: 'demo',
  },
  {
    id: 'aud_013', ts: '2026-04-23 22:11:04 UTC',
    actorId: 'm3', surface: '/file/credentialing', action: 'file-section-viewed',
    outcome: 'success',
    detail: { clinicianRef: 'NPI-1346·xxxxxx', section: 'attestation' },
    recordedBy: 'demo',
  },
  {
    id: 'aud_014', ts: '2026-04-23 22:08:47 UTC',
    actorId: 'm2', surface: '/admin/audit', action: 'audit-row-detail-opened',
    outcome: 'success',
    detail: { rowId: 'aud_007' },
    recordedBy: 'demo',
  },
  {
    id: 'aud_015', ts: '2026-04-23 14:52:33 UTC',
    actorId: 'm3', surface: '/employer/console', action: 'request-info-sent',
    outcome: 'error',
    detail: { reason: 'upstream timeout', retryable: true },
    recordedBy: 'demo',
  },
];

const ADMIN_BILLING_POINTER = {
  currentPlan: 'Pilot',
  seatsUsed: 4,
  seatsTotal: 10,
  nextInvoiceDate: '2026-05-15',
};

Object.assign(window, {
  ADMIN_ORG, ADMIN_MEMBERS, ADMIN_MEMBERS_SINGLE_OWNER, ADMIN_AUDIT_ROWS,
  ADMIN_BILLING_POINTER, ADMIN_ROLES_INVITABLE, ADMIN_AUDIT_OUTCOMES,
});
