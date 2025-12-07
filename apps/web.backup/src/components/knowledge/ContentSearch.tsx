'use client';

/**
 * B243C-KMS-028: ContentSearch UI
 * Search bar with auto-suggest, filters by category and tags; displays results with highlighting
 * of matched terms; supports keyboard navigation and infinite scrolling
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, X, Filter, ArrowDown, ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface SearchResult {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  tags: string[];
  matchedTerms: string[];
}

interface ContentSearchProps {
  onSearch?: (query: string) => void;
  onFilterChange?: (category: string | null, tags: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function ContentSearch({
  onSearch,
  onFilterChange,
  placeholder = 'Search articles, guides, and documentation...',
  className,
}: ContentSearchProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Mock categories and tags - replace with API call
  const categories = ['Getting Started', 'API Reference', 'Troubleshooting', 'Best Practices', 'FAQs'];
  const popularTags = ['authentication', 'credentials', 'verification', 'api', 'setup', 'security'];

  // Mock search function - replace with actual API call
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setSuggestions([]);
      setResults([]);
      return;
    }

    setIsLoading(true);
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Mock results - replace with actual API call
    const mockResults: SearchResult[] = [
      {
        id: '1',
        title: 'Getting Started with Credentials',
        slug: 'getting-started-credentials',
        excerpt: 'Learn how to set up and manage credentials in the platform...',
        category: 'Getting Started',
        tags: ['credentials', 'setup'],
        matchedTerms: ['credentials', 'getting'],
      },
      {
        id: '2',
        title: 'API Authentication Guide',
        slug: 'api-authentication',
        excerpt: 'Complete guide to authenticating API requests...',
        category: 'API Reference',
        tags: ['api', 'authentication'],
        matchedTerms: ['api', 'authentication'],
      },
    ].filter((result) =>
      result.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      result.excerpt.toLowerCase().includes(searchQuery.toLowerCase())
    );

    setSuggestions(mockResults);
    setResults(mockResults);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (query) {
        performSearch(query);
        setShowResults(true);
      } else {
        setSuggestions([]);
        setResults([]);
        setShowResults(false);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [query, performSearch]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showResults || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          handleResultClick(suggestions[selectedIndex]);
        } else if (suggestions.length > 0) {
          handleResultClick(suggestions[0]);
        } else {
          onSearch?.(query);
        }
        break;
      case 'Escape':
        setShowResults(false);
        inputRef.current?.blur();
        break;
    }
  };

  const handleResultClick = (result: SearchResult) => {
    setQuery(result.title);
    setShowResults(false);
    onSearch?.(result.title);
    // Navigate to result - handled by Link component
  };

  const highlightText = (text: string, terms: string[]) => {
    if (!terms.length) return text;
    const regex = new RegExp(`(${terms.join('|')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      terms.some((term) => part.toLowerCase() === term.toLowerCase()) ? (
        <mark key={i} className="bg-yellow-200 dark:bg-yellow-900/50 px-1 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const handleCategoryChange = (category: string) => {
    const newCategory = category === 'all' ? null : category;
    setSelectedCategory(newCategory);
    onFilterChange?.(newCategory, selectedTags);
  };

  const handleTagToggle = (tag: string) => {
    const newTags = selectedTags.includes(tag)
      ? selectedTags.filter((t) => t !== tag)
      : [...selectedTags, tag];
    setSelectedTags(newTags);
    onFilterChange?.(selectedCategory, newTags);
  };

  return (
    <div className={cn('relative w-full', className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => query && setShowResults(true)}
          placeholder={placeholder}
          className="pl-10 pr-10 h-12 text-base"
        />
        {query && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
            onClick={() => {
              setQuery('');
              setShowResults(false);
              inputRef.current?.focus();
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Filters */}
      {(selectedCategory || selectedTags.length > 0) && (
        <div className="flex flex-wrap gap-2 mt-3">
          {selectedCategory && (
            <Badge variant="secondary" className="gap-1">
              {selectedCategory}
              <button
                onClick={() => handleCategoryChange('all')}
                className="ml-1 hover:bg-secondary/80 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {selectedTags.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1">
              {tag}
              <button
                onClick={() => handleTagToggle(tag)}
                className="ml-1 hover:bg-secondary/80 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Search Results Dropdown */}
      {showResults && (suggestions.length > 0 || isLoading) && (
        <Card
          ref={resultsRef}
          className="absolute z-50 w-full mt-2 max-h-[500px] overflow-y-auto shadow-lg"
        >
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 text-center text-muted-foreground">Searching...</div>
            ) : (
              <>
                {suggestions.length > 0 && (
                  <div className="p-2 border-b">
                    <div className="text-xs font-semibold text-muted-foreground mb-2 px-2">
                      Quick Results
                    </div>
                    {suggestions.map((result, index) => (
                      <Link
                        key={result.id}
                        href={`/knowledge/${result.slug}`}
                        onClick={() => handleResultClick(result)}
                      >
                        <div
                          className={cn(
                            'p-3 rounded-md cursor-pointer transition-colors',
                            'hover:bg-accent',
                            selectedIndex === index && 'bg-accent'
                          )}
                        >
                          <div className="font-medium mb-1">
                            {highlightText(result.title, result.matchedTerms)}
                          </div>
                          <div className="text-sm text-muted-foreground line-clamp-2">
                            {highlightText(result.excerpt, result.matchedTerms)}
                          </div>
                          <div className="flex gap-2 mt-2">
                            <Badge variant="outline" className="text-xs">
                              {result.category}
                            </Badge>
                            {result.tags.slice(0, 2).map((tag) => (
                              <Badge key={tag} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}

                {/* Filter Section */}
                <div className="p-4 border-t bg-muted/30">
                  <div className="flex items-center gap-2 mb-3">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">Filters</span>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium mb-1 block">Category</label>
                      <Select value={selectedCategory || 'all'} onValueChange={handleCategoryChange}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
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
                      <label className="text-xs font-medium mb-1 block">Tags</label>
                      <div className="flex flex-wrap gap-2">
                        {popularTags.map((tag) => (
                          <Badge
                            key={tag}
                            variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                            className="cursor-pointer"
                            onClick={() => handleTagToggle(tag)}
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Keyboard Navigation Hint */}
                {suggestions.length > 0 && (
                  <div className="p-2 border-t text-xs text-muted-foreground flex items-center justify-between">
                    <span>Use arrow keys to navigate</span>
                    <div className="flex gap-1">
                      <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">
                        <ArrowUp className="h-3 w-3 inline" />
                      </kbd>
                      <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">
                        <ArrowDown className="h-3 w-3 inline" />
                      </kbd>
                      <span className="px-1.5">to select</span>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

