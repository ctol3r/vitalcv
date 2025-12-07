'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Filter, FileText, Grid, List, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AccessibleDataTable, TableColumn } from '@/components/accessibility/AccessibleDataTable'

// Types
interface Document {
  id: string
  title: string
  category: string
  tags: string[]
  status: 'draft' | 'published' | 'archived'
  author: string
  updatedAt: string
  version: number
}

// Mock data - replace with API call
const mockDocuments: Document[] = [
  {
    id: '1',
    title: 'Clinical Guidelines 2024',
    category: 'Clinical',
    tags: ['guidelines', 'clinical', '2024'],
    status: 'published',
    author: 'Dr. Jane Smith',
    updatedAt: '2024-01-15',
    version: 3,
  },
  {
    id: '2',
    title: 'Compliance Policy Update',
    category: 'Compliance',
    tags: ['policy', 'compliance'],
    status: 'published',
    author: 'John Doe',
    updatedAt: '2024-01-10',
    version: 2,
  },
  {
    id: '3',
    title: 'Training Manual Draft',
    category: 'Training',
    tags: ['training', 'manual'],
    status: 'draft',
    author: 'Sarah Johnson',
    updatedAt: '2024-01-20',
    version: 1,
  },
]

const statusColors = {
  draft: 'secondary',
  published: 'default',
  archived: 'outline',
} as const

export default function DocumentLibraryPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  // Extract unique categories and tags
  const categories = useMemo(() => {
    const cats = new Set(mockDocuments.map((doc) => doc.category))
    return Array.from(cats)
  }, [])

  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    mockDocuments.forEach((doc) => {
      doc.tags.forEach((tag) => tagSet.add(tag))
    })
    return Array.from(tagSet)
  }, [])

  // Filter documents
  const filteredDocuments = useMemo(() => {
    return mockDocuments.filter((doc) => {
      const matchesSearch =
        searchQuery === '' ||
        doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.author.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesCategory = selectedCategory === 'all' || doc.category === selectedCategory

      const matchesTags =
        selectedTags.length === 0 || selectedTags.some((tag) => doc.tags.includes(tag))

      const matchesStatus = selectedStatus === 'all' || doc.status === selectedStatus

      return matchesSearch && matchesCategory && matchesTags && matchesStatus
    })
  }, [searchQuery, selectedCategory, selectedTags, selectedStatus])

  // Pagination
  const totalPages = Math.ceil(filteredDocuments.length / pageSize)
  const paginatedDocuments = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredDocuments.slice(start, start + pageSize)
  }, [filteredDocuments, currentPage])

  // Table columns
  const columns: TableColumn<Document>[] = [
    {
      id: 'title',
      header: 'Title',
      accessor: (doc) => (
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <button
            onClick={() => router.push(`/docs/${doc.id}`)}
            className="text-left font-medium hover:underline focus:outline-none focus:ring-2 focus:ring-ring rounded"
          >
            {doc.title}
          </button>
        </div>
      ),
      sortable: true,
    },
    {
      id: 'category',
      header: 'Category',
      accessor: (doc) => <Badge variant="outline">{doc.category}</Badge>,
      sortable: true,
    },
    {
      id: 'tags',
      header: 'Tags',
      accessor: (doc) => (
        <div className="flex flex-wrap gap-1">
          {doc.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
          {doc.tags.length > 3 && (
            <Badge variant="secondary" className="text-xs">
              +{doc.tags.length - 3}
            </Badge>
          )}
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      accessor: (doc) => (
        <Badge variant={statusColors[doc.status]}>{doc.status}</Badge>
      ),
      sortable: true,
    },
    {
      id: 'author',
      header: 'Author',
      accessor: (doc) => doc.author,
      sortable: true,
    },
    {
      id: 'updatedAt',
      header: 'Updated',
      accessor: (doc) => new Date(doc.updatedAt).toLocaleDateString(),
      sortable: true,
    },
    {
      id: 'version',
      header: 'Version',
      accessor: (doc) => `v${doc.version}`,
      sortable: true,
    },
  ]

  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Document Library</h1>
          <p className="text-muted-foreground mt-1">
            Search and filter documents by category, tags, and status
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setViewMode(viewMode === 'table' ? 'grid' : 'table')}
            aria-label={`Switch to ${viewMode === 'table' ? 'grid' : 'table'} view`}
          >
            {viewMode === 'table' ? <Grid className="h-4 w-4" /> : <List className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Search & Filter</CardTitle>
          <CardDescription>Find documents using search and filters</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search documents by title or author..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              aria-label="Search documents"
            />
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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

            <div>
              <label htmlFor="status-filter" className="sr-only">
                Filter by status
              </label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger id="status-filter" aria-label="Filter by status">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery('')
                  setSelectedCategory('all')
                  setSelectedTags([])
                  setSelectedStatus('all')
                }}
                className="w-full"
              >
                <Filter className="mr-2 h-4 w-4" />
                Clear Filters
              </Button>
            </div>
          </div>

          {/* Tags Filter */}
          {allTags.length > 0 && (
            <div>
              <label className="text-sm font-medium mb-2 block">Filter by Tags</label>
              <div className="flex flex-wrap gap-2">
                {allTags.map((tag) => (
                  <Button
                    key={tag}
                    variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleTagToggle(tag)}
                    aria-pressed={selectedTags.includes(tag)}
                  >
                    {tag}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {paginatedDocuments.length} of {filteredDocuments.length} documents
          </p>
        </div>

        {viewMode === 'table' ? (
          <AccessibleDataTable
            data={paginatedDocuments}
            columns={columns}
            caption="Document library with searchable and filterable results"
            onRowSelect={(doc) => router.push(`/docs/${doc.id}`)}
            getRowId={(doc) => doc.id}
            filterable={false}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {paginatedDocuments.map((doc) => (
              <Card
                key={doc.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => router.push(`/docs/${doc.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    router.push(`/docs/${doc.id}`)
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`View document ${doc.title}`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <Badge variant={statusColors[doc.status]}>{doc.status}</Badge>
                  </div>
                  <CardTitle className="line-clamp-2">{doc.title}</CardTitle>
                  <CardDescription>{doc.category}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1">
                      {doc.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <p>By {doc.author}</p>
                      <p>Updated {new Date(doc.updatedAt).toLocaleDateString()}</p>
                      <p>Version {doc.version}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                aria-label="Next page"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

