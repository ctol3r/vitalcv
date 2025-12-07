/**
 * B141A Governance System Tests
 * Tests for roles, permissions, policies, and audit features
 */

import { PrismaClient } from '@prisma/client';
import {
  seedBuiltInRoles,
  checkPermission,
  hasAllPermissions,
  BUILT_IN_ROLES,
} from '../models/OrgRole';
import {
  assignRoleToUser,
  revokeRoleFromUser,
  getUserRolesInOrg,
  getUserPermissionsInOrg,
  userHasPermission,
  userHasAllPermissions,
} from '../models/OrgUserRole';
import { seedInitialPolicies } from '../../policy/models/PlatformPolicyVersion';
import {
  recordPolicyAcceptance,
  getPolicyAcceptanceStatus,
  hasOrgAcceptedPolicy,
} from '../../policy/models/OrgPolicyAcceptance';
import { recordSettingChange, SettingChangeAction } from '../../audit/settingsEvents';

const prisma = new PrismaClient();

// Test constants
const TEST_ORG_ID = 'test-org-123';
const TEST_USER_ID = 'test-user-456';
const TEST_ADMIN_ID = 'test-admin-789';

describe('B141A-GOV-001: OrgRole Model', () => {
  beforeAll(async () => {
    // Clean up any existing test data
    await prisma.orgUserRole.deleteMany({
      where: { orgId: TEST_ORG_ID },
    });
    await prisma.orgRole.deleteMany({
      where: { orgId: TEST_ORG_ID },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should seed built-in roles for organization', async () => {
    const roles = await seedBuiltInRoles(TEST_ORG_ID);

    expect(roles).toHaveLength(4); // OrgAdmin, PrivilegeReviewer, PayerAdmin, ReadOnly
    expect(roles[0].isBuiltIn).toBe(true);
    expect(roles[0].permissions).toContain('org:*:*');
  });

  it('should check permission with exact match', () => {
    const userPermissions = ['org:config:read', 'audit:export:read'];
    expect(checkPermission(userPermissions, 'org:config:read')).toBe(true);
    expect(checkPermission(userPermissions, 'org:config:write')).toBe(false);
  });

  it('should check permission with wildcard', () => {
    const userPermissions = ['org:*:*', 'audit:export:read'];
    expect(checkPermission(userPermissions, 'org:config:read')).toBe(true);
    expect(checkPermission(userPermissions, 'org:config:write')).toBe(true);
    expect(checkPermission(userPermissions, 'org:anything:read')).toBe(true);
  });

  it('should check multiple permissions', () => {
    const userPermissions = ['org:config:read', 'audit:export:read'];
    expect(
      hasAllPermissions(userPermissions, [
        'org:config:read',
        'audit:export:read',
      ])
    ).toBe(true);
    expect(
      hasAllPermissions(userPermissions, [
        'org:config:read',
        'org:config:write',
      ])
    ).toBe(false);
  });
});

describe('B141A-GOV-002: OrgUserRole Mapping', () => {
  let testRoleId: string;

  beforeAll(async () => {
    // Seed roles
    const roles = await seedBuiltInRoles(TEST_ORG_ID);
    testRoleId = roles[0].id; // OrgAdmin role
  });

  afterAll(async () => {
    await prisma.orgUserRole.deleteMany({
      where: { orgId: TEST_ORG_ID },
    });
  });

  it('should assign role to user', async () => {
    const assignment = await assignRoleToUser(
      TEST_USER_ID,
      TEST_ORG_ID,
      testRoleId,
      TEST_ADMIN_ID
    );

    expect(assignment.userId).toBe(TEST_USER_ID);
    expect(assignment.orgId).toBe(TEST_ORG_ID);
    expect(assignment.isActive).toBe(true);
    expect(assignment.assignedBy).toBe(TEST_ADMIN_ID);
  });

  it('should support multiple roles per user', async () => {
    // Assign additional role
    const roles = await prisma.orgRole.findMany({
      where: { orgId: TEST_ORG_ID },
    });
    const secondRoleId = roles[1].id;

    await assignRoleToUser(
      TEST_USER_ID,
      TEST_ORG_ID,
      secondRoleId,
      TEST_ADMIN_ID
    );

    const userRoles = await getUserRolesInOrg(TEST_USER_ID, TEST_ORG_ID);
    expect(userRoles.length).toBeGreaterThanOrEqual(2);
  });

  it('should get user permissions in org', async () => {
    const permissions = await getUserPermissionsInOrg(
      TEST_USER_ID,
      TEST_ORG_ID
    );

    expect(permissions.length).toBeGreaterThan(0);
    expect(permissions).toContain('org:*:*'); // OrgAdmin has this
  });

  it('should check user has permission', async () => {
    const hasPermission = await userHasPermission(
      TEST_USER_ID,
      TEST_ORG_ID,
      'org:config:read'
    );
    expect(hasPermission).toBe(true);
  });

  it('should check user has all permissions', async () => {
    const hasAll = await userHasAllPermissions(TEST_USER_ID, TEST_ORG_ID, [
      'org:config:read',
      'audit:export:read',
    ]);
    expect(hasAll).toBe(true);
  });

  it('should revoke role from user', async () => {
    await revokeRoleFromUser(TEST_USER_ID, TEST_ORG_ID, testRoleId);

    const userRoles = await getUserRolesInOrg(TEST_USER_ID, TEST_ORG_ID);
    const hasRevokedRole = userRoles.some((ur) => ur.orgRoleId === testRoleId);
    expect(hasRevokedRole).toBe(false);
  });
});

describe('B141A-GOV-003: Permission Middleware', () => {
  // Integration tests would test the actual middleware
  // Unit tests can test the permission check functions

  it('should allow user with correct permissions', async () => {
    // Reassign role for this test
    const roles = await prisma.orgRole.findMany({
      where: { orgId: TEST_ORG_ID },
    });
    await assignRoleToUser(TEST_USER_ID, TEST_ORG_ID, roles[0].id);

    const hasPermission = await userHasPermission(
      TEST_USER_ID,
      TEST_ORG_ID,
      'audit:export:read'
    );
    expect(hasPermission).toBe(true);
  });

  it('should deny user without required permissions', async () => {
    // Create a user with only read-only role
    const readOnlyRole = await prisma.orgRole.findFirst({
      where: { orgId: TEST_ORG_ID, roleId: 'read_only' },
    });

    if (readOnlyRole) {
      await assignRoleToUser(
        'test-readonly-user',
        TEST_ORG_ID,
        readOnlyRole.id
      );

      const hasWritePermission = await userHasPermission(
        'test-readonly-user',
        TEST_ORG_ID,
        'org:config:write'
      );
      expect(hasWritePermission).toBe(false);
    }
  });
});

describe('B141A-POLICY-005 & B141A-POLICY-006: Policy Management', () => {
  let policyVersionId: string;

  beforeAll(async () => {
    // Clean up existing policy data
    await prisma.orgPolicyAcceptance.deleteMany({
      where: { orgId: TEST_ORG_ID },
    });
  });

  it('should seed initial policies', async () => {
    const policies = await seedInitialPolicies();

    expect(policies.length).toBeGreaterThanOrEqual(3); // Security, Privacy, DataUse
    expect(policies[0].isActive).toBe(true);
    policyVersionId = policies[0].id;
  });

  it('should record policy acceptance', async () => {
    const acceptance = await recordPolicyAcceptance(
      TEST_ORG_ID,
      policyVersionId,
      TEST_ADMIN_ID,
      'Test Admin',
      '127.0.0.1',
      'test-agent'
    );

    expect(acceptance.orgId).toBe(TEST_ORG_ID);
    expect(acceptance.policyVersionId).toBe(policyVersionId);
    expect(acceptance.acceptedBy).toBe(TEST_ADMIN_ID);
    expect(acceptance.anchoredTxHash).toBeTruthy(); // Should have hash
  });

  it('should check if org has accepted policy', async () => {
    const hasAccepted = await hasOrgAcceptedPolicy(
      TEST_ORG_ID,
      'Security Policy'
    );
    expect(hasAccepted).toBe(true);
  });

  it('should get policy acceptance status', async () => {
    const statuses = await getPolicyAcceptanceStatus(TEST_ORG_ID);

    expect(statuses.length).toBeGreaterThan(0);
    const securityPolicyStatus = statuses.find(
      (s) => s.policy.name === 'Security Policy'
    );
    expect(securityPolicyStatus?.accepted).toBe(true);
  });
});

describe('B141A-AUD-008: Settings Audit Events', () => {
  it('should record settings change', async () => {
    const before = { ehrType: 'epic', fhirBaseUrl: 'https://old.example.com' };
    const after = { ehrType: 'cerner', fhirBaseUrl: 'https://new.example.com' };

    const event = await recordSettingChange(
      TEST_ORG_ID,
      'EhrConfig',
      SettingChangeAction.EHR_CONFIG_UPDATED,
      TEST_ADMIN_ID,
      'Test Admin',
      before,
      after,
      'ehr-config-123'
    );

    expect(event.orgId).toBe(TEST_ORG_ID);
    expect(event.action).toBe(SettingChangeAction.EHR_CONFIG_UPDATED);
    expect(event.before).toEqual(before);
    expect(event.after).toEqual(after);
    expect(event.anchoredHash).toBeTruthy();
    expect(event.anchoredTx).toBeTruthy();
    expect(event.changeSet).toBeDefined();
  });

  it('should compute change set correctly', async () => {
    const before = { field1: 'old', field2: 'unchanged', field3: 'removed' };
    const after = { field1: 'new', field2: 'unchanged', field4: 'added' };

    const event = await recordSettingChange(
      TEST_ORG_ID,
      'TestConfig',
      SettingChangeAction.ORG_CONFIG_UPDATED,
      TEST_ADMIN_ID,
      'Test Admin',
      before,
      after
    );

    const changeSet = event.changeSet as Record<string, any>;
    expect(changeSet.field1).toBeDefined(); // Changed
    expect(changeSet.field2).toBeUndefined(); // Unchanged
    expect(changeSet.field3).toBeDefined(); // Removed
    expect(changeSet.field4).toBeDefined(); // Added
  });

  it('should redact sensitive fields', async () => {
    const before = { apiKey: 'old-secret', clientSecret: 'old-secret-2' };
    const after = { apiKey: 'new-secret', clientSecret: 'new-secret-2' };

    const event = await recordSettingChange(
      TEST_ORG_ID,
      'SecretConfig',
      SettingChangeAction.ORG_CONFIG_UPDATED,
      TEST_ADMIN_ID,
      'Test Admin',
      before,
      after
    );

    const changeSet = event.changeSet as Record<string, any>;
    expect(changeSet.apiKey.before).toBe('[REDACTED]');
    expect(changeSet.apiKey.after).toBe('[REDACTED]');
    expect(changeSet.clientSecret.before).toBe('[REDACTED]');
  });
});

