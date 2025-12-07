/**
 * B242B-ACC-015: Keyboard Navigation Manager
 *
 * Handles keyboard navigation logic: focus order, skip links,
 * arrow key handling in lists and grids.
 * Ensures all interactive elements are reachable via keyboard.
 * Tests with sample components.
 */

export interface FocusableElement {
  /** Element identifier */
  id: string;
  /** DOM element reference */
  element?: HTMLElement;
  /** Tab order index */
  tabIndex: number;
  /** Whether element is currently focusable */
  focusable: boolean;
  /** Optional group identifier for arrow key navigation */
  group?: string;
  /** Optional position in grid/list */
  position?: { row: number; col: number };
}

export interface NavigationGroup {
  /** Group identifier */
  id: string;
  /** Elements in the group */
  elements: FocusableElement[];
  /** Navigation type */
  type: 'list' | 'grid' | 'menu';
  /** Orientation for arrow key navigation */
  orientation?: 'horizontal' | 'vertical' | 'both';
}

export interface SkipLink {
  /** Link identifier */
  id: string;
  /** Link text */
  label: string;
  /** Target element ID */
  targetId: string;
  /** Priority order */
  priority: number;
}

/**
 * Keyboard Navigation Manager
 */
export class KeyboardNavigationManager {
  private focusableElements: Map<string, FocusableElement> = new Map();
  private navigationGroups: Map<string, NavigationGroup> = new Map();
  private skipLinks: SkipLink[] = [];
  private currentFocusIndex: number = -1;
  private focusOrder: string[] = [];

  /**
   * Register a focusable element
   */
  registerElement(element: FocusableElement): void {
    this.focusableElements.set(element.id, element);
    this.updateFocusOrder();
  }

  /**
   * Unregister a focusable element
   */
  unregisterElement(elementId: string): void {
    this.focusableElements.delete(elementId);
    this.updateFocusOrder();
  }

  /**
   * Register a navigation group
   */
  registerGroup(group: NavigationGroup): void {
    this.navigationGroups.set(group.id, group);
  }

  /**
   * Unregister a navigation group
   */
  unregisterGroup(groupId: string): void {
    this.navigationGroups.delete(groupId);
  }

