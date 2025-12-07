/**
 * Marketplace SDK Examples
 *
 * Example usage patterns for building marketplace-ready modules
 */

import {
	createMarketplaceModule,
	createMarketplaceManifest,
	signManifest,
	packageModule,
	validateManifest,
	testModulePackage,
	generateListingMetadata,
	type MarketplaceModuleConfig,
} from './index';

/**
 * Example 1: Create a simple module
 */
export async function exampleCreateSimpleModule() {
	const config: MarketplaceModuleConfig = {
		name: 'analytics-module',
		version: '1.0.0',
		author: 'acme-vendor',
		entrypoint: './src/index.js',
		capabilities: ['readTimeline', 'runAnalysis'],
		description: 'Advanced analytics module for timeline analysis',
		category: 'analytics',
		tags: ['analytics', 'reporting', 'timeline'],
		fiatPrice: 1999, // $19.99
	};

	const privateKey = 'example-private-key'; // Use secure key management in production
	const files = ['./src/index.js', './package.json', './README.md'];

	const packageManifest = await createMarketplaceModule(config, privateKey, files);
	console.log('Module packaged:', packageManifest.checksum);
	return packageManifest;
}

/**
 * Example 2: Create a subscription-based module
 */
export async function exampleCreateSubscriptionModule() {
	const config: MarketplaceModuleConfig = {
		name: 'premium-features',
		version: '2.0.0',
		author: 'acme-vendor',
		entrypoint: './index.js',
		capabilities: ['readTimeline', 'writeEvents', 'provideForecasts'],
		description: 'Premium features with advanced forecasting',
		category: 'premium',
		tags: ['premium', 'forecasting'],
		subscriptionPrice: 999, // $9.99/month
		subscriptionInterval: 'monthly',
	};

	const manifest = createMarketplaceManifest(config);
	const signedManifest = await signManifest(manifest, 'private-key');
	const packageManifest = await packageModule(signedManifest, ['./index.js']);

	return packageManifest;
}

/**
 * Example 3: Validate an existing manifest
 */
export async function exampleValidateManifest(signedManifest: any) {
	const validation = await validateManifest(signedManifest);

	if (!validation.valid) {
		console.error('Manifest validation failed:');
		validation.errors.forEach(error => console.error(`  - ${error}`));
		return false;
	}

	console.log('Manifest is valid!');
	return true;
}

/**
 * Example 4: Test a package before publishing
 */
export async function exampleTestPackage(packageManifest: any) {
	const testResults = await testModulePackage(packageManifest);

	if (!testResults.passed) {
		console.error('Package tests failed:');
		testResults.errors.forEach(error => console.error(`  - ${error}`));
		return false;
	}

	if (testResults.warnings.length > 0) {
		console.warn('Package warnings:');
		testResults.warnings.forEach(warning => console.warn(`  - ${warning}`));
	}

	console.log('Package tests passed!');
	return true;
}

/**
 * Example 5: Generate listing metadata
 */
export async function exampleGenerateListing() {
	const config: MarketplaceModuleConfig = {
		name: 'my-module',
		version: '1.0.0',
		author: 'vendor',
		entrypoint: './index.js',
		capabilities: ['readTimeline'],
		description: 'My module description',
		category: 'tools',
		tags: ['tool'],
		fiatPrice: 499,
	};

	const manifest = createMarketplaceManifest(config);
	const signedManifest = await signManifest(manifest, 'private-key');
	const listingMetadata = generateListingMetadata(config, signedManifest);

	console.log('Listing metadata:', JSON.stringify(listingMetadata, null, 2));
	return listingMetadata;
}

/**
 * Example 6: Complete workflow
 */
export async function exampleCompleteWorkflow() {
	// 1. Define module configuration
	const config: MarketplaceModuleConfig = {
		name: 'complete-module',
		version: '1.0.0',
		author: 'vendor-id',
		entrypoint: './src/index.js',
		capabilities: ['readTimeline', 'writeEvents'],
		description: 'A complete module example',
		category: 'integration',
		tags: ['integration', 'api'],
		fiatPrice: 2999,
		vitaPrice: 300,
		subscriptionPrice: 1499,
		subscriptionInterval: 'monthly',
	};

	// 2. Create and package module
	const packageManifest = await createMarketplaceModule(
		config,
		'private-key',
		['./src/index.js', './package.json']
	);

	// 3. Test package
	const testResults = await testModulePackage(packageManifest);
	if (!testResults.passed) {
		throw new Error(`Package validation failed: ${testResults.errors.join(', ')}`);
	}

	// 4. Generate listing metadata
	const listingMetadata = generateListingMetadata(config, packageManifest.manifest);

	// 5. Ready to publish!
	console.log('Module ready for marketplace:', {
		checksum: packageManifest.checksum,
		size: packageManifest.packageSize,
		metadata: listingMetadata,
	});

	return { packageManifest, listingMetadata };
}

