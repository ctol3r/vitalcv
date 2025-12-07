/**
 * Marketplace Home UI
 *
 * Displays featured and recommended modules; filters by category, capability, price; supports search
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';

interface MarketplaceModule {
  id: string;
  name: string;
  description?: string;
  version: string;
  author: string;
  category?: string;
  capabilities?: string[];
  fiatPrice?: number;
  vitaPrice?: number;
  featured?: boolean;
  recommended?: boolean;
  rating?: number;
  downloadCount?: number;
  metadata?: {
    tags?: string[];
    icon?: string;
    screenshots?: string[];
  };
}

export default function MarketplaceHomePage() {
  const [modules, setModules] = useState<MarketplaceModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedCapability, setSelectedCapability] = useState<string>('all');
  const [priceFilter, setPriceFilter] = useState<'all' | 'free' | 'paid'>('all');

  useEffect(() => {
    fetchModules();
  }, []);

  async function fetchModules() {
    try {
      const res = await fetch('/api/marketplace/list');
      if (!res.ok) throw new Error('Failed to fetch marketplace modules');
      const data = await res.json();
      setModules(data.listings || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  // Extract unique categories and capabilities
  const categories = useMemo(() => {
    const cats = new Set<string>();
    modules.forEach(m => {
      if (m.category) cats.add(m.category);
      if (m.metadata?.productType) cats.add(m.metadata.productType);
    });
    return Array.from(cats).sort();
  }, [modules]);

  const capabilities = useMemo(() => {
    const caps = new Set<string>();
    modules.forEach(m => {
      m.capabilities?.forEach(c => caps.add(c));
    });
    return Array.from(caps).sort();
  }, [modules]);

  // Filter modules
  const filteredModules = useMemo(() => {
    return modules.filter(module => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          module.name.toLowerCase().includes(query) ||
          module.description?.toLowerCase().includes(query) ||
          module.author.toLowerCase().includes(query) ||
          module.metadata?.tags?.some(tag => tag.toLowerCase().includes(query));
        if (!matchesSearch) return false;
      }

      // Category filter
      if (selectedCategory !== 'all') {
        if (module.category !== selectedCategory && module.metadata?.productType !== selectedCategory) {
          return false;
        }
      }

      // Capability filter
      if (selectedCapability !== 'all') {
        if (!module.capabilities?.includes(selectedCapability)) {
          return false;
        }
      }

      // Price filter
      if (priceFilter === 'free') {
        if ((module.fiatPrice && module.fiatPrice > 0) || (module.vitaPrice && module.vitaPrice > 0)) {
          return false;
        }
      } else if (priceFilter === 'paid') {
        if ((!module.fiatPrice || module.fiatPrice === 0) && (!module.vitaPrice || module.vitaPrice === 0)) {
          return false;
        }
      }

      return true;
    });
  }, [modules, searchQuery, selectedCategory, selectedCapability, priceFilter]);

  const featuredModules = filteredModules.filter(m => m.featured);
  const recommendedModules = filteredModules.filter(m => m.recommended && !m.featured);
  const otherModules = filteredModules.filter(m => !m.featured && !m.recommended);

  function formatPrice(fiatPrice?: number, vitaPrice?: number): string {
    if (fiatPrice && fiatPrice > 0) {
      return `$${(fiatPrice / 100).toFixed(2)}`;
    }
    if (vitaPrice && vitaPrice > 0) {
      return `${vitaPrice} VITA`;
    }
    return 'Free';
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <h1 className="text-2xl font-bold mb-6">Marketplace</h1>
        <div className="text-sm text-muted-foreground">Loading modules...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <h1 className="text-2xl font-bold mb-6">Marketplace</h1>
        <div className="text-sm text-destructive">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Marketplace</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Discover and install modules to extend your platform capabilities
          </p>
        </div>
        <Link href="/demo/vendor/dashboard">
          <Button variant="outline">Vendor Console</Button>
        </Link>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Search & Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div>
            <Input
              placeholder="Search modules..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>

          {/* Filter Row */}
          <div className="grid gap-4 md:grid-cols-3">
            {/* Category Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">Category</label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="all">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Capability Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">Capability</label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={selectedCapability}
                onChange={(e) => setSelectedCapability(e.target.value)}
              >
                <option value="all">All Capabilities</option>
                {capabilities.map(cap => (
                  <option key={cap} value={cap}>{cap}</option>
                ))}
              </select>
            </div>

            {/* Price Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">Price</label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={priceFilter}
                onChange={(e) => setPriceFilter(e.target.value as 'all' | 'free' | 'paid')}
              >
                <option value="all">All Prices</option>
                <option value="free">Free</option>
                <option value="paid">Paid</option>
              </select>
            </div>
          </div>

          {/* Results Count */}
          <div className="text-sm text-muted-foreground">
            Showing {filteredModules.length} of {modules.length} modules
          </div>
        </CardContent>
      </Card>

      {/* Featured Modules */}
      {featuredModules.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Featured Modules</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {featuredModules.map((module) => (
              <ModuleCard key={module.id} module={module} />
            ))}
          </div>
        </div>
      )}

      {/* Recommended Modules */}
      {recommendedModules.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Recommended for You</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {recommendedModules.map((module) => (
              <ModuleCard key={module.id} module={module} />
            ))}
          </div>
        </div>
      )}

      {/* All Modules */}
      {otherModules.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">All Modules</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {otherModules.map((module) => (
              <ModuleCard key={module.id} module={module} />
            ))}
          </div>
        </div>
      )}

      {filteredModules.length === 0 && (
        <div className="text-center text-sm text-muted-foreground py-8">
          No modules found matching your filters
        </div>
      )}
    </div>
  );
}

function ModuleCard({ module }: { module: MarketplaceModule }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{module.name}</CardTitle>
            <div className="text-xs text-muted-foreground mt-1">
              by {module.author} • v{module.version}
            </div>
          </div>
          {module.featured && (
            <Badge className="bg-yellow-100 text-yellow-800">Featured</Badge>
          )}
          {module.recommended && !module.featured && (
            <Badge variant="secondary">Recommended</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {module.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {module.description}
          </p>
        )}

        {/* Tags */}
        {module.metadata?.tags && module.metadata.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {module.metadata.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Capabilities */}
        {module.capabilities && module.capabilities.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {module.capabilities.slice(0, 2).map((cap) => (
              <Badge key={cap} variant="secondary" className="text-xs">
                {cap}
              </Badge>
            ))}
            {module.capabilities.length > 2 && (
              <Badge variant="secondary" className="text-xs">
                +{module.capabilities.length - 2} more
              </Badge>
            )}
          </div>
        )}

        {/* Price and Stats */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="text-lg font-semibold">
            {formatPrice(module.fiatPrice, module.vitaPrice)}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {module.rating && (
              <span>⭐ {module.rating.toFixed(1)}</span>
            )}
            {module.downloadCount !== undefined && (
              <span>📥 {module.downloadCount.toLocaleString()}</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Link href={`/demo/org/marketplace/${module.id}`} className="flex-1">
            <Button className="w-full" size="sm">
              View Details
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

