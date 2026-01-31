import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export type CRSGrade = 'GREEN' | 'YELLOW' | 'RED'
export type CRSReadiness = 'READY' | 'NOT_READY'

type CRSCardProps = {
  score: number
  grade: CRSGrade
  readiness: CRSReadiness
  updatedAt: string
  summary: string
  reasons: string[]
}

const GRADE_TONES: Record<CRSGrade, string> = {
  GREEN: 'border-emerald-200/70 bg-emerald-500/10 text-emerald-700',
  YELLOW: 'border-amber-200/70 bg-amber-500/10 text-amber-700',
  RED: 'border-red-200/70 bg-red-500/10 text-red-700',
}

const READINESS_TONES: Record<CRSReadiness, string> = {
  READY: 'text-emerald-600',
  NOT_READY: 'text-amber-600',
}

const formatDate = (value: string) => {
  return new Date(value).toLocaleString()
}

export function CRSCard({ score, grade, readiness, updatedAt, summary, reasons }: CRSCardProps) {
  const visibleReasons = reasons.slice(0, 3)

  return (
    <Card className="border-border/70 bg-card/80 shadow-sm">
      <CardHeader className="flex flex-col gap-4 border-b border-border/60 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <CardTitle className="text-xl">Credential Readiness Score</CardTitle>
          <CardDescription>{summary}</CardDescription>
        </div>
        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className={cn(
              'rounded-full border px-3 py-1 text-xs uppercase tracking-[0.3em]',
              GRADE_TONES[grade],
            )}
          >
            {grade}
          </Badge>
          <Badge variant="outline" className="rounded-full border-border/70 px-3 py-1 text-xs">
            Read-only
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-6 pt-6 lg:grid-cols-[220px_1fr]">
        <div className="space-y-3">
          <div className="text-5xl font-semibold text-foreground">{score}</div>
          <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">CRS</div>
          <div className={cn('text-sm font-medium', READINESS_TONES[readiness])}>
            {readiness.replace('_', ' ')}
          </div>
          <div className="text-xs text-muted-foreground">Updated {formatDate(updatedAt)}</div>
        </div>
        <div className="space-y-3">
          <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Readiness Drivers
          </div>
          <ul className="space-y-2 text-sm text-foreground">
            {visibleReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            CRS is computed from verified PSV evidence only.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
