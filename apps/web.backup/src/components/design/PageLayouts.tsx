/**
 * B246C-DES-025: Page Layouts Examples
 *
 * Predefined responsive page layout components using grid/flexbox
 * with variable widths and breakpoints, following design tokens.
 */

'use client'

import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * One-column layout - centered content with max-width
 */
export function OneColumnLayout({
  children,
  className,
  maxWidth = 'max-w-4xl',
}: {
  children: React.ReactNode
  className?: string
  maxWidth?: string
}) {
  return (
    <div className={cn('mx-auto w-full px-4 py-8 sm:px-6 lg:px-8', maxWidth, className)}>
      {children}
    </div>
  )
}

/**
 * Two-column layout - main content with sidebar
 */
export function TwoColumnLayout({
  children,
  sidebar,
  sidebarPosition = 'right',
  className,
  sidebarWidth = 'w-full lg:w-80',
  mainWidth = 'flex-1',
}: {
  children: React.ReactNode
  sidebar: React.ReactNode
  sidebarPosition?: 'left' | 'right'
  className?: string
  sidebarWidth?: string
  mainWidth?: string
}) {
  return (
    <div className={cn('container mx-auto px-4 py-8 sm:px-6 lg:px-8', className)}>
      <div
        className={cn(
          'flex flex-col gap-8',
          sidebarPosition === 'right' ? 'lg:flex-row' : 'lg:flex-row-reverse'
        )}
      >
        <main className={cn(mainWidth)}>{children}</main>
        <aside className={cn(sidebarWidth)}>{sidebar}</aside>
      </div>
    </div>
  )
}

/**
 * Sidebar layout - persistent sidebar with main content area
 */
export function SidebarLayout({
  children,
  sidebar,
  sidebarCollapsible = false,
  className,
}: {
  children: React.ReactNode
  sidebar: React.ReactNode
  sidebarCollapsible?: boolean
  className?: string
}) {
  return (
    <div className={cn('flex h-screen', className)}>
      <aside className="hidden w-64 border-r bg-background lg:block">
        {sidebar}
      </aside>
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}

/**
 * Grid layout - responsive grid system
 */
export function GridLayout({
  children,
  columns = { sm: 1, md: 2, lg: 3 },
  gap = 'gap-6',
  className,
}: {
  children: React.ReactNode
  columns?: { sm?: number; md?: number; lg?: number }
  gap?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'grid',
        `grid-cols-${columns.sm || 1}`,
        `md:grid-cols-${columns.md || 2}`,
        `lg:grid-cols-${columns.lg || 3}`,
        gap,
        className
      )}
    >
      {children}
    </div>
  )
}

/**
 * Dashboard layout - header, sidebar, and main content
 */
export function DashboardLayout({
  children,
  header,
  sidebar,
  className,
}: {
  children: React.ReactNode
  header?: React.ReactNode
  sidebar?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex h-screen flex-col', className)}>
      {header && <header className="border-b bg-background">{header}</header>}
      <div className="flex flex-1 overflow-hidden">
        {sidebar && (
          <aside className="hidden w-64 border-r bg-background lg:block">{sidebar}</aside>
        )}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}

/**
 * Example usage components for documentation
 */
export function LayoutExamples() {
  return (
    <div className="space-y-12 p-8">
      <section>
        <h2 className="mb-4 text-2xl font-bold">One Column Layout</h2>
        <OneColumnLayout>
          <Card>
            <CardHeader>
              <CardTitle>Centered Content</CardTitle>
              <CardDescription>
                Single column layout with max-width constraint for optimal readability
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p>This layout is ideal for articles, documentation, and focused content.</p>
            </CardContent>
          </Card>
        </OneColumnLayout>
      </section>

      <section>
        <h2 className="mb-4 text-2xl font-bold">Two Column Layout</h2>
        <TwoColumnLayout
          sidebar={
            <Card>
              <CardHeader>
                <CardTitle>Sidebar</CardTitle>
                <CardDescription>Additional content or navigation</CardDescription>
              </CardHeader>
            </Card>
          }
        >
          <Card>
            <CardHeader>
              <CardTitle>Main Content</CardTitle>
              <CardDescription>Primary content area with sidebar</CardDescription>
            </CardHeader>
            <CardContent>
              <p>This layout provides a main content area with an optional sidebar.</p>
            </CardContent>
          </Card>
        </TwoColumnLayout>
      </section>

      <section>
        <h2 className="mb-4 text-2xl font-bold">Grid Layout</h2>
        <GridLayout columns={{ sm: 1, md: 2, lg: 3 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <CardTitle>Card {i + 1}</CardTitle>
              </CardHeader>
              <CardContent>
                <p>Responsive grid item</p>
              </CardContent>
            </Card>
          ))}
        </GridLayout>
      </section>
    </div>
  )
}

/**
 * Layout breakpoints documentation
 */
export const layoutBreakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
}

/**
 * Layout usage guidelines
 */
export const layoutGuidelines = {
  oneColumn: {
    use: ['Articles', 'Documentation', 'Blog posts', 'Forms', 'Focused content'],
    maxWidths: {
      narrow: 'max-w-2xl',
      default: 'max-w-4xl',
      wide: 'max-w-6xl',
    },
  },
  twoColumn: {
    use: ['Content with navigation', 'Articles with table of contents', 'Forms with help text'],
    sidebarWidths: {
      narrow: 'w-full lg:w-64',
      default: 'w-full lg:w-80',
      wide: 'w-full lg:w-96',
    },
  },
  sidebar: {
    use: ['Dashboards', 'Admin panels', 'Applications with persistent navigation'],
    collapsible: 'Consider making sidebar collapsible on mobile',
  },
  grid: {
    use: ['Card grids', 'Product listings', 'Dashboard widgets', 'Image galleries'],
    columns: {
      sm: '1-2 columns on mobile',
      md: '2-3 columns on tablet',
      lg: '3-4 columns on desktop',
    },
  },
}

