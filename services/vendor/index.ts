/**
 * Vendor Service - Main export file
 *
 * B240A-VM-*: Vendor Management System
 * Provides models, services, APIs, and storage for vendor management
 */

// Models
export * from './models/Vendor.js';
export * from './models/VendorContact.js';
export * from './models/VendorOnboardingFlow.js';
export * from './models/VendorCategory.js';
export * from './models/ContractLibrary.js';

// Services
export { VendorProfileService } from './services/vendorProfileService.js';
export { ContractManagementService } from './services/contractManagementService.js';

// Storage
export * from './storage/vendorDocumentStorage.js';

// API
export { default as vendorRepositoryAPI } from './api/vendorRepositoryAPI.js';
