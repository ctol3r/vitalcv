'use client'

import * as React from 'react'
import { Search, X, Loader2 } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface SearchSuggestion {
  id: string
  type: 'provider' | 'credential' | 'module' | 'contract'
  title: string
  subtitle?: string
  metadata?: Record<string, any>
}

interface GlobalSearchBarProps {
  className?: string
  placeholder?: string
  onSearch?: (query: string) => void
}

export function GlobalSearchBar({
  className,
  placeholder = 'Search providers, credentials, modules, contracts...',
  onSearch,
}: GlobalSearchBarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [query, setQuery] = React.useState(searchParams.get('q') || '')
  const [suggestions, setSuggestions] = React.useState<SearchSuggestion[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [showSuggestions, setShowSuggestions] = React.useState(false)
  const [selectedIndex, setSelectedIndex] = React.useState(-1)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const suggestionsRef = React.useRef<HTMLDivElement>(null)

  // Debounced search for suggestions
  React.useEffect(() => {
    if (!query.trim()) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    const timeoutId = setTimeout(async () => {
      setIsLoading(true)
      try {
        const response = await fetch(`/api/search/suggestions?q=${encodeURIComponent(query)}`)
        if (response.ok) {
          const data = await response.json()
          setSuggestions(data.suggestions || [])
          setShowSuggestions(true)
        }
      } catch (error) {
        console.error('Failed to fetch suggestions:', error)
      } finally {
        setIsLoading(false)
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [query])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    const searchUrl = `/search?q=${encodeURIComponent(query)}`
    router.push(searchUrl)
    setShowSuggestions(false)
    onSearch?.(query)
  }

  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    const searchUrl = `/search?q=${encodeURIComponent(query)}&type=${suggestion.type}&id=${suggestion.id}`
    router.push(searchUrl)
    setShowSuggestions(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1))
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault()
      handleSuggestionClick(suggestions[selectedIndex])
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
      setSelectedIndex(-1)
    }
  }

  const getTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'provider':
        return 'default'
      case 'credential':
        return 'secondary'
      case 'module':
        return 'outline'
      case 'contract':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'provider':
        return 'Provider'
      case 'credential':
        return 'Credential'
      case 'module':
        return 'Module'
      case 'contract':
        return 'Contract'
      default:
        return type
    }
  }

  return (
    <div className={cn('relative w-full max-w-2xl', className)}>
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(-1)
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (suggestions.length > 0) {
                setShowSuggestions(true)
              }
            }}
            onBlur={(e) => {
              // Delay to allow click events on suggestions
              setTimeout(() => {
                if (!suggestionsRef.current?.contains(document.activeElement)) {
                  setShowSuggestions(false)
                }
              }, 200)
            }}
            placeholder={placeholder}
            className="pl-10 pr-20 h-11"
          />
          {query && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => {
                setQuery('')
                setSuggestions([])
                setShowSuggestions(false)
                inputRef.current?.focus()
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Suggestions Dropdown */}
        {showSuggestions && (suggestions.length > 0 || isLoading) && (
          <div
            ref={suggestionsRef}
            className="absolute z-50 w-full mt-2 bg-popover border rounded-md shadow-lg max-h-96 overflow-auto"
            onMouseDown={(e) => e.preventDefault()} // Prevent input blur
          >
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="p-2">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={suggestion.id}
                    type="button"
                    onClick={() => handleSuggestionClick(suggestion)}
                    className={cn(
                      'w-full text-left px-3 py-2 rounded-md transition-colors',
                      'hover:bg-accent hover:text-accent-foreground',
                      selectedIndex === index && 'bg-accent text-accent-foreground',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={getTypeBadgeVariant(suggestion.type)} className="text-xs">
                            {getTypeLabel(suggestion.type)}
                          </Badge>
                          <span className="font-medium truncate">{suggestion.title}</span>
                        </div>
                        {suggestion.subtitle && (
                          <p className="text-sm text-muted-foreground truncate">{suggestion.subtitle}</p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </form>
    </div>
  )
}

