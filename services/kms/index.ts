/**
 * B243B-KMS: Knowledge Management System
 *
 * Complete KMS service with WYSIWYG editor, collaborative editing, comments,
 * approval workflow, scheduling, SEO metadata, tagging, analytics, translations,
 * and notifications.
 */

// Models
export * from './models/ContentComment.js';

// Services
export * from './services/collaborativeEditingService.js';
export * from './services/editorialApprovalService.js';
export * from './services/contentScheduler.js';
export * from './services/metadataService.js';
export * from './services/taggingCategorisationService.js';
export * from './services/contentNotificationService.js';

// Integrations
export * from './integrations/wysiwygEditor.js';
export * from './integrations/translationManagement.js';

// Analytics
export * from './analytics/contentAnalyticsService.js';

