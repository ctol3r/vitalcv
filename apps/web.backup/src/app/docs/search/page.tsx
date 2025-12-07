'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, FileText, Tag, Folder, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

// Types
interface SearchResult {
  id: string
  title: string
  content: string
  category: string
  tags: string[]
  author: string
  updatedAt: string
  highlights: string[]
  score: number
}

// Mock search results - replace with API call
const mockSearchResults: SearchResult[] = [
  {
    id: '1',
    title: 'Clinical Guidelines 2024',
    content:
      'This document outlines the clinical guidelines for the year 2024. These guidelines are based on the latest research and best practices in the field.',
    category: 'Clinical',
    tags: ['guidelines', 'clinical', '2024'],
    author: 'Dr. Jane Smith',
    updatedAt: '2024-01-15',
    highlights: ['clinical guidelines', 'year 2024', 'best practices'],
    score: 0.95,
  },
  {
    id: '2',
    title: 'Compliance Policy Update',
    content:
      'Updated compliance policies for Q1 2024. All staff must review and acknowledge these policies.',
    category: 'Compliance',
    tags: ['policy', 'compliance'],
    author: 'John Doe',
    updatedAt: '2024-01-10',
    highlights: ['compliance policies', 'Q1 2024'],
    score: 0.87,
  },
]

export default function DocumentSearchPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)

  const categories = ['Clinical', 'Compliance', 'Training', 'Policy']
  const allTags = ['guidelines', 'clinical', '2024', 'policy', 'compliance', 'training']

  useEffect(() => {
    if (query) {
      handleSearch()
    }
  }, [])

  const handleSearch = async () => {
    if (!query.trim()) {
      setResults([])
      return
    }

    setIsSearching(true)

    try {
      // In a real app, call search API
      // const response = await fetch(
      //   `/api/docs/search?q=${encodeURIComponent(query)}&category=${selectedCategory}&tags=${selectedTags.join(',')}`
      // )
      // const data = await response.json()
      // setResults(data.results)

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Filter mock results
      const filtered = mockSearchResults.filter((result) => {
        const matchesCategory = selectedCategory === 'all' || result.category === selectedCategory
        const matchesTags =
          selectedTags.length === 0 || selectedTags.some((tag) => result.tags.includes(tag))
        const matchesQuery =
          result.title.toLowerCase().includes(query.toLowerCase()) ||
          result.content.toLowerCase().includes(query.toLowerCase())

        return matchesCategory && matchesTags && matchesQuery
      })

      setResults(filtered)
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setIsSearching(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const highlightText = (text: string, query: string): React.ReactNode => {
    if (!query.trim()) return text

    const parts = text.split(new RegExp(`(${query})`, 'gi'))
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="bg-yellow-200 dark:bg-yellow-900">
          {part}
        </mark>
      ) : (
        part
      )
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Document Search</h1>
        <p className="text-muted-foreground mt-1">
          Full-text search across all documents with highlighted results
        </p>
      </div>

      {/* Search Bar */}
      <Card>
        <CardHeader>
          <CardTitle>Search Documents</CardTitle>
          <CardDescription>Enter keywords to search document titles and content</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search documents..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-10"
              aria-label="Search documents"
            />
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="category-filter" className="sr-only">
                Filter by category
              </label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger id="category-filter" aria-label="Filter by category">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleSearch} disabled={isSearching} className="w-full sm:w-auto">
              {isSearching ? 'Searching...' : 'Search'}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>

          {/* Tags Filter */}
          <div>
            <label className="text-sm font-medium mb-2 block">Filter by Tags</label>
            <div className="flex flex-wrap gap-2">
              {allTags.map((tag) => (
                <Button
                  key={tag}
                  variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() =>
                    setSelectedTags((prev) =>
                      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
                    )
                  }
                  aria-pressed={selectedTags.includes(tag)}
                >
                  <Tag className="mr-1 h-3 w-3" />
                  {tag}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <div className="space-y-4">
        {isSearching ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">Searching...</p>
            </CardContent>
          </Card>
        ) : results.length === 0 && query ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">No results found for "{query}"</p>
            </CardContent>
          </Card>
        ) : results.length > 0 ? (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Found {results.length} result{results.length !== 1 ? 's' : ''}
              </p>
            </div>

            <div className="space-y-4">
              {results.map((result) => (
                <Card
                  key={result.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => router.push(`/docs/${result.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      router.push(`/docs/${result.id}`)
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`View document ${result.title}`}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="flex items-center gap-2 mb-2">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          {highlightText(result.title, query)}
                        </CardTitle>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">
                            <Folder className="mr-1 h-3 w-3" />
                            {result.category}
                          </Badge>
                          {result.tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              <Tag className="mr-1 h-3 w-3" />
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {(result.score * 100).toFixed(0)}% match
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-3">
                      {highlightText(result.content, query)}
                    </p>
                    {result.highlights.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Highlights:</p>
                        <div className="flex flex-wrap gap-1">
                          {result.highlights.map((highlight, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {highlight}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="mt-3 text-xs text-muted-foreground">
                      <p>By {result.author}</p>
                      <p>Updated {new Date(result.updatedAt).toLocaleDateString()}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        ) : (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">
                Enter a search query to find documents
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

