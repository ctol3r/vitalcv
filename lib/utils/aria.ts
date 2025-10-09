/**
 * ARIA Utilities
 *
 * Helper functions for adding ARIA attributes to components
 * following WAI-ARIA Authoring Practices Guide
 */

/**
 * Generate unique ID for ARIA relationships
 */
export function generateAriaId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * ARIA Live Region Announcer
 * For screen reader announcements without visual changes
 */
export function announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
  if (typeof window === 'undefined') return

  const announcer = document.getElementById('aria-live-announcer')
  if (announcer) {
    announcer.textContent = message
    announcer.setAttribute('aria-live', priority)
  } else {
    // Create announcer if it doesn't exist
    const newAnnouncer = document.createElement('div')
    newAnnouncer.id = 'aria-live-announcer'
    newAnnouncer.setAttribute('role', 'status')
    newAnnouncer.setAttribute('aria-live', priority)
    newAnnouncer.setAttribute('aria-atomic', 'true')
    newAnnouncer.className = 'sr-only'
    newAnnouncer.textContent = message
    document.body.appendChild(newAnnouncer)
  }
}

/**
 * Get ARIA attributes for form field with error
 */
export function getFieldAriaAttributes(
  fieldId: string,
  error?: string,
  description?: string
): {
  'aria-invalid'?: boolean
  'aria-describedby'?: string
  'aria-errormessage'?: string
} {
  const describedBy: string[] = []

  if (description) {
    describedBy.push(`${fieldId}-description`)
  }

  if (error) {
    describedBy.push(`${fieldId}-error`)
    return {
      'aria-invalid': true,
      'aria-describedby': describedBy.join(' '),
      'aria-errormessage': `${fieldId}-error`,
    }
  }

  return describedBy.length > 0
    ? { 'aria-describedby': describedBy.join(' ') }
    : {}
}

/**
 * Get ARIA attributes for a button
 */
export function getButtonAriaAttributes(
  label: string,
  options?: {
    pressed?: boolean
    expanded?: boolean
    controls?: string
    describedBy?: string
  }
): Record<string, string | boolean> {
  const attrs: Record<string, string | boolean> = {
    'aria-label': label,
  }

  if (options?.pressed !== undefined) {
    attrs['aria-pressed'] = options.pressed
  }

  if (options?.expanded !== undefined) {
    attrs['aria-expanded'] = options.expanded
  }

  if (options?.controls) {
    attrs['aria-controls'] = options.controls
  }

  if (options?.describedBy) {
    attrs['aria-describedby'] = options.describedBy
  }

  return attrs
}

/**
 * Get ARIA attributes for a dialog/modal
 */
export function getDialogAriaAttributes(
  titleId: string,
  descriptionId?: string
): {
  role: 'dialog'
  'aria-modal': boolean
  'aria-labelledby': string
  'aria-describedby'?: string
} {
  const attrs = {
    role: 'dialog' as const,
    'aria-modal': true,
    'aria-labelledby': titleId,
  }

  if (descriptionId) {
    return { ...attrs, 'aria-describedby': descriptionId }
  }

  return attrs
}

/**
 * Get ARIA attributes for a tabs component
 */
export function getTabsAriaAttributes(tabId: string, panelId: string) {
  return {
    tab: {
      role: 'tab',
      id: tabId,
      'aria-controls': panelId,
      'aria-selected': false,
      tabIndex: -1,
    },
    panel: {
      role: 'tabpanel',
      id: panelId,
      'aria-labelledby': tabId,
      tabIndex: 0,
    },
    list: {
      role: 'tablist',
    },
  }
}

/**
 * Get ARIA attributes for a menu
 */
export function getMenuAriaAttributes(menuId: string) {
  return {
    trigger: {
      'aria-haspopup': 'true' as const,
      'aria-expanded': false,
      'aria-controls': menuId,
    },
    menu: {
      role: 'menu' as const,
      id: menuId,
    },
    item: {
      role: 'menuitem' as const,
      tabIndex: -1,
    },
  }
}

/**
 * Get ARIA attributes for a combobox/autocomplete
 */
export function getComboboxAriaAttributes(
  listboxId: string,
  options?: {
    activeDescendant?: string
    expanded?: boolean
  }
) {
  return {
    combobox: {
      role: 'combobox' as const,
      'aria-controls': listboxId,
      'aria-expanded': options?.expanded ?? false,
      'aria-autocomplete': 'list' as const,
      ...(options?.activeDescendant && {
        'aria-activedescendant': options.activeDescendant,
      }),
    },
    listbox: {
      role: 'listbox' as const,
      id: listboxId,
    },
    option: {
      role: 'option' as const,
    },
  }
}

/**
 * Get ARIA attributes for an alert
 */
export function getAlertAriaAttributes(
  type: 'info' | 'success' | 'warning' | 'error' = 'info'
): {
  role: 'alert' | 'status'
  'aria-live': 'polite' | 'assertive'
  'aria-atomic': boolean
} {
  const isUrgent = type === 'error' || type === 'warning'

  return {
    role: isUrgent ? 'alert' : 'status',
    'aria-live': isUrgent ? 'assertive' : 'polite',
    'aria-atomic': true,
  }
}

/**
 * Get ARIA attributes for a progress bar
 */
