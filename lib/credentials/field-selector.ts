/**
 * Field Selector Utilities for Selective Disclosure UI
 *
 * Helper functions for building UI components that allow users
 * to select which credential fields to reveal.
 */

import { CredentialClaim } from './selective-disclosure'

/**
 * Field category for UI grouping
 */
export type FieldCategory = 'identity' | 'contact' | 'demographic' | 'credential' | 'other'

/**
 * Field with UI metadata
 */
export interface SelectableField {
  name: string
  value?: unknown
  label: string
  category: FieldCategory
  required: boolean
  sensitive: boolean
  description?: string
  icon?: string
  selected: boolean
}

/**
 * Categorize a field based on its name
 */
export function categorizeField(fieldName: string): FieldCategory {
  const lower = fieldName.toLowerCase()

  // Identity fields
  if (
    ['id', 'did', 'givenname', 'familyname', 'name', 'firstname', 'lastname'].some((term) =>
      lower.includes(term)
    )
  ) {
    return 'identity'
  }

  // Contact fields
  if (
    ['email', 'phone', 'address', 'street', 'city', 'zip', 'postal'].some((term) =>
      lower.includes(term)
    )
  ) {
    return 'contact'
  }

  // Demographic fields
  if (
    ['birthdate', 'age', 'gender', 'nationality', 'citizenship'].some((term) =>
      lower.includes(term)
    )
  ) {
    return 'demographic'
  }

  // Credential-specific fields
  if (
    [
      'license',
      'degree',
      'certification',
      'expiry',
      'issue',
      'authority',
      'number',
      'class',
    ].some((term) => lower.includes(term))
  ) {
    return 'credential'
  }

  return 'other'
}

/**
 * Get icon name for a field category
 */
export function getIconForCategory(category: FieldCategory): string {
  const icons: Record<FieldCategory, string> = {
    identity: 'user',
    contact: 'mail',
    demographic: 'users',
    credential: 'award',
    other: 'file-text',
  }
  return icons[category]
}

/**
 * Get display label for a field name
 */
export function getFieldLabel(fieldName: string): string {
  // Convert camelCase to Title Case
  const withSpaces = fieldName.replace(/([A-Z])/g, ' $1')
  const titleCase = withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1)
  return titleCase.trim()
}

/**
 * Convert credential claims to selectable fields
 */
export function claimsToSelectableFields(
  claims: CredentialClaim[],
  requiredFields: string[],
  preselected?: string[]
): SelectableField[] {
  return claims.map((claim) => ({
    name: claim.name,
    value: claim.value,
    label: getFieldLabel(claim.name),
    category: categorizeField(claim.name),
    required: claim.required || requiredFields.includes(claim.name),
    sensitive: claim.sensitive,
    description: claim.description,
    icon: getIconForCategory(categorizeField(claim.name)),
    selected:
      claim.required ||
      requiredFields.includes(claim.name) ||
      (preselected && preselected.includes(claim.name)) ||
      false,
  }))
}

/**
 * Group fields by category
 */
export function groupFieldsByCategory(
  fields: SelectableField[]
): Record<FieldCategory, SelectableField[]> {
  const grouped: Record<FieldCategory, SelectableField[]> = {
    identity: [],
    contact: [],
    demographic: [],
    credential: [],
    other: [],
  }

  for (const field of fields) {
    grouped[field.category].push(field)
  }

  return grouped
}

/**
 * Get field selection recommendations
 */
export function getSelectionRecommendations(fields: SelectableField[]): {
  minimum: string[]
  recommended: string[]
  full: string[]
} {
  const minimum = fields.filter((f) => f.required).map((f) => f.name)

  const recommended = fields
    .filter((f) => f.required || (!f.sensitive && f.category === 'identity'))
    .map((f) => f.name)

  const full = fields.map((f) => f.name)

  return { minimum, recommended, full }
}

/**
 * Validate field selection
 */
export function validateFieldSelection(
  selectedFields: string[],
  fields: SelectableField[]
): {
  valid: boolean
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[]  = []

  // Check required fields
  const requiredFields = fields.filter((f) => f.required)
  const missingRequired = requiredFields.filter((f) => !selectedFields.includes(f.name))

  if (missingRequired.length > 0) {
    errors.push(
      `Missing required fields: ${missingRequired.map((f) => f.label).join(', ')}`
    )
  }

  // Check for invalid field names
  const validFieldNames = fields.map((f) => f.name)
  const invalidFields = selectedFields.filter((f) => !validFieldNames.includes(f))

  if (invalidFields.length > 0) {
    errors.push(`Invalid fields: ${invalidFields.join(', ')}`)
  }

  // Warn if revealing too many fields
  const selectedCount = selectedFields.length
  const totalCount = fields.length
  const percentageRevealed = (selectedCount / totalCount) * 100

  if (percentageRevealed > 70) {
    warnings.push(
      `Revealing ${selectedCount}/${totalCount} fields (${percentageRevealed.toFixed(0)}%). Consider revealing fewer fields for better privacy.`
    )
  }

  // Warn if revealing sensitive fields
  const sensitiveFields = fields.filter((f) => f.sensitive && selectedFields.includes(f.name))
  if (sensitiveFields.length > 0) {
    warnings.push(
      `Revealing sensitive fields: ${sensitiveFields.map((f) => f.label).join(', ')}`
    )
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Format field value for display
 */
export function formatFieldValue(value: unknown, fieldName: string): string {
  if (value === null || value === undefined) {
    return 'Not specified'
  }

  // Date fields
  if (fieldName.toLowerCase().includes('date') && typeof value === 'string') {
    try {
      const date = new Date(value)
      return date.toLocaleDateString()
    } catch {
      return String(value)
    }
  }

  // Array fields
  if (Array.isArray(value)) {
    return value.join(', ')
  }

  // Object fields
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2)
  }

  // Boolean fields
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No'
  }

  return String(value)
}

/**
 * Get privacy impact message
 */
export function getPrivacyImpactMessage(
  selectedCount: number,
  totalCount: number
): {
  message: string
  color: 'green' | 'yellow' | 'red'
  level: 'high' | 'medium' | 'low'
} {
  const percentageRevealed = (selectedCount / totalCount) * 100
  const privacyPreserved = 100 - percentageRevealed

  if (privacyPreserved >= 70) {
    return {
      message: `High privacy: Only ${selectedCount}/${totalCount} fields revealed (${privacyPreserved.toFixed(0)}% remain private)`,
      color: 'green',
      level: 'high',
    }
  } else if (privacyPreserved >= 40) {
    return {
      message: `Medium privacy: ${selectedCount}/${totalCount} fields revealed (${privacyPreserved.toFixed(0)}% remain private)`,
      color: 'yellow',
      level: 'medium',
    }
  } else {
    return {
      message: `Low privacy: ${selectedCount}/${totalCount} fields revealed (only ${privacyPreserved.toFixed(0)}% remain private)`,
      color: 'red',
      level: 'low',
    }
  }
}
