# Search Components

This directory contains all search-related components for the Chai VC Platform.

## Components

### GlobalSearchBar
A global search bar component with auto-complete suggestions and result previews.

**Features:**
- Auto-complete suggestions as you type
- Keyboard navigation (arrow keys, enter, escape)
- Result previews with type badges
- Debounced API calls for performance
- Accessible and responsive

**Usage:**
```tsx
import { GlobalSearchBar } from '@/components/search/GlobalSearchBar'

<GlobalSearchBar
  placeholder="Search providers, credentials..."
  onSearch={(query) => console.log('Searched:', query)}
/>
```

### FacetFilters
Filter component for search results with support for multiple filter types.

**Features:**
- Multi-select checkboxes
- Single-select dropdowns
- Real-time filter updates
- Active filter badges
- Clear all filters option
- Responsive design

**Usage:**
```tsx
import { FacetFilters } from '@/components/search/FacetFilters'

<FacetFilters
  facets={customFacets}
  onFiltersChange={(filters) => console.log('Filters:', filters)}
/>
```

### SavedSearches
Component for managing saved searches and alerts.

**Features:**
- Save current search queries
- Enable/disable email alerts
- Configure alert frequency (real-time, daily, weekly)
- Multiple notification channels (email, in-app)
- Delete saved searches
- Run saved searches

**Usage:**
```tsx
import { SavedSearches } from '@/components/search/SavedSearches'

<SavedSearches query={currentQuery} />
```

### RecommendationsWidget
Personalized recommendations widget based on search queries.

**Features:**
- ML-powered recommendations
- Relevance scores
- "Why this recommendation?" explanations
- Module and credential recommendations
- Responsive grid layout

**Usage:**
```tsx
import { RecommendationsWidget } from '@/components/search/RecommendationsWidget'

<RecommendationsWidget
  query={searchQuery}
  maxItems={6}
/>
```

## API Routes

All search API routes are located in `/app/api/search/`:

- `/api/search` - Main search endpoint
- `/api/search/suggestions` - Auto-complete suggestions
- `/api/search/saved` - Saved searches CRUD
- `/api/search/recommendations` - Recommendations endpoint

## Integration Example

To add the GlobalSearchBar to your header:

```tsx
import { GlobalSearchBar } from '@/components/search/GlobalSearchBar'

export function Header() {
  return (
    <header className="border-b">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Logo />
          <GlobalSearchBar className="max-w-2xl" />
          <UserMenu />
        </div>
      </div>
    </header>
  )
}
```

## Search Results Page

The search results page is located at `/app/search/page.tsx` and includes:
- Search bar in header
- Facet filters sidebar
- Results list with pagination
- Sort options
- Recommendations widget
- Saved searches widget

## Notes

- All components are client-side rendered (`'use client'`)
- API routes use mock data for demo purposes
- In production, replace with database queries using Prisma
- Saved searches API uses in-memory storage (replace with database)
- Recommendations API uses mock ML logic (replace with actual ML service)

