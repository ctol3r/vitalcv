'use client'

import { useMemo, useState } from 'react'
import {
  BookOpen,
  Search,
  Filter,
  Star,
  DollarSign,
  Building2,
  Users,
  Clock,
  ArrowRight,
  ShoppingCart,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import Link from 'next/link'

type TrainingCourse = {
  id: string
  title: string
  description: string
  specialty: string
  provider: string
  cost: number
  vitaPrice?: number
  rating: number
  reviewCount: number
  duration: string
  format: 'online' | 'in-person' | 'hybrid'
  level: 'beginner' | 'intermediate' | 'advanced'
  tags: string[]
}

type FilterState = {
  specialty: string
  provider: string
  costRange: string
  rating: string
  format: string[]
  level: string[]
}

export default function TrainingCatalogPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState<FilterState>({
    specialty: 'all',
    provider: 'all',
    costRange: 'all',
    rating: 'all',
    format: [],
    level: [],
  })
  const [showFilters, setShowFilters] = useState(false)

  const courses = useMemo(() => buildMockCourses(), [])

  const filteredCourses = useMemo(() => {
    let filtered = courses

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (course) =>
          course.title.toLowerCase().includes(query) ||
          course.description.toLowerCase().includes(query) ||
          course.specialty.toLowerCase().includes(query) ||
          course.provider.toLowerCase().includes(query),
      )
    }

    // Specialty filter
    if (filters.specialty !== 'all') {
      filtered = filtered.filter((course) => course.specialty === filters.specialty)
    }

    // Provider filter
    if (filters.provider !== 'all') {
      filtered = filtered.filter((course) => course.provider === filters.provider)
    }

    // Cost range filter
    if (filters.costRange !== 'all') {
      filtered = filtered.filter((course) => {
        const cost = course.cost
        switch (filters.costRange) {
          case 'free':
            return cost === 0
          case 'low':
            return cost > 0 && cost <= 100
          case 'medium':
            return cost > 100 && cost <= 500
          case 'high':
            return cost > 500
          default:
            return true
        }
      })
    }

    // Rating filter
    if (filters.rating !== 'all') {
      const minRating = parseFloat(filters.rating)
      filtered = filtered.filter((course) => course.rating >= minRating)
    }

    // Format filter
    if (filters.format.length > 0) {
      filtered = filtered.filter((course) => filters.format.includes(course.format))
    }

    // Level filter
    if (filters.level.length > 0) {
      filtered = filtered.filter((course) => filters.level.includes(course.level))
    }

    return filtered
  }, [courses, searchQuery, filters])

  const specialties = useMemo(() => {
    const unique = new Set(courses.map((c) => c.specialty))
    return Array.from(unique).sort()
  }, [courses])

  const providers = useMemo(() => {
    const unique = new Set(courses.map((c) => c.provider))
    return Array.from(unique).sort()
  }, [courses])

  const handleFormatToggle = (format: string) => {
    setFilters((prev) => ({
      ...prev,
      format: prev.format.includes(format)
        ? prev.format.filter((f) => f !== format)
        : [...prev.format, format],
    }))
  }

  const handleLevelToggle = (level: string) => {
    setFilters((prev) => ({
      ...prev,
      level: prev.level.includes(level)
        ? prev.level.filter((l) => l !== level)
        : [...prev.level, level],
    }))
  }

  return (
    <div className="container mx-auto space-y-8 py-8">
      <header className="space-y-4">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Demo • Training • Catalog</p>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <BookOpen className="h-8 w-8 text-primary" aria-hidden="true" />
              Training Catalog
            </h1>
            <p className="text-muted-foreground max-w-2xl">
              Browse and filter training courses by specialty, cost, provider, and ratings. Find the perfect course to advance your career.
            </p>
          </div>
          <Link href="/demo/user/career/dashboard">
            <Button variant="outline">
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </header>

      {/* Search and Filters */}
      <div className="space-y-4">
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search courses by title, specialty, or provider..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            Filters
          </Button>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <Card>
            <CardHeader>
              <CardTitle>Filter Courses</CardTitle>
              <CardDescription>Refine your search by multiple criteria</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Specialty</label>
                  <Select value={filters.specialty} onValueChange={(value) => setFilters((prev) => ({ ...prev, specialty: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Specialties</SelectItem>
                      {specialties.map((spec) => (
                        <SelectItem key={spec} value={spec}>
                          {spec}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Provider</label>
                  <Select value={filters.provider} onValueChange={(value) => setFilters((prev) => ({ ...prev, provider: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Providers</SelectItem>
                      {providers.map((prov) => (
                        <SelectItem key={prov} value={prov}>
                          {prov}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Cost Range</label>
                  <Select value={filters.costRange} onValueChange={(value) => setFilters((prev) => ({ ...prev, costRange: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Prices</SelectItem>
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="low">$1 - $100</SelectItem>
                      <SelectItem value="medium">$101 - $500</SelectItem>
                      <SelectItem value="high">$500+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Minimum Rating</label>
                  <Select value={filters.rating} onValueChange={(value) => setFilters((prev) => ({ ...prev, rating: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Ratings</SelectItem>
                      <SelectItem value="4.5">4.5+ Stars</SelectItem>
                      <SelectItem value="4.0">4.0+ Stars</SelectItem>
                      <SelectItem value="3.5">3.5+ Stars</SelectItem>
                      <SelectItem value="3.0">3.0+ Stars</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-medium">Format</label>
                  <div className="space-y-2">
                    {(['online', 'in-person', 'hybrid'] as const).map((format) => (
                      <div key={format} className="flex items-center space-x-2">
                        <Checkbox
                          id={`format-${format}`}
                          checked={filters.format.includes(format)}
                          onCheckedChange={() => handleFormatToggle(format)}
                        />
                        <label
                          htmlFor={`format-${format}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 capitalize cursor-pointer"
                        >
                          {format}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-medium">Level</label>
                  <div className="space-y-2">
                    {(['beginner', 'intermediate', 'advanced'] as const).map((level) => (
                      <div key={level} className="flex items-center space-x-2">
                        <Checkbox
                          id={`level-${level}`}
                          checked={filters.level.includes(level)}
                          onCheckedChange={() => handleLevelToggle(level)}
                        />
                        <label
                          htmlFor={`level-${level}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 capitalize cursor-pointer"
                        >
                          {level}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {filteredCourses.length} {filteredCourses.length === 1 ? 'course' : 'courses'}
        </p>
        <Link href="/demo/org/marketplace">
          <Button variant="outline" size="sm">
            Browse Modules Marketplace
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </div>

      {/* Course Grid */}
      {filteredCourses.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No courses found matching your criteria.</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => {
                setSearchQuery('')
                setFilters({
                  specialty: 'all',
                  provider: 'all',
                  costRange: 'all',
                  rating: 'all',
                  format: [],
                  level: [],
                })
              }}
            >
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredCourses.map((course) => (
            <Card key={course.id} className="flex flex-col hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <Badge variant="outline" className="capitalize">
                    {course.specialty}
                  </Badge>
                  <Badge variant="secondary" className="capitalize">
                    {course.level}
                  </Badge>
                </div>
                <CardTitle className="mt-2">{course.title}</CardTitle>
                <CardDescription className="line-clamp-2">{course.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <div className="space-y-3 flex-1">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Building2 className="h-4 w-4" />
                      {course.provider}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {course.duration}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span className="font-medium">{course.rating.toFixed(1)}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">({course.reviewCount} reviews)</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold">
                        {course.cost === 0 ? (
                          'Free'
                        ) : (
                          <>
                            ${course.cost}
                            {course.vitaPrice && (
                              <span className="text-sm text-muted-foreground ml-1">
                                or {course.vitaPrice} VITA
                              </span>
                            )}
                          </>
                        )}
                      </span>
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {course.format}
                    </Badge>
                  </div>

                  {course.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {course.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-4 flex gap-2">
                  <Link href={`/demo/training/course/${course.id}`} className="flex-1">
                    <Button className="w-full">View Details</Button>
                  </Link>
                  <Button variant="outline" size="icon">
                    <ShoppingCart className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function buildMockCourses(): TrainingCourse[] {
  return [
    {
      id: 'course1',
      title: 'Advanced Cardiac Life Support (ACLS)',
      description: 'Comprehensive ACLS certification course covering advanced life support techniques and protocols.',
      specialty: 'Cardiology',
      provider: 'American Heart Association',
      cost: 250,
      vitaPrice: 200,
      rating: 4.8,
      reviewCount: 342,
      duration: '2 days',
      format: 'hybrid',
      level: 'intermediate',
      tags: ['ACLS', 'Emergency', 'Certification'],
    },
    {
      id: 'course2',
      title: 'Telemedicine Best Practices',
      description: 'Learn the fundamentals of providing quality healthcare through telemedicine platforms.',
      specialty: 'General Practice',
      provider: 'Healthcare Training Institute',
      cost: 150,
      rating: 4.5,
      reviewCount: 189,
      duration: '8 hours',
      format: 'online',
      level: 'beginner',
      tags: ['Telemedicine', 'Technology', 'Patient Care'],
    },
    {
      id: 'course3',
      title: 'Cardiac Catheterization Techniques',
      description: 'Advanced course on cardiac catheterization procedures and interventional cardiology.',
      specialty: 'Cardiology',
      provider: 'Cardiology Education Center',
      cost: 1200,
      vitaPrice: 1000,
      rating: 4.9,
      reviewCount: 87,
      duration: '5 days',
      format: 'in-person',
      level: 'advanced',
      tags: ['Cardiology', 'Procedures', 'Advanced'],
    },
    {
      id: 'course4',
      title: 'Medical Ethics and Professionalism',
      description: 'Explore ethical dilemmas in modern healthcare and develop professional decision-making skills.',
      specialty: 'General Practice',
      provider: 'Medical Ethics Institute',
      cost: 0,
      rating: 4.3,
      reviewCount: 256,
      duration: '4 hours',
      format: 'online',
      level: 'beginner',
      tags: ['Ethics', 'Professionalism', 'CME'],
    },
    {
      id: 'course5',
      title: 'Pediatric Advanced Life Support (PALS)',
      description: 'Specialized training for healthcare providers caring for critically ill or injured infants and children.',
      specialty: 'Pediatrics',
      provider: 'American Heart Association',
      cost: 280,
      vitaPrice: 220,
      rating: 4.7,
      reviewCount: 198,
      duration: '2 days',
      format: 'hybrid',
      level: 'intermediate',
      tags: ['PALS', 'Pediatrics', 'Emergency'],
    },
    {
      id: 'course6',
      title: 'Electronic Health Records Management',
      description: 'Master EHR systems and optimize your workflow for better patient care and documentation.',
      specialty: 'General Practice',
      provider: 'Healthcare Technology Academy',
      cost: 95,
      rating: 4.2,
      reviewCount: 421,
      duration: '6 hours',
      format: 'online',
      level: 'beginner',
      tags: ['EHR', 'Technology', 'Workflow'],
    },
  ]
}

