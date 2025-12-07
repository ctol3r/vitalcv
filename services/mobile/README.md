# Mobile Services

Mobile services for offline-first functionality, PWA support, and device integration.

## Services Overview

### APIs

#### MobileSyncAPIController (`api/mobileSyncAPI.ts`)
- Provides endpoints for syncing data from offline clients
- Accepts batch operations from SyncQueue
- Validates payloads and returns per-item results
- Handles partial successes
- Enforces authentication

#### MobileBatchSyncAPI (`api/mobileBatchSyncAPI.ts`)
- API to synchronize multiple data entities in a single request
- Accepts nested structures for different entity types (forms, tasks, messages)
- Validates per-entity
- Returns consolidated results
- Supports versioning

### Services

#### BackgroundSyncTaskScheduler (`services/backgroundSyncTaskScheduler.ts`)
- Schedules background syncs at intervals or triggers on network availability
- Uses OS APIs (stubbed) for background tasks
- Ensures battery-friendly operation
- Includes test scenarios

#### OfflineAuthService (`services/offlineAuthService.ts`)
- Stores auth tokens securely offline
- Re-authenticates when back online
- Handles token refresh
- Supports offline checks for user identity (for local-only actions)
- Encrypts tokens with device keychain

#### DeviceCapabilityService (`services/deviceCapabilityService.ts`)
- Detects capabilities of the device: OS, screen size, camera availability, biometrics support
- Exposes API for components to adapt functionality
- Includes tests for different mock devices

### Integrations

#### PushNotificationService (`integrations/pushNotificationService.ts`)
- Integrates with push services (Firebase Cloud Messaging, APNs)
- Sends notifications for new messages, reminders
- Includes methods to send targeted notifications
- Unit tests with stubs

#### BiometricAuthIntegration (`integrations/biometricAuthIntegration.ts`)
- Defines interface for biometric authentication (fingerprint, Face ID)
- Stubs implementation for future integration
- Includes fallback to offline auth
- Provides API for UI to trigger biometrics

### PWA

#### PWAManifestGenerator (`pwa/manifestGenerator.ts`)
- Generates manifest.json with app name, icons, theme colours, start URL, display mode, background colour
- Supports multiple icon sizes
- Updates when app metadata changes

#### PWAInstallPromptService (`pwa/installPromptService.ts`)
- Handles browser events to prompt users to install the PWA
- Logs user responses
- Exposes methods to trigger and hide prompt
- Ensures prompt appears only when appropriate

### Utils

#### LocalEncryption (`utils/localEncryption.ts`)
- Encrypts sensitive data at rest on device using AES
- Provides functions to encrypt/decrypt with a per-device key
- Integrates with LocalDataStore
- Tests for correct encryption and decryption

## Usage Examples

### Sync API

```typescript
import { mobileSyncAPIController, validateSyncRequest } from './api/mobileSyncAPI.js';

const request = validateSyncRequest({
  operations: [
    {
      id: 'op1',
      type: 'create',
      entity: 'form',
      data: { field1: 'value1' },
      timestamp: Date.now(),
    },
  ],
  deviceId: 'device123',
});

const response = await mobileSyncAPIController.processSync(request);
```

### Background Sync Scheduler

```typescript
import { backgroundSyncTaskScheduler } from './services/backgroundSyncTaskScheduler.js';

backgroundSyncTaskScheduler.registerTask({
  id: 'sync-forms',
  schedule: {
    interval: 300000, // 5 minutes
    triggerOnNetwork: true,
    minBatteryLevel: 20,
  },
  callback: async () => {
    // Perform sync
  },
  enabled: true,
});
```

### Offline Auth

```typescript
import { offlineAuthService } from './services/offlineAuthService.js';

// Store tokens
await offlineAuthService.storeTokens({
  accessToken: 'token123',
  refreshToken: 'refresh123',
  expiresAt: Date.now() + 3600000,
  userId: 'user123',
  email: 'user@example.com',
});

// Check auth state
const state = await offlineAuthService.getOfflineAuthState();
```

### Device Capabilities

```typescript
import { deviceCapabilityService } from './services/deviceCapabilityService.js';

const capabilities = await deviceCapabilityService.getCapabilities();
console.log(capabilities.os.name); // 'ios' | 'android' | etc.
console.log(capabilities.camera.available); // true/false
```

### Push Notifications

```typescript
import { pushNotificationService } from './integrations/pushNotificationService.js';

await pushNotificationService.sendNotification(
  {
    deviceToken: 'token123',
    platform: 'ios',
    userId: 'user123',
  },
  {
    title: 'New Message',
    body: 'You have a new message',
    priority: 'high',
  },
);
```

### PWA Manifest

```typescript
import { pwaManifestGenerator } from './pwa/manifestGenerator.js';

const manifest = pwaManifestGenerator.generateManifest({
  name: 'VitalCV',
  shortName: 'VitalCV',
  backgroundColor: '#ffffff',
  themeColor: '#0066cc',
});

const manifestJSON = pwaManifestGenerator.generateManifestJSON({
  name: 'VitalCV',
  shortName: 'VitalCV',
});
```

### PWA Install Prompt

```typescript
import { pwaInstallPromptService } from './pwa/installPromptService.js';

if (pwaInstallPromptService.isPromptAvailable()) {
  const result = await pwaInstallPromptService.showInstallPrompt();
  if (result.outcome === 'accepted') {
    console.log('User installed the app');
  }
}
```

### Local Encryption

```typescript
import { localEncryption } from './utils/localEncryption.js';

await localEncryption.initialize();

const encrypted = await localEncryption.encrypt('sensitive data');
const decrypted = await localEncryption.decrypt(encrypted);
```

## Testing

All services include stub implementations for development and testing. In production, replace stubs with actual implementations:

- **BackgroundSyncTaskScheduler**: Use native OS background task APIs
- **PushNotificationService**: Integrate with Firebase Cloud Messaging or APNs
- **OfflineAuthService**: Use platform-specific secure storage (Keychain, Keystore)
- **LocalEncryption**: Use Web Crypto API or native crypto libraries
- **BiometricAuthIntegration**: Use platform-specific biometric APIs

## Notes

- All services are designed to work in both browser and Node.js environments
- Stub implementations are provided for development
- Production implementations should use platform-specific APIs for security and performance
- Services handle offline scenarios gracefully with fallback mechanisms

