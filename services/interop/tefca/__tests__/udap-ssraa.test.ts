/**
 * B111A-TEFCA-013: TEFCA harness: UDAP/SSRAA redaction+rotation+retention tests
 *
 * Tests for:
 * - UDAP (Unified Data Access Protocol) data masking
 * - SSRAA (Secure Service Registry and Authorization Agent) redaction
 * - Daily rotation
 * - 30-day retention
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  maskSensitiveData,
  rotateLogs,
  applyRetentionPolicy,
  writeMaskedLog,
  DEFAULT_ROTATION_CONFIG,
  DEFAULT_RETENTION_POLICY,
  MASKING_PATTERNS,
} from '../harness';
import fs from 'fs';
import path from 'path';

describe('TEFCA UDAP/SSRAA Redaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('UDAP Data Masking', () => {
    it('should mask UDAP patient identifiers', () => {
      const udapData = {
        patientId: 'PAT-123456789',
        mrn: 'MRN: 987654321',
        ssn: '123-45-6789',
        name: 'John Doe',
        dob: '1990-01-15',
      };

      const masked = maskSensitiveData(JSON.stringify(udapData));
      const parsed = JSON.parse(masked);

      expect(masked).not.toContain('123-45-6789');
      expect(masked).not.toContain('John Doe');
      expect(masked).not.toContain('1990-01-15');
      expect(masked).toContain('[REDACTED');
    });

    it('should preserve UDAP metadata while masking PHI', () => {
      const udapData = {
        metadata: {
          version: '1.0',
          protocol: 'UDAP',
          timestamp: '2025-01-01T00:00:00Z',
        },
        patient: {
          name: 'Jane Smith',
          ssn: '987-65-4321',
        },
      };

      const masked = maskSensitiveData(JSON.stringify(udapData));
      expect(masked).toContain('UDAP');
      expect(masked).toContain('version');
      expect(masked).not.toContain('Jane Smith');
      expect(masked).not.toContain('987-65-4321');
    });
  });

  describe('SSRAA Redaction', () => {
    it('should mask SSRAA service registry data', () => {
      const ssraaData = {
        serviceId: 'SRV-ABC123',
        endpoint: 'https://api.example.com/service',
        credentials: {
          apiKey: 'sk_live_1234567890abcdef',
          clientId: 'client-12345',
        },
        contact: {
          email: 'admin@example.com',
          phone: '555-123-4567',
        },
      };

      const masked = maskSensitiveData(JSON.stringify(ssraaData));
      expect(masked).not.toContain('sk_live_');
      expect(masked).not.toContain('admin@example.com');
      expect(masked).not.toContain('555-123-4567');
      expect(masked).toContain('SRV-ABC123'); // Service ID can remain
    });

    it('should mask SSRAA authorization tokens', () => {
      const ssraaAuth = {
        token: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        refreshToken: 'refresh_token_abc123',
        clientSecret: 'secret_xyz789',
      };

      const masked = maskSensitiveData(JSON.stringify(ssraaAuth));
      expect(masked).not.toContain('Bearer');
      expect(masked).not.toContain('refresh_token_');
      expect(masked).not.toContain('secret_');
    });
  });

  describe('Daily Rotation', () => {
    it('should create daily log files', async () => {
      const testLogDir = './test-logs-tefca';
      const config = {
        ...DEFAULT_ROTATION_CONFIG,
        logDirectory: testLogDir,
      };

      // Clean up before test
      if (fs.existsSync(testLogDir)) {
        fs.rmSync(testLogDir, { recursive: true });
      }

      await rotateLogs(config);

      const today = new Date().toISOString().split('T')[0];
      const expectedLogFile = path.join(testLogDir, `tefca-${today}.log`);
      expect(fs.existsSync(expectedLogFile)).toBe(true);

      // Clean up after test
      if (fs.existsSync(testLogDir)) {
        fs.rmSync(testLogDir, { recursive: true });
      }
    });

    it('should rotate logs daily', async () => {
      const testLogDir = './test-logs-rotation';
      const config = {
        ...DEFAULT_ROTATION_CONFIG,
        logDirectory: testLogDir,
        maxFiles: 5,
      };

      // Clean up before test
      if (fs.existsSync(testLogDir)) {
        fs.rmSync(testLogDir, { recursive: true });
      }

      // Create multiple log files
      for (let i = 0; i < 10; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const logFile = path.join(testLogDir, `tefca-${dateStr}.log`);
        fs.mkdirSync(testLogDir, { recursive: true });
        fs.writeFileSync(logFile, `Test log entry ${i}\n`);
      }

      await rotateLogs(config);

      const logFiles = fs.readdirSync(testLogDir)
        .filter(file => file.startsWith('tefca-') && file.endsWith('.log'))
        .sort()
        .reverse();

      // Should keep only maxFiles (5) most recent logs
      expect(logFiles.length).toBeLessThanOrEqual(5);

      // Clean up after test
      if (fs.existsSync(testLogDir)) {
        fs.rmSync(testLogDir, { recursive: true });
      }
    });
  });

  describe('30-Day Retention', () => {
    it('should enforce 30-day retention policy', async () => {
      const testLogDir = './test-logs-retention';
      const policy = {
        ...DEFAULT_RETENTION_POLICY,
        logRetentionDays: 30,
      };

      // Clean up before test
      if (fs.existsSync(testLogDir)) {
        fs.rmSync(testLogDir, { recursive: true });
      }

      fs.mkdirSync(testLogDir, { recursive: true });

      // Create log files with various ages
      const now = Date.now();
      const files = [
        { name: 'tefca-2024-12-01.log', age: 40 }, // Older than 30 days
        { name: 'tefca-2024-12-15.log', age: 25 }, // Within 30 days
        { name: 'tefca-2024-12-20.log', age: 20 }, // Within 30 days
        { name: 'tefca-2024-12-30.log', age: 10 }, // Within 30 days
      ];

      for (const file of files) {
        const filePath = path.join(testLogDir, file.name);
        fs.writeFileSync(filePath, 'Test log entry\n');
        // Set file modification time
        const mtime = new Date(now - file.age * 24 * 60 * 60 * 1000);
        fs.utimesSync(filePath, mtime, mtime);
      }

      const result = await applyRetentionPolicy(policy, testLogDir);

      // Should delete files older than 30 days
      expect(result.deleted).toBeGreaterThan(0);
      expect(result.kept).toBeGreaterThan(0);

      // Verify files older than 30 days are deleted
      const remainingFiles = fs.readdirSync(testLogDir)
        .filter(file => file.startsWith('tefca-') && file.endsWith('.log'));

      // Files within retention period should remain
      expect(remainingFiles.length).toBeLessThanOrEqual(3);

      // Clean up after test
      if (fs.existsSync(testLogDir)) {
        fs.rmSync(testLogDir, { recursive: true });
      }
    });

    it('should archive files after retention period', async () => {
      const testLogDir = './test-logs-archive';
      const policy = {
        ...DEFAULT_RETENTION_POLICY,
        logRetentionDays: 30,
        archiveAfterDays: 7,
      };

      // Clean up before test
      if (fs.existsSync(testLogDir)) {
        fs.rmSync(testLogDir, { recursive: true });
      }

      fs.mkdirSync(testLogDir, { recursive: true });

      // Create log file older than archive threshold
      const now = Date.now();
      const filePath = path.join(testLogDir, 'tefca-2024-12-20.log');
      fs.writeFileSync(filePath, 'Test log entry\n');
      const mtime = new Date(now - 10 * 24 * 60 * 60 * 1000); // 10 days old
      fs.utimesSync(filePath, mtime, mtime);

      const result = await applyRetentionPolicy(policy, testLogDir);

      // Should mark for archive
      expect(result.archived).toBeGreaterThan(0);

      // Clean up after test
      if (fs.existsSync(testLogDir)) {
        fs.rmSync(testLogDir, { recursive: true });
      }
    });
  });

  describe('Masked Log Writing', () => {
    it('should write masked log entries', () => {
      const testLogDir = './test-logs-write';
      const entry = {
        event: 'UDAP_ACCESS',
        patientId: 'PAT-123',
        patientName: 'John Doe',
        ssn: '123-45-6789',
        timestamp: new Date().toISOString(),
      };

      // Clean up before test
      if (fs.existsSync(testLogDir)) {
        fs.rmSync(testLogDir, { recursive: true });
      }

      writeMaskedLog(entry, testLogDir);

      const today = new Date().toISOString().split('T')[0];
      const logFile = path.join(testLogDir, `tefca-${today}.log`);

      expect(fs.existsSync(logFile)).toBe(true);

      const logContent = fs.readFileSync(logFile, 'utf-8');
      expect(logContent).not.toContain('John Doe');
      expect(logContent).not.toContain('123-45-6789');
      expect(logContent).toContain('[REDACTED');
      expect(logContent).toContain('UDAP_ACCESS');

      // Clean up after test
      if (fs.existsSync(testLogDir)) {
        fs.rmSync(testLogDir, { recursive: true });
      }
    });

    it('should include hash in log entries', () => {
      const testLogDir = './test-logs-hash';
      const entry = {
        event: 'SSRAA_REGISTRATION',
        serviceId: 'SRV-123',
        data: 'test data',
      };

      // Clean up before test
      if (fs.existsSync(testLogDir)) {
        fs.rmSync(testLogDir, { recursive: true });
      }

      writeMaskedLog(entry, testLogDir);

      const today = new Date().toISOString().split('T')[0];
      const logFile = path.join(testLogDir, `tefca-${today}.log`);
      const logContent = fs.readFileSync(logFile, 'utf-8');
      const logEntry = JSON.parse(logContent.trim());

      expect(logEntry.hash).toBeDefined();
      expect(typeof logEntry.hash).toBe('string');
      expect(logEntry.hash.length).toBeGreaterThan(0);

      // Clean up after test
      if (fs.existsSync(testLogDir)) {
        fs.rmSync(testLogDir, { recursive: true });
      }
    });
  });

  describe('Pattern Coverage', () => {
    it('should mask all required UDAP/SSRAA patterns', () => {
      const testData = {
        // UDAP patterns
        patientId: 'PAT-123456789',
        mrn: 'MRN: 987654321',
        ssn: '123-45-6789',
        name: 'John Doe',
        dob: '1990-01-15',
        email: 'patient@example.com',
        phone: '555-123-4567',

        // SSRAA patterns
        apiKey: 'sk_live_1234567890abcdef',
        clientSecret: 'secret_xyz789',
        token: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
        ipAddress: '192.168.1.1',
      };

      const masked = maskSensitiveData(JSON.stringify(testData));

      // Verify all sensitive data is masked
      expect(masked).not.toContain('123-45-6789');
      expect(masked).not.toContain('John Doe');
      expect(masked).not.toContain('1990-01-15');
      expect(masked).not.toContain('patient@example.com');
      expect(masked).not.toContain('555-123-4567');
      expect(masked).not.toContain('sk_live_');
      expect(masked).not.toContain('secret_');
      expect(masked).not.toContain('Bearer');
      expect(masked).not.toContain('192.168.1.1');

      // Verify non-sensitive data is preserved
      expect(masked).toContain('PAT-123456789'); // Patient ID can remain
    });
  });
});