  /**
   * Add a skip link
   */
  addSkipLink(skipLink: SkipLink): void {
    this.skipLinks.push(skipLink);
    this.skipLinks.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Update focus order based on tabIndex and DOM order
   */
  private updateFocusOrder(): void {
    const elements = Array.from(this.focusableElements.values())
      .filter((el) => el.focusable)
      .sort((a, b) => {
        // Sort by tabIndex first, then by registration order
        if (a.tabIndex !== b.tabIndex) {
          return a.tabIndex - b.tabIndex;
        }
        return 0;
      });

    this.focusOrder = elements.map((el) => el.id);
  }

  /**
   * Move focus to next element
   */
  focusNext(): boolean {
    if (this.focusOrder.length === 0) {
      return false;
    }

    this.currentFocusIndex =
      (this.currentFocusIndex + 1) % this.focusOrder.length;
    const elementId = this.focusOrder[this.currentFocusIndex];
    return this.focusElement(elementId);
  }

  /**
   * Move focus to previous element
   */
  focusPrevious(): boolean {
    if (this.focusOrder.length === 0) {
      return false;
    }

    this.currentFocusIndex =
      (this.currentFocusIndex - 1 + this.focusOrder.length) %
      this.focusOrder.length;
    const elementId = this.focusOrder[this.currentFocusIndex];
    return this.focusElement(elementId);
  }

  /**
   * Focus a specific element
   */
  focusElement(elementId: string): boolean {
    const element = this.focusableElements.get(elementId);
    if (!element || !element.focusable) {
      return false;
    }

    if (element.element) {
      element.element.focus();
      this.currentFocusIndex = this.focusOrder.indexOf(elementId);
      return true;
    }

    // Try to find element in DOM
    const domElement = document.getElementById(elementId);
    if (domElement) {
      domElement.focus();
      this.currentFocusIndex = this.focusOrder.indexOf(elementId);
      return true;
    }

    return false;
  }

  /**
   * Handle arrow key navigation within a group
   */
  handleArrowKey(
    currentElementId: string,
    direction: 'up' | 'down' | 'left' | 'right',
    groupId?: string
  ): boolean {
    const currentElement = this.focusableElements.get(currentElementId);
    if (!currentElement) {
      return false;
    }

    // Find the group
    let group: NavigationGroup | undefined;
    if (groupId) {
      group = this.navigationGroups.get(groupId);
    } else if (currentElement.group) {
      group = this.navigationGroups.get(currentElement.group);
    }

    if (!group) {
      return false;
    }

    // Handle based on group type
    switch (group.type) {
      case 'list':
        return this.handleListNavigation(currentElement, direction, group);
      case 'grid':
        return this.handleGridNavigation(currentElement, direction, group);
      case 'menu':
        return this.handleMenuNavigation(currentElement, direction, group);
      default:
        return false;
    }
  }

  /**
   * Handle navigation in a list
   */
  private handleListNavigation(
    currentElement: FocusableElement,
    direction: 'up' | 'down' | 'left' | 'right',
    group: NavigationGroup
  ): boolean {
    const currentIndex = group.elements.findIndex(
      (el) => el.id === currentElement.id
    );
    if (currentIndex === -1) {
      return false;
    }

    let nextIndex: number;
    const orientation = group.orientation || 'vertical';

    if (orientation === 'vertical') {
      if (direction === 'down') {
        nextIndex = Math.min(currentIndex + 1, group.elements.length - 1);
      } else if (direction === 'up') {
        nextIndex = Math.max(currentIndex - 1, 0);
      } else {
        return false;
      }
    } else {
      // Horizontal
      if (direction === 'right') {
        nextIndex = Math.min(currentIndex + 1, group.elements.length - 1);
      } else if (direction === 'left') {
        nextIndex = Math.max(currentIndex - 1, 0);
      } else {
        return false;
      }
    }

    const nextElement = group.elements[nextIndex];
    return this.focusElement(nextElement.id);
  }

  /**
   * Handle navigation in a grid
   */
  private handleGridNavigation(
    currentElement: FocusableElement,
    direction: 'up' | 'down' | 'left' | 'right',
    group: NavigationGroup
  ): boolean {
    if (!currentElement.position) {
      return false;
    }

    const { row, col } = currentElement.position;
    let nextRow = row;
    let nextCol = col;

    switch (direction) {
      case 'up':
        nextRow = Math.max(row - 1, 0);
        break;
      case 'down':
        nextRow = row + 1;
        break;
      case 'left':
        nextCol = Math.max(col - 1, 0);
        break;
      case 'right':
        nextCol = col + 1;
        break;
    }

    // Find element at new position
    const nextElement = group.elements.find(
      (el) =>
        el.position?.row === nextRow && el.position?.col === nextCol
    );

    if (nextElement) {
      return this.focusElement(nextElement.id);
    }

    return false;
  }

  /**
   * Handle navigation in a menu
   */
  private handleMenuNavigation(
    currentElement: FocusableElement,
    direction: 'up' | 'down' | 'left' | 'right',
    group: NavigationGroup
  ): boolean {
    // Menu navigation is similar to list but may have submenus
    return this.handleListNavigation(currentElement, direction, group);
  }

  /**
   * Generate skip links HTML
   */
  generateSkipLinksHTML(): string {
    if (this.skipLinks.length === 0) {
      return '';
    }

    let html = '<div class="skip-links" role="navigation" aria-label="Skip links">';
    for (const link of this.skipLinks) {
      html += `<a href="#${link.targetId}" class="skip-link">${link.label}</a>`;
    }
    html += '</div>';

    return html;
  }

  /**
   * Generate skip links CSS
   */
  generateSkipLinksCSS(): string {
    return `
      .skip-links {
        position: absolute;
        top: -40px;
        left: 0;
        z-index: 1000;
      }
      .skip-link {
        position: absolute;
        top: 0;
        left: 0;
        padding: 8px 16px;
        background: #000;
        color: #fff;
        text-decoration: none;
        border: 2px solid #fff;
        outline: none;
      }
      .skip-link:focus {
        top: 0;
        position: relative;
      }
    `;
  }

  /**
   * Check if all interactive elements are keyboard accessible
   */
  validateAccessibility(): {
    isValid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    // Check if all elements are focusable
    for (const [id, element] of this.focusableElements.entries()) {
      if (!element.focusable) {
        issues.push(`Element ${id} is not focusable`);
      }
      if (element.tabIndex < 0 && element.tabIndex !== -1) {
        issues.push(`Element ${id} has invalid tabIndex: ${element.tabIndex}`);
      }
    }

    // Check focus order
    if (this.focusOrder.length === 0) {
      issues.push('No focusable elements registered');
    }

    // Check for duplicate tabIndex values (except -1)
    const tabIndices = Array.from(this.focusableElements.values())
      .map((el) => el.tabIndex)
      .filter((idx) => idx >= 0);
    const duplicates = tabIndices.filter(
      (idx, i) => tabIndices.indexOf(idx) !== i
    );
    if (duplicates.length > 0) {
      issues.push(`Duplicate tabIndex values found: ${duplicates.join(', ')}`);
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  }

  /**
   * Set up keyboard event listeners
   */
  setupKeyboardListeners(element: HTMLElement): void {
    element.addEventListener('keydown', (event) => {
      // Handle Tab key
      if (event.key === 'Tab') {
        if (event.shiftKey) {
          event.preventDefault();
          this.focusPrevious();
        } else {
          event.preventDefault();
          this.focusNext();
        }
        return;
      }

      // Handle Arrow keys
      const currentId = document.activeElement?.id;
      if (!currentId) {
        return;
      }

      let handled = false;
      switch (event.key) {
        case 'ArrowUp':
          handled = this.handleArrowKey(currentId, 'up');
          break;
        case 'ArrowDown':
          handled = this.handleArrowKey(currentId, 'down');
          break;
        case 'ArrowLeft':
          handled = this.handleArrowKey(currentId, 'left');
          break;
        case 'ArrowRight':
          handled = this.handleArrowKey(currentId, 'right');
          break;
      }

      if (handled) {
        event.preventDefault();
      }
    });
  }
}

/**
 * Singleton instance
 */
export const keyboardNavigationManager = new KeyboardNavigationManager();

/**
 * Default export
 */
export default keyboardNavigationManager;

