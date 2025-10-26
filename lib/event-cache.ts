/**
 * Local Event Cache Utilities
 * Manages credential events (issued, verified, revoked) in localStorage
 */

export interface CredentialEvent {
  id: string;
  credentialId: string;
  type: 'issued' | 'verified' | 'revoked';
  timestamp: string;
  auditRef?: string;
  details?: {
    issuer?: string;
    reason?: string;
    status?: string;
    subjectId?: string;
  };
}

export interface EventCache {
  [credentialId: string]: CredentialEvent[];
}

const CACHE_KEY = 'vitalcv_event_cache';
const MAX_EVENTS_PER_CREDENTIAL = 50;
const MAX_TOTAL_EVENTS = 1000;

/**
 * Get all events from localStorage
 */
export function getEventCache(): EventCache {
  if (typeof window === 'undefined') return {};

  try {
    const cached = localStorage.getItem(CACHE_KEY);
    return cached ? JSON.parse(cached) : {};
  } catch (error) {
    console.warn('Failed to read event cache:', error);
    return {};
  }
}

/**
 * Save events to localStorage
 */
export function saveEventCache(cache: EventCache): void {
  if (typeof window === 'undefined') return;

  try {
    // Clean up old events to prevent localStorage bloat
    const cleanedCache = cleanupEventCache(cache);
    localStorage.setItem(CACHE_KEY, JSON.stringify(cleanedCache));
  } catch (error) {
    console.warn('Failed to save event cache:', error);
  }
}

/**
 * Add a new event to the cache
 */
export function addEvent(event: Omit<CredentialEvent, 'id'>): void {
  const cache = getEventCache();
  const credentialId = event.credentialId;

  if (!cache[credentialId]) {
    cache[credentialId] = [];
  }

  const newEvent: CredentialEvent = {
    ...event,
    id: `${event.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  };

  cache[credentialId].unshift(newEvent); // Add to beginning

  // Limit events per credential
  if (cache[credentialId].length > MAX_EVENTS_PER_CREDENTIAL) {
    cache[credentialId] = cache[credentialId].slice(0, MAX_EVENTS_PER_CREDENTIAL);
  }

  saveEventCache(cache);
}

/**
 * Get events for a specific credential
 */
export function getEventsForCredential(credentialId: string): CredentialEvent[] {
  const cache = getEventCache();
  return cache[credentialId] || [];
}

/**
 * Get all events across all credentials (sorted by timestamp)
 */
export function getAllEvents(): CredentialEvent[] {
  const cache = getEventCache();
  const allEvents: CredentialEvent[] = [];

  Object.values(cache).forEach((events) => {
    allEvents.push(...events);
  });

  return allEvents.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

/**
 * Get recent events (last 24 hours)
 */
export function getRecentEvents(hours: number = 24): CredentialEvent[] {
  const allEvents = getAllEvents();
  const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);

  return allEvents.filter((event) => new Date(event.timestamp) > cutoffTime);
}

/**
 * Clear all events
 */
export function clearEventCache(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(CACHE_KEY);
  } catch (error) {
    console.warn('Failed to clear event cache:', error);
  }
}

/**
 * Clear events for a specific credential
 */
export function clearEventsForCredential(credentialId: string): void {
  const cache = getEventCache();
  delete cache[credentialId];
  saveEventCache(cache);
}

/**
 * Clean up old events to prevent localStorage bloat
 */
function cleanupEventCache(cache: EventCache): EventCache {
  const allEvents = getAllEvents();

  if (allEvents.length <= MAX_TOTAL_EVENTS) {
    return cache;
  }

  // Keep only the most recent events
  const recentEvents = allEvents.slice(0, MAX_TOTAL_EVENTS);
  const cleanedCache: EventCache = {};

  recentEvents.forEach((event) => {
    if (!cleanedCache[event.credentialId]) {
      cleanedCache[event.credentialId] = [];
    }
    cleanedCache[event.credentialId].push(event);
  });

  return cleanedCache;
}

/**
 * Format timestamp for display
 */
export function formatEventTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) {
    return 'Just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString();
  }
}

/**
 * Get event type display info
 */
export function getEventTypeInfo(type: CredentialEvent['type']) {
  switch (type) {
    case 'issued':
      return {
        label: 'Issued',
        icon: '📜',
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
      };
    case 'verified':
      return {
        label: 'Verified',
        icon: '✅',
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
      };
    case 'revoked':
      return {
        label: 'Revoked',
        icon: '🚫',
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
      };
    default:
      return {
        label: 'Unknown',
        icon: '❓',
        color: 'text-gray-600',
        bgColor: 'bg-gray-50',
        borderColor: 'border-gray-200',
      };
  }
}
