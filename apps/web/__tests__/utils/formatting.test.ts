import { formatEventTimestamp, getEventTypeInfo } from '@/lib/event-cache';

describe('Utility Formatting Functions', () => {
  describe('formatEventTimestamp', () => {
    beforeEach(() => {
      // Mock Date.now() to a fixed time for consistent testing
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should format "just now" for very recent timestamps', () => {
      const now = new Date('2024-01-15T12:00:00Z');
      expect(formatEventTimestamp(now.toISOString())).toBe('Just now');
    });

    it('should format minutes ago correctly', () => {
      const fiveMinutesAgo = new Date('2024-01-15T11:55:00Z');
      expect(formatEventTimestamp(fiveMinutesAgo.toISOString())).toBe('5m ago');

      const thirtyMinutesAgo = new Date('2024-01-15T11:30:00Z');
      expect(formatEventTimestamp(thirtyMinutesAgo.toISOString())).toBe('30m ago');
    });

    it('should format hours ago correctly', () => {
      const twoHoursAgo = new Date('2024-01-15T10:00:00Z');
      expect(formatEventTimestamp(twoHoursAgo.toISOString())).toBe('2h ago');

      const twelveHoursAgo = new Date('2024-01-15T00:00:00Z');
      expect(formatEventTimestamp(twelveHoursAgo.toISOString())).toBe('12h ago');
    });

    it('should format days ago correctly', () => {
      const twoDaysAgo = new Date('2024-01-13T12:00:00Z');
      expect(formatEventTimestamp(twoDaysAgo.toISOString())).toBe('2d ago');

      const sixDaysAgo = new Date('2024-01-09T12:00:00Z');
      expect(formatEventTimestamp(sixDaysAgo.toISOString())).toBe('6d ago');
    });

    it('should format old dates as locale date string', () => {
      const oldDate = new Date('2023-12-01T12:00:00Z');
      const result = formatEventTimestamp(oldDate.toISOString());
      expect(result).toBe(oldDate.toLocaleDateString());
    });

    it('should handle edge cases', () => {
      // Exactly 1 minute ago
      const oneMinuteAgo = new Date('2024-01-15T11:59:00Z');
      expect(formatEventTimestamp(oneMinuteAgo.toISOString())).toBe('1m ago');

      // Exactly 1 hour ago
      const oneHourAgo = new Date('2024-01-15T11:00:00Z');
      expect(formatEventTimestamp(oneHourAgo.toISOString())).toBe('1h ago');

      // Exactly 1 day ago
      const oneDayAgo = new Date('2024-01-14T12:00:00Z');
      expect(formatEventTimestamp(oneDayAgo.toISOString())).toBe('1d ago');
    });

    it('should handle invalid date strings gracefully', () => {
      expect(formatEventTimestamp('invalid-date')).toBe('Invalid Date');
      expect(formatEventTimestamp('')).toBe('Invalid Date');
    });
  });

  describe('getEventTypeInfo', () => {
    it('should return correct info for issued events', () => {
      const info = getEventTypeInfo('issued');

      expect(info).toEqual({
        label: 'Issued',
        icon: '📜',
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
      });
    });

    it('should return correct info for verified events', () => {
      const info = getEventTypeInfo('verified');

      expect(info).toEqual({
        label: 'Verified',
        icon: '✅',
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
      });
    });

    it('should return correct info for revoked events', () => {
      const info = getEventTypeInfo('revoked');

      expect(info).toEqual({
        label: 'Revoked',
        icon: '🚫',
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
      });
    });

    it('should return default info for unknown event types', () => {
      const info = getEventTypeInfo('unknown' as any);

      expect(info).toEqual({
        label: 'Unknown',
        icon: '❓',
        color: 'text-gray-600',
        bgColor: 'bg-gray-50',
        borderColor: 'border-gray-200',
      });
    });

    it('should handle all valid event types', () => {
      const validTypes = ['issued', 'verified', 'revoked'] as const;

      validTypes.forEach((type) => {
        const info = getEventTypeInfo(type);
        expect(info.label).toBeDefined();
        expect(info.icon).toBeDefined();
        expect(info.color).toBeDefined();
        expect(info.bgColor).toBeDefined();
        expect(info.borderColor).toBeDefined();
      });
    });
  });
});
