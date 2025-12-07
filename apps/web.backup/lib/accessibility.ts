/**
 * Accessibility Utilities
 * Task: 1106-frontend-0012
 *
 * Focus management, ARIA helpers, and keyboard navigation utilities
 */

/**
 * Trap focus within a container
 * Useful for modals and dialogs
 */
export function trapFocus(container: HTMLElement): () => void {
  const focusableElements = container.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );

  const firstFocusable = focusableElements[0] as HTMLElement;
  const lastFocusable = focusableElements[focusableElements.length - 1] as HTMLElement;

  const handleTab = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      if (document.activeElement === firstFocusable) {
        e.preventDefault();
        lastFocusable?.focus();
      }
    } else {
      if (document.activeElement === lastFocusable) {
        e.preventDefault();
        firstFocusable?.focus();
      }
    }
  };

  container.addEventListener('keydown', handleTab);

  // Focus first element
  firstFocusable?.focus();

  // Return cleanup function
  return () => {
    container.removeEventListener('keydown', handleTab);
  };
}

/**
 * Manage focus order for a list of elements
 * Returns keyboard navigation handlers
 */
export function createFocusManager(elements: HTMLElement[]) {
  let currentIndex = 0;

  const focusElement = (index: number) => {
    if (index >= 0 && index < elements.length) {
      currentIndex = index;
      elements[index]?.focus();
    }
  };

  return {
    focusNext: () => focusElement((currentIndex + 1) % elements.length),
    focusPrevious: () => focusElement((currentIndex - 1 + elements.length) % elements.length),
    focusFirst: () => focusElement(0),
    focusLast: () => focusElement(elements.length - 1),
    getCurrentIndex: () => currentIndex,
  };
}

/**
 * Announce message to screen readers
 */
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite') {
  const announcer = document.getElementById('screen-reader-announcer');

  if (!announcer) {
    // Create announcer if it doesn't exist
    const newAnnouncer = document.createElement('div');
    newAnnouncer.id = 'screen-reader-announcer';
    newAnnouncer.setAttribute('aria-live', priority);
    newAnnouncer.setAttribute('aria-atomic', 'true');
    newAnnouncer.className = 'sr-only';
    newAnnouncer.style.cssText = 'position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden;';
    document.body.appendChild(newAnnouncer);

    // Set message with slight delay to ensure it's announced
    setTimeout(() => {
      newAnnouncer.textContent = message;
    }, 100);
  } else {
    announcer.textContent = message;
  }
}

/**
 * Generate unique ID for aria-describedby/aria-labelledby
 */
let idCounter = 0;
export function generateUniqueId(prefix: string = 'a11y'): string {
  return `${prefix}-${Date.now()}-${++idCounter}`;
}

/**
 * Check if element is visible and focusable
 */
export function isFocusable(element: HTMLElement): boolean {
  if (element.getAttribute('tabindex') === '-1') return false;
  if (element.hasAttribute('disabled')) return false;
  if (element.getAttribute('aria-hidden') === 'true') return false;

  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') return false;

  return true;
}

/**
 * Create skip link for keyboard navigation
 */
export function createSkipLink(targetId: string, label: string = 'Skip to main content'): HTMLElement {
  const skipLink = document.createElement('a');
  skipLink.href = `#${targetId}`;
  skipLink.className = 'skip-link';
  skipLink.textContent = label;
  skipLink.style.cssText = `
    position: absolute;
    top: -40px;
    left: 0;
    background: #000;
    color: #fff;
    padding: 8px;
    z-index: 100;
    text-decoration: none;
  `;

  skipLink.addEventListener('focus', () => {
    skipLink.style.top = '0';
  });

  skipLink.addEventListener('blur', () => {
    skipLink.style.top = '-40px';
  });

  return skipLink;
}

/**
 * Keyboard event helpers
 */
export const keys = {
  ENTER: 'Enter',
  SPACE: ' ',
  ESCAPE: 'Escape',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  TAB: 'Tab',
  HOME: 'Home',
  END: 'End',
} as const;

export function isKey(event: KeyboardEvent, key: string): boolean {
  return event.key === key;
}

export function preventDefaultForKeys(event: KeyboardEvent, keys: string[]) {
  if (keys.includes(event.key)) {
    event.preventDefault();
  }
}
