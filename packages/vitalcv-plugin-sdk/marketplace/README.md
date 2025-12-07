# Marketplace SDK

Helpers for building marketplace-ready modules for the VitalCV platform.

## Features

- **Manifest Signing**: Cryptographically sign module manifests
- **Module Packaging**: Package modules for distribution
- **Validation**: Validate manifests and packages
- **Testing**: Test modules before publishing
- **Listing Generation**: Generate marketplace listing metadata

## Quick Start

### Creating a Marketplace Module

```typescript
import {
  createMarketplaceModule,
  MarketplaceModuleConfig,
} from '@vitalcv/plugin-sdk/marketplace';

const config: MarketplaceModuleConfig = {
  name: 'my-module',
  version: '1.0.0',
  author: 'vendor-name',
  entrypoint: './index.js',
  capabilities: ['readTimeline', 'writeEvents'],
  description: 'A useful module',
  category: 'analytics',
  tags: ['analytics', 'reporting'],
  fiatPrice: 999, // $9.99 in cents
  vitaPrice: 100, // 100 VITA tokens
  subscriptionPrice: 499, // $4.99/month
  subscriptionInterval: 'monthly',
};

// Create and package the module
const packageManifest = await createMarketplaceModule(
  config,
  'your-private-key', // Use secure key management in production
  ['./index.js', './package.json', './README.md']
);

console.log('Package checksum:', packageManifest.checksum);
console.log('Package size:', packageManifest.packageSize);
```

### Signing a Manifest

```typescript
import { signManifest, createMarketplaceManifest } from '@vitalcv/plugin-sdk/marketplace';

// Create manifest
const manifest = createMarketplaceManifest({
  name: 'my-module',
  version: '1.0.0',
  author: 'vendor-name',
  entrypoint: './index.js',
  capabilities: ['readTimeline'],
});

// Sign manifest
const signedManifest = await signManifest(manifest, 'your-private-key');
console.log('Signature:', signedManifest.signature);
```

### Validating a Manifest

```typescript
import { validateManifest } from '@vitalcv/plugin-sdk/marketplace';

const validation = await validateManifest(signedManifest);
if (!validation.valid) {
  console.error('Validation errors:', validation.errors);
} else {
  console.log('Manifest is valid!');
}
```

### Testing a Package

```typescript
import { testModulePackage } from '@vitalcv/plugin-sdk/marketplace';

const testResults = await testModulePackage(packageManifest);
if (!testResults.passed) {
  console.error('Test failed:', testResults.errors);
} else {
  console.log('Package tests passed!');
  if (testResults.warnings.length > 0) {
    console.warn('Warnings:', testResults.warnings);
  }
}
```

## API Reference

### `createMarketplaceManifest(config)`

Creates a plugin manifest from marketplace configuration.

### `signManifest(manifest, privateKey)`

Signs a manifest with a cryptographic signature.

### `packageModule(manifest, files)`

Packages a module for distribution with checksum validation.

### `validateManifest(signedManifest, publicKey?)`

Validates a signed manifest's structure and signature.

### `testModulePackage(packageManifest)`

Tests a module package for correctness and best practices.

### `generateListingMetadata(config, signedManifest)`

Generates marketplace listing metadata from config and manifest.

### `createMarketplaceModule(config, privateKey, files)`

Complete workflow: creates manifest, signs it, packages it, and tests it.

## Examples

See the `examples/` directory for complete examples of:
- Creating a simple module
- Publishing to marketplace
- Testing modules
- Handling subscriptions

## Security Notes

⚠️ **Important**: The signing implementation in this SDK is simplified for development. In production:

1. Use proper cryptographic signing (Ed25519, ECDSA, etc.)
2. Store private keys securely (HSM, key management service)
3. Never commit private keys to version control
4. Use environment variables or secure key storage
5. Implement proper key rotation

## Best Practices

1. **Versioning**: Use semantic versioning (semver) for module versions
2. **Capabilities**: Only declare capabilities your module actually uses
3. **Permissions**: Request minimal permissions needed
4. **Testing**: Always test packages before publishing
5. **Documentation**: Include clear README and changelog
6. **Pricing**: Set reasonable prices and consider subscription options

## Support

For questions or issues, contact the VitalCV marketplace team or visit the documentation.

