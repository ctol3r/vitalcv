/**
 * B243B-KMS-011: WYSIWYGEditor Integration
 *
 * Integration layer for rich text editor (TipTap or Slate).
 * Provides configuration, custom toolbar, and HTML sanitization.
 */

// Note: For production, install and use 'isomorphic-dompurify' or 'dompurify' + 'jsdom'
// For now, using a basic sanitization approach

export interface EditorConfig {
  placeholder?: string;
  minHeight?: number;
  maxHeight?: number;
  enableToolbar?: boolean;
  toolbarItems?: ToolbarItem[];
}

export type ToolbarItem =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strike'
  | 'heading'
  | 'bulletList'
  | 'orderedList'
  | 'blockquote'
  | 'code'
  | 'codeBlock'
  | 'link'
  | 'image'
  | 'table'
  | 'horizontalRule'
  | 'undo'
  | 'redo';

export interface EditorContent {
  html: string;
  text: string; // Plain text version
  wordCount: number;
}

/**
 * Default toolbar configuration
 */
export const DEFAULT_TOOLBAR: ToolbarItem[] = [
  'bold',
  'italic',
  'heading',
  'bulletList',
  'orderedList',
  'code',
  'link',
  'table',
  'undo',
  'redo',
];

/**
 * Sanitize HTML content to prevent XSS attacks
 *
 * Note: This is a basic implementation. For production, use a proper HTML sanitization
 * library like DOMPurify (isomorphic-dompurify for Node.js).
 */
export function sanitizeHtml(html: string): string {
  // Basic XSS prevention: remove script tags and dangerous attributes
  let sanitized = html
    // Remove script tags and their content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove event handlers (onclick, onerror, etc.)
    .replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '')
    // Remove javascript: protocol
    .replace(/javascript:/gi, '')
    // Remove data: URLs that could be dangerous
    .replace(/data:text\/html/gi, '')
    // Remove iframe tags
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');

  // In production, use DOMPurify:
  // import DOMPurify from 'isomorphic-dompurify';
  // return DOMPurify.sanitize(sanitized, {
  //   ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 's', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  //                  'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'a', 'img', 'table',
  //                  'thead', 'tbody', 'tr', 'th', 'td', 'hr'],
  //   ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'id'],
  // });

  return sanitized;
}

/**
 * Extract plain text from HTML
 */
export function extractTextFromHtml(html: string): string {
  // Remove HTML tags and decode entities
  const text = html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
  return text;
}

/**
 * Count words in HTML content
 */
export function countWords(html: string): number {
  const text = extractTextFromHtml(html);
  return text.split(/\s+/).filter((word) => word.length > 0).length;
}

/**
 * Process editor content: sanitize, extract text, count words
 */
export function processEditorContent(html: string): EditorContent {
  const sanitized = sanitizeHtml(html);
  const text = extractTextFromHtml(sanitized);
  const wordCount = countWords(sanitized);

  return {
    html: sanitized,
    text,
    wordCount,
  };
}

/**
 * Validate HTML content
 */
export function validateEditorContent(content: EditorContent): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!content.html || content.html.trim().length === 0) {
    errors.push('Content cannot be empty');
  }

  if (content.wordCount < 10) {
    errors.push('Content must be at least 10 words');
  }

  if (content.html.length > 100000) {
    errors.push('Content exceeds maximum length (100,000 characters)');
  }

  // Check for potentially dangerous content
  if (content.html.includes('<script') || content.html.includes('javascript:')) {
    errors.push('Content contains potentially dangerous code');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get TipTap editor configuration
 */
export function getTipTapConfig(config?: EditorConfig) {
  return {
    placeholder: config?.placeholder || 'Start writing...',
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none',
      },
    },
    extensions: [
      // Add TipTap extensions here
      // This is a placeholder - actual TipTap integration would go here
    ],
  };
}

/**
 * Get Slate editor configuration
 */
export function getSlateConfig(config?: EditorConfig) {
  return {
    placeholder: config?.placeholder || 'Start writing...',
    // Slate configuration would go here
  };
}

