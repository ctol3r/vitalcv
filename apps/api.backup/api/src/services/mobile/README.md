# Mobile Offline Services

This directory contains the offline-first mobile services implementation for the VitalCV platform.

## Overview

The mobile offline services provide:
- **Local Data Storage**: Key-value storage for offline data
- **Sync Queue**: FIFO queue for pending offline operations
- **Offline Caching**: LRU cache for API responses and static assets
- **Network Status Monitoring**: Real-time network connectivity detection
- **Sync Scheduler**: Automatic sync processing when online
- **Conflict Resolution**: Strategies for resolving sync conflicts
- **Push Notifications**: Device token registration and management
- **Analytics**: Data usage tracking and anomaly detection
- **PWA Support**: Service worker for offline functionality

## Structure

```
services/mobile/
├── models/
│   ├── LocalDataStore.ts          # Local data storage model & service
│   ├── SyncQueue.ts                # Sync queue model & service
│   └── PushNotificationRegistration.ts  # Push notification registration
├── services/
│   ├── offlineCacheService.ts      # LRU cache for API/static assets
│   ├── deviceNetworkStatusService.ts  # Network connectivity monitoring
│   └── syncSchedulerService.ts    # Sync queue processor
├── strategies/
│   └── conflictResolutionStrategy.ts  # Conflict resolution strategies
├── analytics/
│   └── dataUsageAnalyticsService.ts  # Usage metrics and analytics
├── pwa/
│   └── serviceWorker.ts            # PWA service worker configuration
└── tests/
    └── offlineCore.test.ts         # Comprehensive test suite
```

## Database Models

### LocalDataStore
Stores key-value pairs for offline data:
- `key`: Unique key
- `value`: Data value (text)
- `entityType`: Entity type (for multiple tables)
- `userId`: Optional user ID for scoping
- `timestamp`: Last update timestamp

### SyncQueue
Stores pending offline operations:
- `entityType`: Type of entity to sync
- `operationType`: CREATE, UPDATE, or DELETE
- `payload`: Operation payload (JSON)
- `status`: PENDING, SYNCING, SYNCED, or ERROR
- `retryCount`: Number of retry attempts
- `userId`: Optional user ID

### PushNotificationRegistration
Stores device tokens for push notifications:
- `userId`: User ID
- `deviceId`: Device identifier
- `platform`: IOS, ANDROID, or WEB
- `token`: Push notification token
- `enabled`: Whether notifications are enabled

## Usage Examples

### Local Data Store

```typescript
import { LocalDataStoreService } from './services/mobile/models/LocalDataStore';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const dataStore = new LocalDataStoreService(prisma);

// Save data
await dataStore.save({
  key: 'user-profile',
  value: JSON.stringify({ name: 'John' }),
  entityType: 'profile',
  userId: 'user123',
});

// Retrieve data
const profile = await dataStore.get('user-profile', 'profile', 'user123');
```

### Sync Queue

```typescript
import { SyncQueueService } from './services/mobile/models/SyncQueue';
import { SyncOperationType } from '@prisma/client';

const syncQueue = new SyncQueueService(prisma);

// Enqueue operation
await syncQueue.enqueue({
  entityType: 'user',
  operationType: SyncOperationType.CREATE,
  payload: { name: 'New User' },
  userId: 'user123',
});

// Process pending items
const pending = await syncQueue.getPending({ userId: 'user123' });
```

### Offline Cache

```typescript
import { OfflineCacheService } from './services/mobile/services/offlineCacheService';

const cache = new OfflineCacheService(dataStore, {
  maxSize: 100,
  ttl: 24 * 60 * 60 * 1000, // 24 hours
});

// Cache resource
await cache.cacheResource('/api/users', { users: [] });

// Retrieve cached
const cached = await cache.getCached('/api/users');
```

### Network Status

```typescript
import { DeviceNetworkStatusService } from './services/mobile/services/deviceNetworkStatusService';

const networkStatus = new DeviceNetworkStatusService();

// Check status
if (networkStatus.isOnline()) {
  // Process sync
}

// Listen for changes
networkStatus.onStatusChange((event) => {
  console.log('Network status:', event.status);
});
```

### Sync Scheduler

```typescript
import { SyncSchedulerService } from './services/mobile/services/syncSchedulerService';

const scheduler = new SyncSchedulerService(
  syncQueue,
  networkStatus,
  {
    batchSize: 10,
    maxRetries: 3,
    exponentialBackoff: true,
  }
);

// Start processing
scheduler.startProcessing(5000); // Check every 5 seconds

// Process manually
const result = await scheduler.processSyncQueue('user123');
```

### Conflict Resolution

```typescript
import { ConflictResolutionService, ConflictResolutionStrategies } from './services/mobile/strategies/conflictResolutionStrategy';

const resolver = new ConflictResolutionService(
  ConflictResolutionStrategies.lastWriteWins
);

// Register custom strategy
resolver.registerEntityStrategy('user', (conflict) => {
  // Custom logic for user entities
  return { resolvedValue: conflict.localValue, strategy: 'custom' };
});

// Resolve conflict
const result = await resolver.resolve({
  localValue: { name: 'Local' },
  serverValue: { name: 'Server' },
  entityType: 'user',
  entityId: '1',
  localTimestamp: new Date(),
  serverTimestamp: new Date(),
});
```

### Push Notifications

```typescript
import { PushNotificationRegistrationService } from './services/mobile/models/PushNotificationRegistration';
import { PushPlatform } from '@prisma/client';

const pushService = new PushNotificationRegistrationService(prisma);

// Register device
await pushService.register({
  userId: 'user123',
  deviceId: 'device456',
  platform: PushPlatform.IOS,
  token: 'apns-token-123',
  enabled: true,
});

// Get enabled registrations
const registrations = await pushService.getEnabledByUser('user123');
```

### Analytics

```typescript
import { DataUsageAnalyticsService } from './services/mobile/analytics/dataUsageAnalyticsService';

const analytics = new DataUsageAnalyticsService(
  dataStore,
  syncQueue,
  cache
);

// Collect metrics
const metrics = await analytics.collectMetrics('user123');

// Get summary
const summary = await analytics.getSummary(
  new Date('2024-01-01'),
  new Date('2024-01-31'),
  'user123'
);

// Detect anomalies
const anomalies = analytics.detectAnomalies();
```

### PWA Service Worker

```typescript
import { PWAServiceWorkerManager, generateServiceWorkerScript } from './services/mobile/pwa/serviceWorker';

// Generate service worker script
const swScript = generateServiceWorkerScript({
  cacheName: 'vitalcv-cache-v1',
  offlineFallbackPage: '/offline.html',
});

// Initialize manager
const pwaManager = new PWAServiceWorkerManager();
await pwaManager.initialize();
```

## Testing

Run the test suite:

```bash
npm test -- offlineCore.test.ts
```

The test suite covers:
- Data store operations
- Sync queue FIFO ordering
- Cache LRU eviction
- Network status detection
- Sync processing
- Conflict resolution
- Push notification registration
- Analytics collection
- Integration scenarios (offline to online sync)

## Migration

After adding the Prisma models, run:

```bash
npx prisma migrate dev --name add_mobile_offline_models
npx prisma generate
```

## Next Steps

1. Run Prisma migration to create database tables
2. Integrate services into your API routes
3. Register service worker in your frontend app
4. Configure push notification providers (APNS, FCM, etc.)
5. Customize conflict resolution strategies for your entities
6. Set up analytics dashboards

