/**
 * @jest-environment jsdom
 */

import {
  addEvent,
  clearEventCache,
  clearEventsForCredential,
  formatEventTimestamp,
  getAllEvents,
  getEventCache,
  getEventTypeInfo,
  getEventsForCredential,
  getRecentEvents,
  saveEventCache,
} from '@/lib/event-cache';

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('Event Cache Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  describe('getEventCache', () => {
    it('should return empty object when no cache exists', () => {
      const result = getEventCache();
      expect(result).toEqual({});
    });

    it('should return parsed cache when it exists', () => {
      const mockCache = {
        'CRED-123': [
          {
            id: 'event-1',
            credentialId: 'CRED-123',
            type: 'issued',
            timestamp: '2024-01-01T00:00:00Z',
          },
        ],
      };
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockCache));

      const result = getEventCache();
      expect(result).toEqual(mockCache);
    });

    it('should return empty object when JSON parsing fails', () => {
      localStorageMock.getItem.mockReturnValue('invalid-json');

      const result = getEventCache();
      expect(result).toEqual({});
    });
  });

  describe('saveEventCache', () => {
    it('should save cache to localStorage', () => {
      const mockCache = {
        'CRED-123': [
          {
            id: 'event-1',
            credentialId: 'CRED-123',
            type: 'issued',
            timestamp: '2024-01-01T00:00:00Z',
          },
        ],
      };

      saveEventCache(mockCache);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'vitalcv_event_cache',
        JSON.stringify(mockCache),
      );
    });

    it('should handle localStorage errors gracefully', () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('Storage full');
      });

      const mockCache = { 'CRED-123': [] };
      expect(() => saveEventCache(mockCache)).not.toThrow();
    });
  });

  describe('addEvent', () => {
    it('should add event to cache', () => {
      const mockEvent = {
        credentialId: 'CRED-123',
        type: 'issued' as const,
        timestamp: '2024-01-01T00:00:00Z',
        auditRef: 'AUDIT-001',
        details: {
          issuer: 'Test Board',
        },
      };

      addEvent(mockEvent);

      expect(localStorageMock.setItem).toHaveBeenCalled();
      const savedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
      expect(savedData['CRED-123']).toHaveLength(1);
      expect(savedData['CRED-123'][0]).toMatchObject({
        credentialId: 'CRED-123',
        type: 'issued',
        timestamp: '2024-01-01T00:00:00Z',
        auditRef: 'AUDIT-001',
        details: {
          issuer: 'Test Board',
        },
      });
      expect(savedData['CRED-123'][0].id).toBeDefined();
    });

    it('should add event to existing credential events', () => {
      const existingCache = {
        'CRED-123': [
          {
            id: 'event-1',
            credentialId: 'CRED-123',
            type: 'issued',
            timestamp: '2024-01-01T00:00:00Z',
          },
        ],
      };
      localStorageMock.getItem.mockReturnValue(JSON.stringify(existingCache));

      const newEvent = {
        credentialId: 'CRED-123',
        type: 'verified' as const,
        timestamp: '2024-01-02T00:00:00Z',
      };

      addEvent(newEvent);

      const savedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
      expect(savedData['CRED-123']).toHaveLength(2);
      expect(savedData['CRED-123'][0].type).toBe('verified'); // New event should be first
    });

    it('should limit events per credential', () => {
      const mockEvent = {
        credentialId: 'CRED-123',
        type: 'issued' as const,
        timestamp: '2024-01-01T00:00:00Z',
      };

      // Add more than MAX_EVENTS_PER_CREDENTIAL (50)
      for (let i = 0; i < 55; i++) {
        addEvent({
          ...mockEvent,
          timestamp: `2024-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
        });
      }

      const savedData = JSON.parse(localStorageMock.setItem.mock.calls[54][1]);
      expect(savedData['CRED-123']).toHaveLength(50);
    });
  });

  describe('getEventsForCredential', () => {
    it('should return events for specific credential', () => {
      const mockCache = {
        'CRED-123': [
          {
            id: 'event-1',
            credentialId: 'CRED-123',
            type: 'issued',
            timestamp: '2024-01-01T00:00:00Z',
          },
        ],
        'CRED-456': [
          {
            id: 'event-2',
            credentialId: 'CRED-456',
            type: 'verified',
            timestamp: '2024-01-02T00:00:00Z',
          },
        ],
      };
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockCache));

      const result = getEventsForCredential('CRED-123');
      expect(result).toHaveLength(1);
      expect(result[0].credentialId).toBe('CRED-123');
    });

    it('should return empty array for non-existent credential', () => {
      const result = getEventsForCredential('CRED-999');
      expect(result).toEqual([]);
    });
  });

  describe('getAllEvents', () => {
    it('should return all events sorted by timestamp', () => {
      const mockCache = {
        'CRED-123': [
          {
            id: 'event-1',
            credentialId: 'CRED-123',
            type: 'issued',
            timestamp: '2024-01-02T00:00:00Z',
          },
        ],
        'CRED-456': [
          {
            id: 'event-2',
            credentialId: 'CRED-456',
            type: 'verified',
            timestamp: '2024-01-01T00:00:00Z',
          },
        ],
      };
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockCache));

      const result = getAllEvents();
      expect(result).toHaveLength(2);
      expect(result[0].timestamp).toBe('2024-01-02T00:00:00Z'); // Most recent first
      expect(result[1].timestamp).toBe('2024-01-01T00:00:00Z');
    });
  });

  describe('getRecentEvents', () => {
    it('should return events from last 24 hours by default', () => {
      const now = new Date();
      const recentTime = new Date(now.getTime() - 12 * 60 * 60 * 1000); // 12 hours ago
      const oldTime = new Date(now.getTime() - 48 * 60 * 60 * 1000); // 48 hours ago

      const mockCache = {
        'CRED-123': [
          {
            id: 'event-1',
            credentialId: 'CRED-123',
            type: 'issued',
            timestamp: recentTime.toISOString(),
          },
          {
            id: 'event-2',
            credentialId: 'CRED-123',
            type: 'verified',
            timestamp: oldTime.toISOString(),
          },
        ],
      };
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockCache));

      const result = getRecentEvents();
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('issued');
    });

    it('should return events from custom time period', () => {
      const now = new Date();
      const recentTime = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 hours ago
      const oldTime = new Date(now.getTime() - 4 * 60 * 60 * 1000); // 4 hours ago

      const mockCache = {
        'CRED-123': [
          {
            id: 'event-1',
            credentialId: 'CRED-123',
            type: 'issued',
            timestamp: recentTime.toISOString(),
          },
          {
            id: 'event-2',
            credentialId: 'CRED-123',
            type: 'verified',
            timestamp: oldTime.toISOString(),
          },
        ],
      };
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockCache));

      const result = getRecentEvents(3); // Last 3 hours
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('issued');
    });
  });

  describe('clearEventCache', () => {
    it('should clear all events from localStorage', () => {
      clearEventCache();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('vitalcv_event_cache');
    });
  });

  describe('clearEventsForCredential', () => {
    it('should clear events for specific credential', () => {
      const mockCache = {
        'CRED-123': [
          {
            id: 'event-1',
            credentialId: 'CRED-123',
            type: 'issued',
            timestamp: '2024-01-01T00:00:00Z',
          },
        ],
        'CRED-456': [
          {
            id: 'event-2',
            credentialId: 'CRED-456',
            type: 'verified',
            timestamp: '2024-01-02T00:00:00Z',
          },
        ],
      };
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockCache));

      clearEventsForCredential('CRED-123');

      const savedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
      expect(savedData['CRED-123']).toBeUndefined();
      expect(savedData['CRED-456']).toBeDefined();
    });
  });

  describe('formatEventTimestamp', () => {
    it('should format recent timestamps correctly', () => {
      const now = new Date();

      // Just now
      expect(formatEventTimestamp(now.toISOString())).toBe('Just now');

      // 5 minutes ago
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      expect(formatEventTimestamp(fiveMinutesAgo.toISOString())).toBe('5m ago');

      // 2 hours ago
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      expect(formatEventTimestamp(twoHoursAgo.toISOString())).toBe('2h ago');

      // 3 days ago
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      expect(formatEventTimestamp(threeDaysAgo.toISOString())).toBe('3d ago');
    });

    it('should format old timestamps as date', () => {
      const oldDate = new Date('2023-01-01T00:00:00Z');
      const result = formatEventTimestamp(oldDate.toISOString());
      expect(result).toBe(oldDate.toLocaleDateString());
    });
  });

  describe('getEventTypeInfo', () => {
    it('should return correct info for issued events', () => {
      const info = getEventTypeInfo('issued');
      expect(info.label).toBe('Issued');
      expect(info.icon).toBe('📜');
      expect(info.color).toBe('text-blue-600');
      expect(info.bgColor).toBe('bg-blue-50');
      expect(info.borderColor).toBe('border-blue-200');
    });

    it('should return correct info for verified events', () => {
      const info = getEventTypeInfo('verified');
      expect(info.label).toBe('Verified');
      expect(info.icon).toBe('✅');
      expect(info.color).toBe('text-green-600');
      expect(info.bgColor).toBe('bg-green-50');
      expect(info.borderColor).toBe('border-green-200');
    });

    it('should return correct info for revoked events', () => {
      const info = getEventTypeInfo('revoked');
      expect(info.label).toBe('Revoked');
      expect(info.icon).toBe('🚫');
      expect(info.color).toBe('text-red-600');
      expect(info.bgColor).toBe('bg-red-50');
      expect(info.borderColor).toBe('border-red-200');
    });

    it('should return default info for unknown event types', () => {
      const info = getEventTypeInfo('unknown' as any);
      expect(info.label).toBe('Unknown');
      expect(info.icon).toBe('❓');
      expect(info.color).toBe('text-gray-600');
      expect(info.bgColor).toBe('bg-gray-50');
      expect(info.borderColor).toBe('border-gray-200');
    });
  });
});
