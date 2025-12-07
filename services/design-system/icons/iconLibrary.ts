/**
 * B246C-DES-024: Icon Library Integration
 *
 * Provides a consistent icon library using Lucide React icons with
 * standardized sizing and color tokens.
 */

import * as LucideIcons from 'lucide-react'
import { type ComponentType, type SVGProps } from 'react'

/**
 * Icon size tokens - matches design system spacing scale
 */
export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'

export const iconSizes: Record<IconSize, string> = {
  xs: '0.75rem', // 12px
  sm: '0.875rem', // 14px
  md: '1rem', // 16px
  lg: '1.25rem', // 20px
  xl: '1.5rem', // 24px
  '2xl': '2rem', // 32px
}

/**
 * Icon color tokens - uses design system color variables
 */
export type IconColor = 'default' | 'primary' | 'secondary' | 'muted' | 'destructive' | 'success' | 'warning'

export const iconColors: Record<IconColor, string> = {
  default: 'currentColor',
  primary: 'hsl(var(--primary))',
  secondary: 'hsl(var(--secondary-foreground))',
  muted: 'hsl(var(--muted-foreground))',
  destructive: 'hsl(var(--destructive))',
  success: 'hsl(var(--success))',
  warning: 'hsl(var(--warning))',
}

/**
 * Icon component props
 */
export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'size'> {
  /**
   * Icon name from Lucide icon library
   */
  name: keyof typeof LucideIcons
  /**
   * Size of the icon
   * @default 'md'
   */
  size?: IconSize | number
  /**
   * Color variant
   * @default 'default'
   */
  color?: IconColor
  /**
   * Additional CSS classes
   */
  className?: string
}

/**
 * Icon component that wraps Lucide icons with consistent sizing and colors
 */
export function Icon({ name, size = 'md', color = 'default', className, ...props }: IconProps) {
  const IconComponent = LucideIcons[name] as ComponentType<SVGProps<SVGSVGElement>>

  if (!IconComponent) {
    console.warn(`Icon "${name}" not found in Lucide icon library`)
    return null
  }

  const sizeValue = typeof size === 'number' ? `${size}px` : iconSizes[size]
  const colorValue = iconColors[color]

  return (
    <IconComponent
      size={sizeValue}
      color={colorValue}
      className={className}
      style={{
        width: sizeValue,
        height: sizeValue,
        color: colorValue,
        ...props.style,
      }}
      {...props}
    />
  )
}

/**
 * Pre-configured icon components for common use cases
 */
