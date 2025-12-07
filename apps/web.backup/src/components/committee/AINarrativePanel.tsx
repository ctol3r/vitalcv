'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, MessageSquare, RefreshCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type NarrativeSentiment = 'positive' | 'neutral' | 'warning' | 'critical'

export type NarrativeSection = {
  id: string
  title: string
  summary: string
  insights: string[]
  sentiment?: NarrativeSentiment
  recommendation?: string
}

export type AINarrativePanelProps = {
  sections: NarrativeSection[]
  updatedAt: string
  headline?: string
  onRefresh?: () => Promise<NarrativeSection[]> | NarrativeSection[]
}

export function AINarrativePanel({ sections, updatedAt, headline = 'AI Narrative', onRefresh }: AINarrativePanelProps) {
  const [localSections, setLocalSections] = useState(sections)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set(sections.slice(0, 1).map((section) => section.id)))
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [srMessage, setSrMessage] = useState('')

  useEffect(() => {
    setLocalSections(sections)
  }, [sections])

  const toggleSection = useCallback((sectionId: string) => {
    setExpandedIds((previous) => {
      const next = new Set(previous)
      if (next.has(sectionId)) {
        next.delete(sectionId)
      } else {
        next.add(sectionId)
      }
      return next
    })
  }, [])

  const formattedTime = useMemo(() => {
    const timestamp = new Date(updatedAt)
    return timestamp.toLocaleString(undefined, {
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
    })
  }, [updatedAt])

  const handleRefresh = useCallback(async () => {
    if (!onRefresh) {
      return
    }

    setIsRefreshing(true)
    setSrMessage('Refreshing narrative, please wait')

    try {
      const nextSections = await onRefresh()
      if (Array.isArray(nextSections) && nextSections.length > 0) {
        setLocalSections(nextSections)
        setExpandedIds(new Set(nextSections.slice(0, 1).map((section) => section.id)))
        setSrMessage('Narrative refreshed')
      }
    } catch (error) {
      console.error('[AINarrativePanel] Failed to refresh narrative', error)
      setSrMessage('Unable to refresh narrative. Please try again.')
    } finally {
      setIsRefreshing(false)
      setTimeout(() => setSrMessage(''), 2500)
    }
  }, [onRefresh])

  return (
    <div className="rounded-xl border bg-card shadow-sm focus-within:ring-1 focus-within:ring-ring" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <MessageSquare className="h-4 w-4 text-primary" aria-hidden="true" />
            {headline}
          </div>
          <p className="text-xs text-muted-foreground">
            Updated {formattedTime}
            <span className="sr-only">Narrative generated at {new Date(updatedAt).toLocaleString()}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing || !onRefresh} aria-live="assertive">
            <RefreshCcw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} aria-hidden="true" />
            Refresh narrative
          </Button>
        </div>
      </div>

      <div className="divide-y" role="region" aria-label="AI generated narrative sections">
        {localSections.map((section) => {
          const isExpanded = expandedIds.has(section.id)
          return (
            <div key={section.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                aria-expanded={isExpanded}
                aria-controls={`${section.id}-content`}
                onClick={() => toggleSection(section.id)}
              >
                <div>
                  <p className="text-sm font-semibold">{section.title}</p>
                  <p className="text-sm text-muted-foreground">{section.summary}</p>
                </div>
                <div className="flex items-center gap-3">
                  {section.sentiment && <SentimentBadge sentiment={section.sentiment} />}
                  <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', isExpanded && 'rotate-180')} aria-hidden="true" />
                </div>
              </button>
              <div id={`${section.id}-content`} hidden={!isExpanded} className="space-y-3 px-4 pb-4 text-sm text-muted-foreground">
                <ul className="list-inside list-disc space-y-1">
                  {section.insights.map((insight, index) => (
                    <li key={`${section.id}-insight-${index}`} className="text-muted-foreground">
                      {insight}
                    </li>
                  ))}
                </ul>
                {section.recommendation && (
                  <div className="rounded-md bg-muted/50 px-3 py-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recommendation</p>
                    <p>{section.recommendation}</p>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <span className="sr-only" aria-live="assertive">
        {srMessage}
      </span>
    </div>
  )
}

function SentimentBadge({ sentiment }: { sentiment: NarrativeSentiment }) {
  switch (sentiment) {
    case 'positive':
      return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Positive</Badge>
    case 'warning':
      return <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">Watch</Badge>
    case 'critical':
      return <Badge className="bg-rose-100 text-rose-900 hover:bg-rose-100">Escalate</Badge>
    default:
      return <Badge variant="secondary">Neutral</Badge>
  }
}


