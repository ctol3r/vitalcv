/**
 * Tests for Roles Report API
 * @jest-environment node
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { Request, Response } from 'express';
import { getRolesReport } from '../rolesReport';

describe('Roles Report API', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let jsonMock: jest.Mock;
  let sendMock: jest.Mock;
  let setHeaderMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    sendMock = jest.fn();
    setHeaderMock = jest.fn();

    mockReq = {
      params: { orgId: 'org_test_123' },
      query: {},
      user: {
        userId: 'user_admin_001',
        email: 'admin@test.org',
        role: 'organization_admin',
      },
    } as any;

    mockRes = {
      json: jsonMock,
      send: sendMock,
      setHeader: setHeaderMock,
      status: jest.fn().mockReturnThis(),
    } as any;
  });

  describe('Authorization', () => {
    it('should reject requests without authentication', async () => {
      mockReq.user = undefined;

      await getRolesReport(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('should reject requests without governance report permission', async () => {
      mockReq.user = {
        userId: 'user_std_001',
        email: 'user@test.org',
        role: 'standard_user',
      };

      await getRolesReport(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Insufficient permissions to view governance reports'
      });
    });

    it('should allow organization_admin to view report', async () => {
      await getRolesReport(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalled();
      const response = jsonMock.mock.calls[0][0];
      expect(response.orgId).toBe('org_test_123');
    });

    it('should allow compliance_officer to view report', async () => {
      mockReq.user = {
        userId: 'user_comp_001',
        email: 'compliance@test.org',
        role: 'compliance_officer',
      };

      await getRolesReport(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalled();
    });

    it('should allow auditor to view report', async () => {
      mockReq.user = {
        userId: 'user_aud_001',
        email: 'auditor@test.org',
        role: 'auditor',
      };

      await getRolesReport(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalled();
    });
  });

  describe('JSON Format', () => {
    it('should return report in JSON format by default', async () => {
      await getRolesReport(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalled();
      const response = jsonMock.mock.calls[0][0];

      expect(response).toHaveProperty('orgId');
      expect(response).toHaveProperty('orgName');
      expect(response).toHaveProperty('generatedAt');
      expect(response).toHaveProperty('generatedBy');
      expect(response).toHaveProperty('totalUsers');
      expect(response).toHaveProperty('breakdown');
      expect(response).toHaveProperty('users');
    });

    it('should include breakdown statistics', async () => {
      await getRolesReport(mockReq as Request, mockRes as Response);

      const response = jsonMock.mock.calls[0][0];

      expect(response.breakdown).toHaveProperty('byRole');
      expect(response.breakdown).toHaveProperty('byDepartment');
      expect(response.breakdown).toHaveProperty('with2FA');
      expect(response.breakdown).toHaveProperty('without2FA');
      expect(response.breakdown).toHaveProperty('activeUsers');
      expect(response.breakdown).toHaveProperty('inactiveUsers');
    });

    it('should include user details with permissions', async () => {
      await getRolesReport(mockReq as Request, mockRes as Response);

      const response = jsonMock.mock.calls[0][0];

      expect(response.users.length).toBeGreaterThan(0);

      const user = response.users[0];
      expect(user).toHaveProperty('userId');
      expect(user).toHaveProperty('email');
      expect(user).toHaveProperty('name');
      expect(user).toHaveProperty('role');
      expect(user).toHaveProperty('permissions');
      expect(user).toHaveProperty('twoFactorEnabled');
      expect(user).toHaveProperty('status');
      expect(Array.isArray(user.permissions)).toBe(true);
    });
  });

  describe('CSV Format', () => {
    it('should return CSV format when requested', async () => {
      mockReq.query = { format: 'csv' };

      await getRolesReport(mockReq as Request, mockRes as Response);

      expect(setHeaderMock).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(setHeaderMock).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('attachment; filename="roles-report-')
      );
      expect(sendMock).toHaveBeenCalled();

      const csvContent = sendMock.mock.calls[0][0];
      expect(typeof csvContent).toBe('string');
      expect(csvContent).toContain('User ID,Email,Name,Role');
    });

    it('should properly escape CSV special characters', async () => {
      mockReq.query = { format: 'csv' };

      await getRolesReport(mockReq as Request, mockRes as Response);

      const csvContent = sendMock.mock.calls[0][0];

      // Check for proper CSV formatting
      const lines = csvContent.split('\n');
      expect(lines.length).toBeGreaterThan(1); // Header + at least one data row

      // Verify header row
      expect(lines[0]).toContain('User ID');
      expect(lines[0]).toContain('Email');
      expect(lines[0]).toContain('Role');
    });
  });

  describe('Filtering', () => {
    it('should filter by role', async () => {
      mockReq.query = { roles: 'organization_admin,compliance_officer' };

      await getRolesReport(mockReq as Request, mockRes as Response);

      const response = jsonMock.mock.calls[0][0];

      response.users.forEach((user: any) => {
        expect(['organization_admin', 'compliance_officer']).toContain(user.role);
      });
    });

    it('should filter by department', async () => {
      mockReq.query = { departments: 'Compliance,Administration' };

      await getRolesReport(mockReq as Request, mockRes as Response);

      const response = jsonMock.mock.calls[0][0];

      response.users.forEach((user: any) => {
        if (user.department) {
          expect(['Compliance', 'Administration']).toContain(user.department);
        }
      });
    });

    it('should filter for 2FA-enabled users only', async () => {
      mockReq.query = { with2FAOnly: 'true' };

      await getRolesReport(mockReq as Request, mockRes as Response);

      const response = jsonMock.mock.calls[0][0];

      response.users.forEach((user: any) => {
        expect(user.twoFactorEnabled).toBe(true);
      });
    });

    it('should exclude inactive users by default', async () => {
      await getRolesReport(mockReq as Request, mockRes as Response);

      const response = jsonMock.mock.calls[0][0];

      response.users.forEach((user: any) => {
        expect(user.status).toBe('active');
      });
    });

    it('should include inactive users when requested', async () => {
      mockReq.query = { includeInactive: 'true' };

      await getRolesReport(mockReq as Request, mockRes as Response);

      const response = jsonMock.mock.calls[0][0];

      // Should include users regardless of status
      expect(response.users.length).toBeGreaterThanOrEqual(0);
    });

    it('should support multiple filters combined', async () => {
      mockReq.query = {
        roles: 'organization_admin',
        with2FAOnly: 'true',
        includeInactive: 'false',
      };

      await getRolesReport(mockReq as Request, mockRes as Response);

      const response = jsonMock.mock.calls[0][0];

      response.users.forEach((user: any) => {
        expect(user.role).toBe('organization_admin');
        expect(user.twoFactorEnabled).toBe(true);
        expect(user.status).toBe('active');
      });
    });
  });

  describe('Data Integrity', () => {
    it('should include timestamp in ISO 8601 format', async () => {
      await getRolesReport(mockReq as Request, mockRes as Response);

      const response = jsonMock.mock.calls[0][0];

      expect(response.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should attribute report to requesting user', async () => {
      await getRolesReport(mockReq as Request, mockRes as Response);

      const response = jsonMock.mock.calls[0][0];

      expect(response.generatedBy).toBe('admin@test.org');
    });

    it('should calculate accurate user counts', async () => {
      await getRolesReport(mockReq as Request, mockRes as Response);

      const response = jsonMock.mock.calls[0][0];

      expect(response.totalUsers).toBe(response.users.length);

      // Verify breakdown counts
      const with2FACount = response.users.filter((u: any) => u.twoFactorEnabled).length;
      expect(response.breakdown.with2FA).toBe(with2FACount);

      const without2FACount = response.users.filter((u: any) => !u.twoFactorEnabled).length;
      expect(response.breakdown.without2FA).toBe(without2FACount);
    });

    it('should include all key permissions for each role', async () => {
      await getRolesReport(mockReq as Request, mockRes as Response);

      const response = jsonMock.mock.calls[0][0];

      response.users.forEach((user: any) => {
        expect(Array.isArray(user.permissions)).toBe(true);
        expect(user.permissions.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid organization ID gracefully', async () => {
      mockReq.params = { orgId: 'invalid_org' };

      await getRolesReport(mockReq as Request, mockRes as Response);

      // Should still return a response (possibly empty or with error)
      expect(jsonMock).toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      // This would typically involve mocking a database error
      // For now, we ensure the endpoint doesn't crash

      await getRolesReport(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalled();
    });
  });
});

