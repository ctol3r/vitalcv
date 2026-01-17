/**
 * Marketplace SDK Enhancements
 *
 * Provides helpers for building marketplace-ready modules:
 * - Signing manifests
 * - Packaging modules
 * - Testing modules
 * - Documentation and examples
 */
import { PluginCapability, PluginManifest } from '../src/types';
export interface MarketplaceModuleConfig {
  name: string;
  version: string;
  author: string;
  entrypoint: string;
  capabilities: PluginCapability[];
  permissions?: string[];
  description?: string;
  category?: string;
  tags?: string[];
  fiatPrice?: number;
  vitaPrice?: number;
  subscriptionPrice?: number;
  subscriptionInterval?: 'monthly' | 'yearly';
  metadata?: Record<string, unknown>;
}
export interface SignedManifest extends PluginManifest {
  signature: string;
  signedAt: string;
  signer: string;
}
export interface PackageManifest {
  manifest: SignedManifest;
  files: string[];
  checksum: string;
  packageSize: number;
}
/**
 * Sign a plugin manifest with a cryptographic signature
 *
 * @param manifest - The plugin manifest to sign
 * @param privateKey - Private key for signing (in production, use secure key management)
 * @returns Signed manifest with signature
 */
export declare function signManifest(
  manifest: PluginManifest,
  privateKey: string,
): Promise<SignedManifest>;
/**
 * Create a marketplace-ready manifest from configuration
 */
export declare function createMarketplaceManifest(config: MarketplaceModuleConfig): PluginManifest;
/**
 * Package a module for marketplace distribution
 *
 * @param manifest - Signed manifest
 * @param files - List of file paths to include in package
 * @returns Package manifest with checksum and metadata
 */
export declare function packageModule(
  manifest: SignedManifest,
  files: string[],
): Promise<PackageManifest>;
/**
 * Validate a signed manifest
 */
export declare function validateManifest(
  signedManifest: SignedManifest,
  publicKey?: string,
): Promise<{
  valid: boolean;
  errors: string[];
}>;
/**
 * Test a module package
 */
export declare function testModulePackage(packageManifest: PackageManifest): Promise<{
  passed: boolean;
  errors: string[];
  warnings: string[];
}>;
/**
 * Generate marketplace listing metadata
 */
export declare function generateListingMetadata(
  config: MarketplaceModuleConfig,
  signedManifest: SignedManifest,
): Record<string, unknown>;
/**
 * Example: Create and package a marketplace module
 */
export declare function createMarketplaceModule(
  config: MarketplaceModuleConfig,
  privateKey: string,
  files: string[],
): Promise<PackageManifest>;
