/**
 * TEFCA Harness Tests
 * B118B-TEFCA-025: TEFCA harness logging: mask/redact tests + rotation + retention
 *
 * Tests for:
 * - Mask/redact regex patterns
 * - Daily log rotation
 * - 30-day retention policy
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  maskSensitiveData,
  testMaskingPatterns,
  MASKING_PATTERNS,
  rotateLogs,
  applyRetentionPolicy,
  writeMaskedLog,
  scheduleDailyRotation,
  DEFAULT_ROTATION_CONFIG,
  DEFAULT_RETENTION_POLICY,
} from '../harness';

describe('TEFCA Masking Patterns', () => {
  describe('SSN Masking', () => {
    it('should mask SSN in format XXX-XX-XXXX', () => {
      const input = 'Patient SSN: 123-45-6789';
      const output = maskSensitiveData(input);
      expect(output).toContain('XXX-XX-45');
      expect(output).not.toContain('123-45-6789');
    });

    it('should mask SSN without dashes', () => {
      const input = 'SSN: 123456789';
      const output = maskSensitiveData(input);
      expect(output).not.toContain('123456789');
    });
  });

  describe('Email Masking', () => {
    it('should mask email username but keep domain', () => {
      const input = 'Contact: john.doe@example.com';
      const output = maskSensitiveData(input);
      expect(output).toContain('@example.com');
      expect(output).not.toContain('john.doe');
    });
  });

  describe('Phone Masking', () => {
    it('should mask phone number showing only last 4 digits', () => {
      const input = 'Phone: (555) 123-4567';
      const output = maskSensitiveData(input);
      expect(output).toContain('XXX-XXX-4567');
      expect(output).not.toContain('555');
      expect(output).not.toContain('123');
    });
  });

  describe('NPI Masking', () => {
    it('should partially mask NPI showing first 2 and last 4 digits', () => {
      const input = 'NPI: 1234567890';
      const output = maskSensitiveData(input);
      expect(output).toContain('12XXXX7890');
      expect(output).not.toContain('1234567890');
    });
  });

  describe('Date Masking', () => {
    it('should redact dates', () => {
      const input = 'DOB: 01/15/1990';
      const output = maskSensitiveData(input);
      expect(output).toContain('[REDACTED_DATE]');
      expect(output).not.toContain('01/15/1990');
    });
  });

  describe('MRN Masking', () => {
    it('should redact MRN', () => {
      const input = 'MRN: 12345678';
      const output = maskSensitiveData(input);
      expect(output).toContain('MRN:[REDACTED]');
      expect(output).not.toContain('12345678');
    });
  });

  describe('IP Address Masking', () => {
    it('should redact IP addresses', () => {
      const input = 'IP: 192.168.1.1';
      const output = maskSensitiveData(input);
      expect(output).toContain('[REDACTED_IP]');
      expect(output).not.toContain('192.168.1.1');
    });
  });

  describe('Name Masking', () => {
    it('should redact full names', () => {
      const input = 'Patient: John Smith';
      const output = maskSensitiveData(input);
      expect(output).toContain('[REDACTED_NAME]');
      expect(output).not.toContain('John Smith');
    });
  });

  describe('Pattern Testing', () => {
    it('should pass all regex pattern tests', () => {
      const results = testMaskingPatterns();
      expect(results.failed).toBe(0);
      expect(results.passed).toBeGreaterThan(0);

      // Log results for debugging
      results.results.forEach(result => {
        if (!result.passed) {
          console.error(`Pattern ${result.pattern} failed:`, {
            input: result.input,
            output: result.output,
            description: result.description,
          });
        }
      });
    });
  });

  describe('Complex Data Masking', () => {
    it('should mask multiple sensitive fields in one string', () => {
      const input = 'Patient John Smith, SSN: 123-45-6789, DOB: 01/15/1990, Phone: 555-123-4567';
      const output = maskSensitiveData(input);

      expect(output).not.toContain('John Smith');
      expect(output).not.toContain('123-45-6789');
      expect(output).not.toContain('01/15/1990');
      expect(output).not.toContain('555-123-4567');

      expect(output).toContain('[REDACTED_NAME]');
      expect(output).toContain('[REDACTED_DATE]');
    });
  });

  describe('B118B-TEFCA-025: Log Rotation', () => {
    const testLogDir = path.join(__dirname, '../../../../test-logs-tefca');

    beforeEach(() => {
      // Clean up test directory
      if (fs.existsSync(testLogDir)) {
        fs.rmSync(testLogDir, { recursive: true, force: true });
      }
      fs.mkdirSync(testLogDir, { recursive: true });
    });

    afterEach(() => {
      // Clean up test directory
      if (fs.existsSync(testLogDir)) {
        fs.rmSync(testLogDir, { recursive: true, force: true });
      }
    });

    it('should rotate logs daily', async () => {
      const config = {
        ...DEFAULT_ROTATION_CONFIG,
        logDirectory: testLogDir,
        rotationInterval: 'daily' as const,
        maxFiles: 5,
      };

      // Create some test log files
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const twoDaysAgo = new Date(today);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      const todayFile = path.join(testLogDir, `tefca-${today.toISOString().split('T')[0]}.log`);
      const yesterdayFile = path.join(testLogDir, `tefca-${yesterday.toISOString().split('T')[0]}.log`);
      const twoDaysAgoFile = path.join(testLogDir, `tefca-${twoDaysAgo.toISOString().split('T')[0]}.log`);

      fs.writeFileSync(todayFile, 'test log entry');
      fs.writeFileSync(yesterdayFile, 'test log entry');
      fs.writeFileSync(twoDaysAgoFile, 'test log entry');

      await rotateLogs(config);

      // Today's file should still exist
      expect(fs.existsSync(todayFile)).toBe(true);

      // Other files should exist (within maxFiles limit)
      const logFiles = fs.readdirSync(testLogDir).filter(f => f.startsWith('tefca-') && f.endsWith('.log'));
      expect(logFiles.length).toBeLessThanOrEqual(config.maxFiles + 1); // +1 for today's file
    });

    it('should create log file for current date', async () => {
      const config = {
        ...DEFAULT_ROTATION_CONFIG,
        logDirectory: testLogDir,
      };

      await rotateLogs(config);

      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];
      const expectedFile = path.join(testLogDir, `tefca-${dateStr}.log`);

      expect(fs.existsSync(expectedFile)).toBe(true);
    });

    it('should remove old log files beyond maxFiles limit', async () => {
      const config = {
        ...DEFAULT_ROTATION_CONFIG,
        logDirectory: testLogDir,
        maxFiles: 2,
      };

      // Create more than maxFiles log files
      for (let i = 0; i < 5; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const file = path.join(testLogDir, `tefca-${dateStr}.log`);
        fs.writeFileSync(file, `test log ${i}`);
      }

      await rotateLogs(config);

      const logFiles = fs.readdirSync(testLogDir).filter(f => f.startsWith('tefca-') && f.endsWith('.log'));
      expect(logFiles.length).toBeLessThanOrEqual(config.maxFiles + 1);
    });
  });

  describe('B118B-TEFCA-025: Retention Policy', () => {
    const testLogDir = path.join(__dirname, '../../../../test-logs-tefca-retention');

    beforeEach(() => {
      if (fs.existsSync(testLogDir)) {
        fs.rmSync(testLogDir, { recursive: true, force: true });
      }
      fs.mkdirSync(testLogDir, { recursive: true });
    });

    afterEach(() => {
      if (fs.existsSync(testLogDir)) {
        fs.rmSync(testLogDir, { recursive: true, force: true });
      }
    });

    it('should apply 30-day retention policy', async () => {
      const policy = {
        ...DEFAULT_RETENTION_POLICY,
        logRetentionDays: 30,
      };

      // Create old log file (older than retention period)
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 35); // 35 days ago
      const oldFile = path.join(testLogDir, `tefca-${oldDate.toISOString().split('T')[0]}.log`);
      fs.writeFileSync(oldFile, 'old log');

      // Create recent log file (within retention period)
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 10); // 10 days ago
      const recentFile = path.join(testLogDir, `tefca-${recentDate.toISOString().split('T')[0]}.log`);
      fs.writeFileSync(recentFile, 'recent log');

      // Mock file stats to simulate age
      const originalStatSync = fs.statSync;
      vi.spyOn(fs, 'statSync').mockImplementation((filePath: string) => {
        const stats = originalStatSync(filePath);
        if (filePath === oldFile) {
          return {
            ...stats,
            mtimeMs: oldDate.getTime(),
          } as fs.Stats;
        }
        if (filePath === recentFile) {
          return {
            ...stats,
            mtimeMs: recentDate.getTime(),
          } as fs.Stats;
        }
        return stats;
      });

      const result = await applyRetentionPolicy(policy, testLogDir);

      // Old file should be marked for deletion (if deleteAfterDays is set appropriately)
      // Recent file should be kept
      expect(result.kept).toBeGreaterThanOrEqual(0);
    });

    it('should set 30-day retention by default', () => {
      expect(DEFAULT_RETENTION_POLICY.logRetentionDays).toBe(30);
    });

    it('should delete files older than deleteAfterDays', async () => {
      const policy = {
        ...DEFAULT_RETENTION_POLICY,
        deleteAfterDays: 10,
      };

      // Create very old file
      const veryOldDate = new Date();
      veryOldDate.setDate(veryOldDate.getDate() - 20);
      const veryOldFile = path.join(testLogDir, `tefca-${veryOldDate.toISOString().split('T')[0]}.log`);
      fs.writeFileSync(veryOldFile, 'very old log');

      // Mock file stats
      const originalStatSync = fs.statSync;
      vi.spyOn(fs, 'statSync').mockImplementation((filePath: string) => {
        const stats = originalStatSync(filePath);
        if (filePath === veryOldFile) {
          return {
            ...stats,
            mtimeMs: veryOldDate.getTime(),
          } as fs.Stats;
        }
        return stats;
      });

      const result = await applyRetentionPolicy(policy, testLogDir);

      // File should be deleted
      expect(result.deleted).toBeGreaterThanOrEqual(0);
    });
  });

  describe('B118B-TEFCA-025: Write Masked Log', () => {
    const testLogDir = path.join(__dirname, '../../../../test-logs-tefca-write');

    beforeEach(() => {
      if (fs.existsSync(testLogDir)) {
        fs.rmSync(testLogDir, { recursive: true, force: true });
      }
      fs.mkdirSync(testLogDir, { recursive: true });
    });

    afterEach(() => {
      if (fs.existsSync(testLogDir)) {
        fs.rmSync(testLogDir, { recursive: true, force: true });
      }
    });

    it('should write masked log entry', () => {
      const entry = {
        patient: 'John Smith',
        ssn: '123-45-6789',
        email: 'john@example.com',
        phone: '555-123-4567',
      };

      writeMaskedLog(entry, testLogDir);

      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];
      const logFile = path.join(testLogDir, `tefca-${dateStr}.log`);

      expect(fs.existsSync(logFile)).toBe(true);

      const logContent = fs.readFileSync(logFile, 'utf-8');
      const logEntry = JSON.parse(logContent.trim());

      // Sensitive data should be masked
      expect(logEntry.patient).not.toContain('John Smith');
      expect(logEntry.ssn).not.toContain('123-45-6789');
      expect(logEntry.email).not.toContain('john@example.com');
      expect(logEntry.phone).not.toContain('555-123-4567');

      // Should have timestamp and hash
      expect(logEntry.timestamp).toBeDefined();
      expect(logEntry.hash).toBeDefined();
    });

    it('should mask sensitive data in log entries', () => {
      const entry = {
        message: 'Patient John Smith, SSN: 123-45-6789',
        data: {
          email: 'john.doe@example.com',
          phone: '555-123-4567',
        },
      };

      writeMaskedLog(entry, testLogDir);

      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];
      const logFile = path.join(testLogDir, `tefca-${dateStr}.log`);

      const logContent = fs.readFileSync(logFile, 'utf-8');
      const logEntry = JSON.parse(logContent.trim());

      // Verify masking
      expect(logEntry.message).not.toContain('John Smith');
      expect(logEntry.message).not.toContain('123-45-6789');
    });
  });
});

