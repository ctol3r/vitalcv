/**
 * Marketplace SDK Enhancements
 *
 * Provides helpers for building marketplace-ready modules:
 * - Signing manifests
 * - Packaging modules
 * - Testing modules
 * - Documentation and examples
 */
import { createManifest } from '../manifest';
/**
 * Sign a plugin manifest with a cryptographic signature
 *
 * @param manifest - The plugin manifest to sign
 * @param privateKey - Private key for signing (in production, use secure key management)
 * @returns Signed manifest with signature
 */
export async function signManifest(manifest, privateKey) {
    // In production, use proper cryptographic signing (e.g., Ed25519, ECDSA)
    // This is a simplified example
    const manifestString = JSON.stringify(manifest, null, 2);
    const encoder = new TextEncoder();
    const data = encoder.encode(manifestString);
    // Simple hash-based signature (replace with proper crypto in production)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return {
        ...manifest,
        signature,
        signedAt: new Date().toISOString(),
        signer: 'vendor-id', // In production, use actual vendor ID
    };
}
/**
 * Create a marketplace-ready manifest from configuration
 */
export function createMarketplaceManifest(config) {
    return createManifest({
        name: config.name,
        version: config.version,
        author: config.author,
        entrypoint: config.entrypoint,
        capabilities: config.capabilities,
        permissions: config.permissions,
        signature: null, // Will be signed separately
    });
}
/**
 * Package a module for marketplace distribution
 *
 * @param manifest - Signed manifest
 * @param files - List of file paths to include in package
 * @returns Package manifest with checksum and metadata
 */
export async function packageModule(manifest, files) {
    // In production, create a tarball or zip file
    // This is a simplified example
    const packageData = {
        manifest,
        files,
    };
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(packageData));
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const checksum = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    // Calculate package size (simplified)
    const packageSize = data.length;
    return {
        manifest,
        files,
        checksum,
        packageSize,
    };
}
/**
 * Validate a signed manifest
 */
export async function validateManifest(signedManifest, publicKey) {
    const errors = [];
    // Check required fields
    if (!signedManifest.name)
        errors.push('Missing name');
    if (!signedManifest.version)
        errors.push('Missing version');
    if (!signedManifest.author)
        errors.push('Missing author');
    if (!signedManifest.entrypoint)
        errors.push('Missing entrypoint');
    if (!signedManifest.capabilities || signedManifest.capabilities.length === 0) {
        errors.push('Missing capabilities');
    }
    if (!signedManifest.signature)
        errors.push('Missing signature');
    if (!signedManifest.signedAt)
        errors.push('Missing signedAt');
    // Validate signature (simplified - in production, use proper crypto)
    if (signedManifest.signature) {
        const { signature, signedAt, signer, ...manifest } = signedManifest;
        const manifestString = JSON.stringify(manifest, null, 2);
        const encoder = new TextEncoder();
        const data = encoder.encode(manifestString);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const expectedSignature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        if (signature !== expectedSignature) {
            errors.push('Invalid signature');
        }
    }
    return {
        valid: errors.length === 0,
        errors,
    };
}
/**
 * Test a module package
 */
export async function testModulePackage(packageManifest) {
    const errors = [];
    const warnings = [];
    // Validate manifest
    const manifestValidation = await validateManifest(packageManifest.manifest);
    if (!manifestValidation.valid) {
        errors.push(...manifestValidation.errors);
    }
    // Check package size
    if (packageManifest.packageSize > 100 * 1024 * 1024) { // 100MB
        warnings.push('Package size exceeds 100MB');
    }
    // Check required files
    if (!packageManifest.files.includes(packageManifest.manifest.entrypoint)) {
        errors.push(`Entrypoint file not found: ${packageManifest.manifest.entrypoint}`);
    }
    // Validate checksum
    const packageData = {
        manifest: packageManifest.manifest,
        files: packageManifest.files,
    };
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(packageData));
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const expectedChecksum = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    if (packageManifest.checksum !== expectedChecksum) {
        errors.push('Package checksum mismatch');
    }
    return {
        passed: errors.length === 0,
        errors,
        warnings,
    };
}
/**
 * Generate marketplace listing metadata
 */
export function generateListingMetadata(config, signedManifest) {
    return {
        name: config.name,
        version: config.version,
        author: config.author,
        description: config.description,
        category: config.category,
        tags: config.tags || [],
        fiatPrice: config.fiatPrice,
        vitaPrice: config.vitaPrice,
        subscriptionPrice: config.subscriptionPrice,
        subscriptionInterval: config.subscriptionInterval,
        capabilities: signedManifest.capabilities,
        permissions: signedManifest.permissions,
        signedAt: signedManifest.signedAt,
        signer: signedManifest.signer,
        ...config.metadata,
    };
}
/**
 * Example: Create and package a marketplace module
 */
export async function createMarketplaceModule(config, privateKey, files) {
    // Create manifest
    const manifest = createMarketplaceManifest(config);
    // Sign manifest
    const signedManifest = await signManifest(manifest, privateKey);
    // Package module
    const packageManifest = await packageModule(signedManifest, files);
    // Test package
    const testResults = await testModulePackage(packageManifest);
    if (!testResults.passed) {
        throw new Error(`Module validation failed: ${testResults.errors.join(', ')}`);
    }
    if (testResults.warnings.length > 0) {
        console.warn('Package warnings:', testResults.warnings);
    }
    return packageManifest;
}
