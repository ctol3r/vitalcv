'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Sparkles, ArrowRight, Info } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface Recommendation {
  id: string
  type: 'module' | 'credential'
  title: string
  description: string
  reason: string
  relevanceScore: number
  metadata?: {
    specialty?: string
    region?: string
    price?: string
    rating?: number
    provider?: string
  }
}

interface RecommendationsWidgetProps {
  query?: string
  className?: string
  maxItems?: number
}

export function RecommendationsWidget({
  query,
  className,
  maxItems = 6,
}: RecommendationsWidgetProps) {
  const router = useRouter()
  const [recommendations, setRecommendations] = React.useState<Recommendation[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [showExplanation, setShowExplanation] = React.useState<Record<string, boolean>>({})

  React.useEffect(() => {
    if (!query) {
      setRecommendations([])
      return
    }

    const fetchRecommendations = async () => {
      setIsLoading(true)
      try {
        const response = await fetch(`/api/search/recommendations?q=${encodeURIComponent(query)}&limit=${maxItems}`)
        if (response.ok) {
          const data = await response.json()
          setRecommendations(data.recommendations || [])
        }
      } catch (error) {
        console.error('Failed to fetch recommendations:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchRecommendations()
  }, [query, maxItems])

  const toggleExplanation = (id: string) => {
    setShowExplanation(prev => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  const getTypeBadgeVariant = (type: string) => {
    return type === 'module' ? 'default' : 'secondary'
  }

  const getTypeLabel = (type: string) => {
    return type === 'module' ? 'Module' : 'Credential'
  }

  const getResultUrl = (recommendation: Recommendation) => {
    if (recommendation.type === 'module') {
      return `/demo/org/marketplace/${recommendation.id}`
    }
    return `/demo/org/credentials/${recommendation.id}`
  }

  if (!query || recommendations.length === 0) {
    return null
  }

  return (
    <Card className={cn('', className)}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <CardTitle>Personalized Recommendations</CardTitle>
        </div>
        <CardDescription>
          Based on your search and profile, we think these might be relevant
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading recommendations...
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {recommendations.map((recommendation) => (
              <div
                key={recommendation.id}
                className="p-4 border rounded-lg hover:shadow-md transition-shadow space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={getTypeBadgeVariant(recommendation.type)}>
                        {getTypeLabel(recommendation.type)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {Math.round(recommendation.relevanceScore * 100)}% match
                      </span>
                    </div>
                    <h3 className="font-semibold text-base mb-1 line-clamp-1">
                      {recommendation.title}
                    </h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {recommendation.description}
                    </p>
                  </div>
                </div>

                {/* Metadata */}
                {recommendation.metadata && (
                  <div className="flex flex-wrap gap-2">
                    {recommendation.metadata.specialty && (
                      <Badge variant="outline" className="text-xs">
                        {recommendation.metadata.specialty}
                      </Badge>
                    )}
                    {recommendation.metadata.region && (
                      <Badge variant="outline" className="text-xs">
                        {recommendation.metadata.region}
                      </Badge>
                    )}
                    {recommendation.metadata.price && (
                      <Badge variant="outline" className="text-xs">
                        {recommendation.metadata.price}
                      </Badge>
                    )}
                    {recommendation.metadata.rating && (
                      <Badge variant="outline" className="text-xs">
                        ⭐ {recommendation.metadata.rating.toFixed(1)}
                      </Badge>
                    )}
                  </div>
                )}

                {/* Why This Recommendation */}
                <div className="space-y-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleExplanation(recommendation.id)}
                    className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Info className="h-3 w-3 mr-1" />
                    Why this recommendation?
                  </Button>
                  {showExplanation[recommendation.id] && (
                    <div className="p-3 bg-muted rounded-md text-sm">
                      <p className="text-muted-foreground">{recommendation.reason}</p>
                    </div>
                  )}
                </div>

                {/* Action */}
                <div className="flex items-center justify-between pt-2 border-t">
                  <Link
                    href={getResultUrl(recommendation)}
                    className="text-sm text-primary hover:underline"
                  >
                    View Details
                  </Link>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => router.push(getResultUrl(recommendation))}
                  >
                    Explore
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

