import { CheckCircle, AlertTriangle, XCircle, Clock } from "lucide-react"

export type CredentialStatusType = "valid" | "revoked" | "expired" | "unknown"

export interface CredentialStatusConfig {
  icon: typeof CheckCircle
  color: string
  bgColor: string
  borderColor: string
  badgeVariant: "default" | "destructive" | "secondary" | "outline"
  badgeColor: string
  title: string
  description: string
  ariaLabel: string
}

/**
 * Centralized configuration for credential status display
 * Used across CredentialStatusCard and other credential-related components
 *
 * Each status configuration includes:
 * - Visual indicators (icon, colors)
 * - Badge styling
 * - Accessible labels and descriptions
 * - Support for light/dark themes via semantic tokens
 */
export const CREDENTIAL_STATUS_CONFIGS: Record<
  CredentialStatusType,
  CredentialStatusConfig
> = {
  valid: {
    icon: CheckCircle,
    color: "text-success",
    bgColor: "bg-success/10",
    borderColor: "border-success/20",
    badgeVariant: "default",
    badgeColor: "bg-success/20 text-success-foreground dark:text-success",
    title: "Credential Valid",
    description: "This credential has been successfully verified and is currently active.",
    ariaLabel:
      "Credential status: Valid. This credential has been successfully verified and is currently active.",
  },
  revoked: {
    icon: AlertTriangle,
    color: "text-destructive",
    bgColor: "bg-destructive/10",
    borderColor: "border-destructive/20",
    badgeVariant: "destructive",
    badgeColor: "bg-destructive/20 text-destructive-foreground",
    title: "Credential Revoked",
    description: "This credential has been revoked and is no longer valid.",
    ariaLabel:
      "Credential status: Revoked. This credential has been revoked and is no longer valid.",
  },
  expired: {
    icon: Clock,
    color: "text-warning",
    bgColor: "bg-warning/10",
    borderColor: "border-warning/20",
    badgeVariant: "outline",
    badgeColor: "bg-warning/20 text-warning-foreground dark:text-warning border-warning/30",
    title: "Credential Expired",
    description: "This credential has expired and is no longer valid.",
    ariaLabel:
      "Credential status: Expired. This credential has expired and is no longer valid.",
  },
  unknown: {
    icon: XCircle,
    color: "text-info",
    bgColor: "bg-info/10",
    borderColor: "border-info/20",
    badgeVariant: "secondary",
    badgeColor: "bg-info/20 text-info-foreground dark:text-info",
    title: "Credential Unknown",
    description: "This credential could not be found in our verification system.",
    ariaLabel:
      "Credential status: Unknown. This credential could not be found in our verification system.",
  },
} as const

/**
 * Helper function to get status configuration with fallback
 * @param status - The credential status
 * @returns Status configuration object
 */
export function getCredentialStatusConfig(
  status: string,
): CredentialStatusConfig {
  return (
    CREDENTIAL_STATUS_CONFIGS[status as CredentialStatusType] ??
    CREDENTIAL_STATUS_CONFIGS.unknown
  )
}

/**
 * Helper function to determine if a credential needs attention
 * @param status - The credential status
 * @returns True if status requires user action
 */
export function isCredentialStatusCritical(status: CredentialStatusType): boolean {
  return status === "revoked" || status === "expired"
}

/**
 * Helper function to get status priority for sorting
 * @param status - The credential status
 * @returns Priority number (lower = higher priority)
 */
export function getCredentialStatusPriority(status: CredentialStatusType): number {
  const priorities: Record<CredentialStatusType, number> = {
    revoked: 1,
    expired: 2,
    unknown: 3,
    valid: 4,
  }
  return priorities[status] ?? 5
}
