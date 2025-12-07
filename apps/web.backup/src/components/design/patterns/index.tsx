/**
 * B246C-DES-026: UX Patterns Library
 *
 * Collection of reusable UX patterns: multi-step forms, wizard navigation,
 * pagination, search bars, and more.
 */

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Multi-step form pattern
 */
export interface Step {
  id: string
  title: string
  description?: string
  component: React.ReactNode
}

export function MultiStepForm({
  steps,
  onComplete,
  className,
}: {
  steps: Step[]
  onComplete?: (data: Record<string, unknown>) => void
  className?: string
}) {
  const [currentStep, setCurrentStep] = useState(0)
  const [formData, setFormData] = useState<Record<string, unknown>>({})

  const isFirstStep = currentStep === 0
  const isLastStep = currentStep === steps.length - 1

  const handleNext = () => {
    if (isLastStep) {
      onComplete?.(formData)
    } else {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevious = () => {
    if (!isFirstStep) {
      setCurrentStep(currentStep - 1)
    }
  }

  return (
    <div className={cn('w-full', className)}>
      {/* Progress indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full border-2',
                    index <= currentStep
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-muted bg-background text-muted-foreground'
                  )}
                >
                  {index < currentStep ? (
                    <span className="text-sm font-semibold">✓</span>
                  ) : (
                    <span className="text-sm font-semibold">{index + 1}</span>
                  )}
                </div>
                <span className="mt-2 text-xs font-medium">{step.title}</span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    'mx-2 h-0.5 flex-1',
                    index < currentStep ? 'bg-primary' : 'bg-muted'
                  )}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Current step content */}
      <Card>
        <CardHeader>
          <CardTitle>{steps[currentStep].title}</CardTitle>
          {steps[currentStep].description && (
            <CardDescription>{steps[currentStep].description}</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {steps[currentStep].component}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="mt-6 flex justify-between">
        <Button variant="outline" onClick={handlePrevious} disabled={isFirstStep}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Previous
        </Button>
        <Button onClick={handleNext}>
          {isLastStep ? 'Complete' : 'Next'}
          {!isLastStep && <ChevronRight className="ml-2 h-4 w-4" />}
        </Button>
      </div>
    </div>
  )
}

/**
 * Wizard navigation pattern
 */
export function WizardNavigation({
  steps,
  currentStep,
  onStepClick,
  className,
}: {
  steps: Array<{ id: string; label: string; completed?: boolean }>
  currentStep: number
  onStepClick?: (stepIndex: number) => void
  className?: string
}) {
  return (
    <nav className={cn('flex items-center gap-2', className)}>
      {steps.map((step, index) => (
        <div key={step.id} className="flex items-center">
          <button
            onClick={() => onStepClick?.(index)}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors',
              index === currentStep
                ? 'border-primary bg-primary text-primary-foreground'
                : step.completed
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-muted bg-background text-muted-foreground hover:border-primary/50'
            )}
            aria-current={index === currentStep ? 'step' : undefined}
          >
            {step.completed ? '✓' : index + 1}
          </button>
          {index < steps.length - 1 && (
            <div
              className={cn(
                'mx-2 h-0.5 w-8',
                step.completed ? 'bg-primary' : 'bg-muted'
              )}
            />
          )}
        </div>
      ))}
    </nav>
  )
}

/**
 * Pagination pattern
 */
export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  className,
}: {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  className?: string
}) {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
  const visiblePages = getVisiblePages(currentPage, totalPages)

  return (
    <nav className={cn('flex items-center justify-center gap-2', className)} aria-label="Pagination">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        aria-label="Previous page"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {visiblePages.map((page, index) => {
        if (page === 'ellipsis') {
          return (
            <span key={`ellipsis-${index}`} className="px-2 text-muted-foreground">
              ...
            </span>
          )
        }

        return (
          <Button
            key={page}
            variant={currentPage === page ? 'default' : 'outline'}
            size="sm"
            onClick={() => onPageChange(page)}
            aria-label={`Page ${page}`}
            aria-current={currentPage === page ? 'page' : undefined}
          >
            {page}
          </Button>
        )
      })}

      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        aria-label="Next page"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </nav>
  )
}

