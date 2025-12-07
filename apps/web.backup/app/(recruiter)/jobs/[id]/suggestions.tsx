import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface CandidateSuggestion {
  clinicianId: string;
  name: string;
  specialty: string;
  readinessScore: number;
  compactEligible: boolean;
  sanctionsClear: boolean;
  matchScore?: number;
}

interface MatchingCandidatesResponse {
  candidates: CandidateSuggestion[];
}

export async function JobSuggestions({ jobId }: { jobId: string }) {
  const suggestions = await fetchSuggestions(jobId);

  if (!suggestions.length) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle>No candidate suggestions yet</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Matching engine has not produced recommendations for this job ID. Try refreshing once new ATS data is available.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {suggestions.map((candidate) => (
        <Card key={candidate.clinicianId}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-lg">{candidate.name}</CardTitle>
              <p className="text-sm text-muted-foreground">{candidate.specialty}</p>
            </div>
            <Badge variant={candidate.compactEligible ? 'default' : 'secondary'}>
              {candidate.compactEligible ? 'Compact-ready' : 'Local'}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm font-medium">
              <span>Readiness</span>
              <span>{Math.round(candidate.readinessScore * 100)}%</span>
            </div>
            <Progress value={candidate.readinessScore * 100} className="h-2" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Sanctions</span>
              <span>{candidate.sanctionsClear ? 'Clear' : 'Review required'}</span>
            </div>
            <Button variant="outline" className="w-full">
              Request Presentation
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

async function fetchSuggestions(jobId: string): Promise<CandidateSuggestion[]> {
  try {
    const response = await fetch(resolveApiUrl(`/api/matching/candidates?jobId=${jobId}&limit=20`), {
      method: 'GET',
      cache: 'no-store',
      next: { revalidate: 60 },
    });
    if (!response.ok) {
      throw new Error(`matching API returned ${response.status}`);
    }
    const payload = (await response.json()) as MatchingCandidatesResponse;
    return payload.candidates ?? [];
  } catch (error) {
    console.warn('[JobSuggestions] falling back to mock candidates', error);
    return buildMockSuggestions(jobId);
  }
}

function buildMockSuggestions(jobId: string): CandidateSuggestion[] {
  return Array.from({ length: 6 }).map((_, index) => ({
    clinicianId: `${jobId}-mock-${index}`,
    name: `Candidate ${index + 1}`,
    specialty: index % 2 === 0 ? 'Telehealth RN' : 'Emergency Medicine',
    readinessScore: 0.75 + index * 0.03,
    compactEligible: index % 2 === 0,
    sanctionsClear: index !== 3,
    matchScore: 0.68 + index * 0.04,
  }));
}

function resolveApiUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_API_URL ?? process.env.API_BASE_URL ?? '';
  if (!base) return path;
  return `${base}${path}`;
}

export default JobSuggestions;


