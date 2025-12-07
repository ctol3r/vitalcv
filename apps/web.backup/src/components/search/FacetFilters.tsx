'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface FacetFilter {
  id: string
  label: string
  type: 'checkbox' | 'select' | 'multiselect'
  options: Array<{ value: string; label: string; count?: number }>
}

interface FacetFiltersProps {
  facets?: FacetFilter[]
  className?: string
  onFiltersChange?: (filters: Record<string, string[]>) => void
}

export function FacetFilters({ facets = [], className, onFiltersChange }: FacetFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Default facets if none provided
  const defaultFacets: FacetFilter[] = [
    {
      id: 'specialty',
      label: 'Specialty',
      type: 'multiselect',
      options: [
        { value: 'cardiology', label: 'Cardiology', count: 45 },
        { value: 'orthopedics', label: 'Orthopedics', count: 32 },
        { value: 'pediatrics', label: 'Pediatrics', count: 28 },
        { value: 'surgery', label: 'Surgery', count: 67 },
        { value: 'internal-medicine', label: 'Internal Medicine', count: 89 },
      ],
    },
    {
      id: 'region',
      label: 'Region',
      type: 'multiselect',
      options: [
        { value: 'northeast', label: 'Northeast', count: 120 },
        { value: 'southeast', label: 'Southeast', count: 95 },
        { value: 'midwest', label: 'Midwest', count: 78 },
        { value: 'west', label: 'West', count: 112 },
      ],
    },
    {
      id: 'credentialType',
      label: 'Credential Type',
      type: 'multiselect',
      options: [
        { value: 'license', label: 'License', count: 234 },
        { value: 'certification', label: 'Certification', count: 156 },
        { value: 'board-certification', label: 'Board Certification', count: 89 },
        { value: 'privilege', label: 'Privilege', count: 67 },
      ],
    },
    {
      id: 'language',
      label: 'Language',
      type: 'multiselect',
      options: [
        { value: 'en', label: 'English', count: 400 },
        { value: 'es', label: 'Spanish', count: 45 },
        { value: 'fr', label: 'French', count: 12 },
        { value: 'zh', label: 'Chinese', count: 8 },
      ],
    },
    {
      id: 'priceRange',
      label: 'Price Range',
      type: 'select',
      options: [
        { value: 'free', label: 'Free' },
        { value: '0-50', label: '$0 - $50' },
        { value: '50-100', label: '$50 - $100' },
        { value: '100-500', label: '$100 - $500' },
        { value: '500+', label: '$500+' },
      ],
    },
  ]

  const activeFacets = facets.length > 0 ? facets : defaultFacets

  const getActiveFilters = (facetId: string): string[] => {
    const value = searchParams.get(facetId)
    return value ? value.split(',') : []
  }

  const updateFilters = (facetId: string, values: string[]) => {
    const params = new URLSearchParams(searchParams.toString())

    if (values.length === 0) {
      params.delete(facetId)
    } else {
      params.set(facetId, values.join(','))
    }

    // Reset to first page when filters change
    params.delete('page')

    router.push(`/search?${params.toString()}`)
    onFiltersChange?.(Object.fromEntries(
      activeFacets.map(f => [f.id, getActiveFilters(f.id)])
    ))
  }

  const toggleFilter = (facetId: string, value: string) => {
    const current = getActiveFilters(facetId)
    const updated = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value]
    updateFilters(facetId, updated)
  }

  const clearFilter = (facetId: string) => {
    updateFilters(facetId, [])
  }

  const clearAllFilters = () => {
    const params = new URLSearchParams(searchParams.toString())
    activeFacets.forEach(facet => {
      params.delete(facet.id)
    })
    params.delete('page')
    router.push(`/search?${params.toString()}`)
    onFiltersChange?.({})
  }

  const hasActiveFilters = activeFacets.some(facet => getActiveFilters(facet.id).length > 0)

  return (
    <div className={cn('space-y-6', className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Filters</h3>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="text-xs h-7"
          >
            Clear all
          </Button>
        )}
      </div>

      {activeFacets.map((facet) => {
        const activeValues = getActiveFilters(facet.id)
        const hasActive = activeValues.length > 0

        if (facet.type === 'select') {
          return (
            <div key={facet.id} className="space-y-2">
              <Label className="text-sm font-medium">{facet.label}</Label>
              <Select
                value={activeValues[0] || ''}
                onValueChange={(value) => updateFilters(facet.id, value ? [value] : [])}
              >
                <SelectTrigger>
                  <SelectValue placeholder={`All ${facet.label.toLowerCase()}`} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All {facet.label.toLowerCase()}</SelectItem>
                  {facet.options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                      {option.count !== undefined && (
                        <span className="ml-2 text-muted-foreground">({option.count})</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )
        }

        return (
          <div key={facet.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">{facet.label}</Label>
              {hasActive && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => clearFilter(facet.id)}
                  className="h-6 px-2 text-xs"
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              )}
            </div>
            <div className="space-y-2">
              {facet.options.map((option) => {
                const isChecked = activeValues.includes(option.value)
                return (
                  <div key={option.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`${facet.id}-${option.value}`}
                      checked={isChecked}
                      onCheckedChange={() => toggleFilter(facet.id, option.value)}
                    />
                    <Label
                      htmlFor={`${facet.id}-${option.value}`}
                      className="text-sm font-normal cursor-pointer flex-1 flex items-center justify-between"
                    >
                      <span>{option.label}</span>
                      {option.count !== undefined && (
                        <span className="text-xs text-muted-foreground ml-2">
                          {option.count}
                        </span>
                      )}
                    </Label>
                  </div>
                )
              })}
            </div>
            {hasActive && (
              <div className="flex flex-wrap gap-2 pt-2">
                {activeValues.map((value) => {
                  const option = facet.options.find(o => o.value === value)
                  return (
                    <Badge
                      key={value}
                      variant="secondary"
                      className="text-xs cursor-pointer"
                      onClick={() => toggleFilter(facet.id, value)}
                    >
                      {option?.label || value}
                      <X className="h-3 w-3 ml-1" />
                    </Badge>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