function getVisiblePages(currentPage: number, totalPages: number): (number | 'ellipsis')[] {
  const delta = 2
  const range: (number | 'ellipsis')[] = []
  const rangeWithDots: (number | 'ellipsis')[] = []

  for (let i = 1; i <= totalPages; i++) {
    if (
      i === 1 ||
      i === totalPages ||
      (i >= currentPage - delta && i <= currentPage + delta)
    ) {
      range.push(i)
    }
  }

  let l: number | undefined
  for (const i of range) {
    if (typeof i === 'number') {
      if (l && i - l === 2) {
        rangeWithDots.push(l + 1)
      } else if (l && i - l !== 1) {
        rangeWithDots.push('ellipsis')
      }
      rangeWithDots.push(i)
      l = i
    }
  }

  return rangeWithDots
}

/**
 * Search bar pattern
 */
export function SearchBar({
  placeholder = 'Search...',
  onSearch,
  className,
  debounceMs = 300,
}: {
  placeholder?: string
  onSearch?: (query: string) => void
  className?: string
  debounceMs?: number
}) {
  const [query, setQuery] = useState('')

  // Debounce search
  const handleChange = (value: string) => {
    setQuery(value)
    if (onSearch) {
      const timeoutId = setTimeout(() => {
        onSearch(value)
      }, debounceMs)
      return () => clearTimeout(timeoutId)
    }
  }

  return (
    <div className={cn('relative', className)}>
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        placeholder={placeholder}
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        className="pl-10"
        aria-label="Search"
      />
    </div>
  )
}

/**
 * Breadcrumb navigation pattern
 */
export interface BreadcrumbItem {
  label: string
  href?: string
}

export function Breadcrumbs({
  items,
  className,
}: {
  items: BreadcrumbItem[]
  className?: string
}) {
  return (
    <nav className={cn('flex items-center space-x-2 text-sm', className)} aria-label="Breadcrumb">
      {items.map((item, index) => {
        const isLast = index === items.length - 1

        return (
          <div key={index} className="flex items-center">
            {item.href && !isLast ? (
              <a
                href={item.href}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {item.label}
              </a>
            ) : (
              <span className={isLast ? 'text-foreground font-medium' : 'text-muted-foreground'}>
                {item.label}
              </span>
            )}
            {!isLast && (
              <ChevronRight className="mx-2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            )}
          </div>
        )
      })}
    </nav>
  )
}

/**
 * Tab navigation pattern
 */
export function TabNavigation({
  tabs,
  activeTab,
  onTabChange,
  className,
}: {
  tabs: Array<{ id: string; label: string; count?: number }>
  activeTab: string
  onTabChange: (tabId: string) => void
  className?: string
}) {
  return (
    <div className={cn('border-b', className)}>
      <nav className="flex space-x-8" aria-label="Tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:border-muted-foreground hover:text-foreground'
            )}
            aria-current={activeTab === tab.id ? 'page' : undefined}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </nav>
    </div>
  )
}

/**
 * Usage guidelines for UX patterns
 */
export const patternGuidelines = {
  multiStepForm: {
    use: ['Complex forms', 'Onboarding flows', 'Wizard-style processes'],
    bestPractices: [
      'Show progress indicator',
      'Allow navigation between steps',
      'Validate each step before proceeding',
      'Save progress automatically',
      'Provide clear next/previous actions',
    ],
  },
  pagination: {
    use: ['Data tables', 'Search results', 'Content lists'],
    bestPractices: [
      'Show current page clearly',
      'Provide first/last page navigation for long lists',
      'Display total pages or items',
      'Use ellipsis for large page counts',
      'Support keyboard navigation',
    ],
  },
  searchBar: {
    use: ['Search interfaces', 'Filtering', 'Quick lookup'],
    bestPractices: [
      'Debounce search input',
      'Provide clear visual feedback',
      'Show search suggestions',
      'Support keyboard shortcuts (Ctrl/Cmd+K)',
      'Display recent searches',
    ],
  },
  breadcrumbs: {
    use: ['Deep navigation', 'Hierarchical content', 'Multi-level structures'],
    bestPractices: [
      'Show full path',
      'Make all items clickable except current',
      'Use consistent separator',
      'Keep labels concise',
      'Provide aria-label',
    ],
  },
}