export function getProgressAriaAttributes(
  value: number,
  max: number = 100,
  label?: string
): {
  role: 'progressbar'
  'aria-valuenow': number
  'aria-valuemin': number
  'aria-valuemax': number
  'aria-label'?: string
  'aria-valuetext'?: string
} {
  const percentage = Math.round((value / max) * 100)

  return {
    role: 'progressbar',
    'aria-valuenow': value,
    'aria-valuemin': 0,
    'aria-valuemax': max,
    ...(label && { 'aria-label': label }),
    'aria-valuetext': `${percentage}% complete`,
  }
}

/**
 * Get ARIA attributes for a loading spinner
 */
export function getLoadingAriaAttributes(label: string = 'Loading'): {
  role: 'status'
  'aria-live': 'polite'
  'aria-label': string
} {
  return {
    role: 'status',
    'aria-live': 'polite',
    'aria-label': label,
  }
}

/**
 * Get ARIA attributes for pagination
 */
export function getPaginationAriaAttributes(
  currentPage: number,
  totalPages: number
): {
  nav: {
    role: 'navigation'
    'aria-label': string
  }
  current: {
    'aria-current': 'page'
    'aria-label': string
  }
  page: (page: number) => {
    'aria-label': string
  }
} {
  return {
    nav: {
      role: 'navigation',
      'aria-label': 'Pagination',
    },
    current: {
      'aria-current': 'page',
      'aria-label': `Page ${currentPage} of ${totalPages}`,
    },
    page: (page: number) => ({
      'aria-label': `Go to page ${page}`,
    }),
  }
}

/**
 * Get ARIA attributes for a disclosure/accordion
 */
export function getDisclosureAriaAttributes(
  triggerId: string,
  panelId: string,
  expanded: boolean
): {
  trigger: {
    'aria-expanded': boolean
    'aria-controls': string
    id: string
  }
  panel: {
    role: 'region'
    'aria-labelledby': string
    id: string
  }
} {
  return {
    trigger: {
      'aria-expanded': expanded,
      'aria-controls': panelId,
      id: triggerId,
    },
    panel: {
      role: 'region',
      'aria-labelledby': triggerId,
      id: panelId,
    },
  }
}

/**
 * Get ARIA attributes for a tooltip
 */
export function getTooltipAriaAttributes(tooltipId: string): {
  trigger: {
    'aria-describedby': string
  }
  tooltip: {
    role: 'tooltip'
    id: string
  }
} {
  return {
    trigger: {
      'aria-describedby': tooltipId,
    },
    tooltip: {
      role: 'tooltip',
      id: tooltipId,
    },
  }
}

/**
 * Get ARIA attributes for a table
 */
export function getTableAriaAttributes(
  caption?: string,
  sortColumn?: number,
  sortDirection?: 'ascending' | 'descending'
): {
  table: {
    role?: 'table'
    'aria-label'?: string
  }
  header: {
    scope: 'col'
    'aria-sort'?: 'ascending' | 'descending' | 'none'
  }
  rowHeader: {
    scope: 'row'
  }
} {
  return {
    table: {
      ...(caption && { 'aria-label': caption }),
    },
    header: {
      scope: 'col',
      ...(sortColumn !== undefined && {
        'aria-sort': sortDirection || 'none',
      }),
    },
    rowHeader: {
      scope: 'row',
    },
  }
}

/**
 * Get ARIA attributes for a breadcrumb
 */
export function getBreadcrumbAriaAttributes(): {
  nav: {
    'aria-label': string
  }
  list: {
    role: 'list'
  }
  listItem: {
    role: 'listitem'
  }
  current: {
    'aria-current': 'page'
  }
} {
  return {
    nav: {
      'aria-label': 'Breadcrumb',
    },
    list: {
      role: 'list',
    },
    listItem: {
      role: 'listitem',
    },
    current: {
      'aria-current': 'page',
    },
  }
}

/**
 * Get ARIA attributes for a search landmark
 */
export function getSearchAriaAttributes(label: string = 'Search'): {
  role: 'search'
  'aria-label': string
} {
  return {
    role: 'search',
    'aria-label': label,
  }
}

/**
 * Get ARIA attributes for a landmark
 */
export function getLandmarkAriaAttributes(
  landmark: 'banner' | 'main' | 'navigation' | 'contentinfo' | 'complementary' | 'region',
  label?: string
): {
  role: string
  'aria-label'?: string
} {
  return {
    role: landmark,
    ...(label && { 'aria-label': label }),
  }
}

/**
 * Common ARIA patterns
 */
export const ARIA_PATTERNS = {
  /**
   * Screen reader only text
   */
  srOnly: {
    className: 'sr-only',
    style: {
      position: 'absolute' as const,
      width: '1px',
      height: '1px',
      padding: '0',
      margin: '-1px',
      overflow: 'hidden' as const,
      clip: 'rect(0, 0, 0, 0)',
      whiteSpace: 'nowrap' as const,
      borderWidth: '0',
    },
  },

  /**
   * Focus visible ring (for keyboard navigation)
   */
  focusRing: {
    className: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
  },

  /**
   * Skip link (for keyboard users)
   */
  skipLink: {
    className: 'sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-background focus:text-foreground focus:p-4 focus:rounded-md',
  },
} as const