export const Icons = {
  /**
   * Navigation icons
   */
  Menu: (props: Omit<IconProps, 'name'>) => <Icon name="Menu" {...props} />,
  X: (props: Omit<IconProps, 'name'>) => <Icon name="X" {...props} />,
  ChevronLeft: (props: Omit<IconProps, 'name'>) => <Icon name="ChevronLeft" {...props} />,
  ChevronRight: (props: Omit<IconProps, 'name'>) => <Icon name="ChevronRight" {...props} />,
  ChevronDown: (props: Omit<IconProps, 'name'>) => <Icon name="ChevronDown" {...props} />,
  ChevronUp: (props: Omit<IconProps, 'name'>) => <Icon name="ChevronUp" {...props} />,

  /**
   * Action icons
   */
  Plus: (props: Omit<IconProps, 'name'>) => <Icon name="Plus" {...props} />,
  Minus: (props: Omit<IconProps, 'name'>) => <Icon name="Minus" {...props} />,
  Edit: (props: Omit<IconProps, 'name'>) => <Icon name="Edit" {...props} />,
  Trash: (props: Omit<IconProps, 'name'>) => <Icon name="Trash" {...props} />,
  Save: (props: Omit<IconProps, 'name'>) => <Icon name="Save" {...props} />,
  Download: (props: Omit<IconProps, 'name'>) => <Icon name="Download" {...props} />,
  Upload: (props: Omit<IconProps, 'name'>) => <Icon name="Upload" {...props} />,

  /**
   * Status icons
   */
  Check: (props: Omit<IconProps, 'name'>) => <Icon name="Check" {...props} />,
  CheckCircle: (props: Omit<IconProps, 'name'>) => <Icon name="CheckCircle" {...props} />,
  XCircle: (props: Omit<IconProps, 'name'>) => <Icon name="XCircle" {...props} />,
  AlertCircle: (props: Omit<IconProps, 'name'>) => <Icon name="AlertCircle" {...props} />,
  Info: (props: Omit<IconProps, 'name'>) => <Icon name="Info" {...props} />,

  /**
   * UI icons
   */
  Search: (props: Omit<IconProps, 'name'>) => <Icon name="Search" {...props} />,
  Filter: (props: Omit<IconProps, 'name'>) => <Icon name="Filter" {...props} />,
  Settings: (props: Omit<IconProps, 'name'>) => <Icon name="Settings" {...props} />,
  Bell: (props: Omit<IconProps, 'name'>) => <Icon name="Bell" {...props} />,
  User: (props: Omit<IconProps, 'name'>) => <Icon name="User" {...props} />,

  /**
   * Theme icons
   */
  Sun: (props: Omit<IconProps, 'name'>) => <Icon name="Sun" {...props} />,
  Moon: (props: Omit<IconProps, 'name'>) => <Icon name="Moon" {...props} />,

  /**
   * Media icons
   */
  Play: (props: Omit<IconProps, 'name'>) => <Icon name="Play" {...props} />,
  Pause: (props: Omit<IconProps, 'name'>) => <Icon name="Pause" {...props} />,
  Image: (props: Omit<IconProps, 'name'>) => <Icon name="Image" {...props} />,
}

/**
 * Get all available icon names
 */
export function getAvailableIcons(): string[] {
  return Object.keys(LucideIcons).filter(
    (key) => typeof LucideIcons[key as keyof typeof LucideIcons] === 'function'
  )
}

/**
 * Icon usage examples and documentation
 */
export const iconUsageExamples = {
  basic: `
import { Icon } from '@/services/design-system/icons/iconLibrary'

<Icon name="User" size="md" />
  `,
  withColor: `
import { Icon } from '@/services/design-system/icons/iconLibrary'

<Icon name="AlertCircle" size="lg" color="destructive" />
  `,
  preconfigured: `
import { Icons } from '@/services/design-system/icons/iconLibrary'

<Icons.CheckCircle size="lg" color="success" />
  `,
  customSize: `
import { Icon } from '@/services/design-system/icons/iconLibrary'

<Icon name="Settings" size={20} />
  `,
}

/**
 * Icon optimization guidelines
 *
 * 1. Use appropriate size for context
 * 2. Maintain consistent sizing within components
 * 3. Use semantic colors (primary, destructive, etc.)
 * 4. Provide accessible labels for icon-only buttons
 * 5. Consider dark mode compatibility
 */
export const iconGuidelines = {
  sizing: {
    xs: 'Use for inline text, badges, and small UI elements',
    sm: 'Use for form inputs and compact spaces',
    md: 'Default size for most UI elements',
    lg: 'Use for buttons and prominent actions',
    xl: 'Use for hero sections and large displays',
    '2xl': 'Use sparingly for special emphasis',
  },
  colors: {
    default: 'Inherits text color - use for most cases',
    primary: 'Use for primary actions and important elements',
    secondary: 'Use for secondary actions',
    muted: 'Use for less important or disabled states',
    destructive: 'Use for errors, warnings, and destructive actions',
    success: 'Use for success states and positive feedback',
    warning: 'Use for warnings and cautionary messages',
  },
  accessibility: {
    iconOnlyButtons: 'Always provide aria-label for icon-only buttons',
    decorative: 'Use aria-hidden="true" for purely decorative icons',
    informative: 'Provide text alternative or aria-label for informative icons',
  },
}

export default Icon

