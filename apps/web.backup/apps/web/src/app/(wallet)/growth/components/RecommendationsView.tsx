/**
 * Phase 3: Personalized Recommendations (8 tasks)
 * Task 17: Create RecommendationsView
 */

'use client';

import {
  BookOpen,
  Award,
  Briefcase,
  GraduationCap,
  MapPin,
  TrendingUp,
  Target,
  Clock,
  DollarSign,
  ExternalLink,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useGrowthEngine } from '@/lib/growth/view-model';
import type { Recommendation } from '@/lib/growth/models';

interface RecommendationsViewProps {
  clinicianId: string | null;
}

export function RecommendationsView({ clinicianId }: RecommendationsViewProps) {
  const { recommendations, loading } = useGrowthEngine(clinicianId);

  if (loading) {
    return <div>Loading recommendations...</div>;
  }

  const byType = {
    cme: recommendations.filter((r) => r.type === 'cme'),
    credential: recommendations.filter((r) => r.type === 'credential'),
    skill: recommendations.filter((r) => r.type === 'skill'),
    license: recommendations.filter((r) => r.type === 'license'),
    trust: recommendations.filter((r) => r.type === 'trust'),
    match: recommendations.filter((r) => r.type === 'match'),
  };

  const getTypeIcon = (type: Recommendation['type']) => {
    switch (type) {
      case 'cme':
        return BookOpen;
      case 'credential':
        return Award;
      case 'skill':
        return GraduationCap;
      case 'license':
        return MapPin;
      case 'trust':
        return TrendingUp;
      case 'match':
        return Target;
      default:
        return Target;
    }
  };

  const getTypeColor = (type: Recommendation['type']) => {
    switch (type) {
      case 'cme':
        return 'border-blue-200 bg-blue-50 dark:bg-blue-950/20';
      case 'credential':
        return 'border-purple-200 bg-purple-50 dark:bg-purple-950/20';
      case 'skill':
        return 'border-green-200 bg-green-50 dark:bg-green-950/20';
      case 'license':
        return 'border-amber-200 bg-amber-50 dark:bg-amber-950/20';
      case 'trust':
        return 'border-indigo-200 bg-indigo-50 dark:bg-indigo-950/20';
      case 'match':
        return 'border-pink-200 bg-pink-50 dark:bg-pink-950/20';
      default:
        return '';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Personalized Recommendations</h2>
        <p className="text-muted-foreground">
          High-impact suggestions to advance your career and maintain compliance
        </p>
      </div>

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All ({recommendations.length})</TabsTrigger>
          <TabsTrigger value="cme">CME ({byType.cme.length})</TabsTrigger>
          <TabsTrigger value="credential">Credentials ({byType.credential.length})</TabsTrigger>
          <TabsTrigger value="skill">Skills ({byType.skill.length})</TabsTrigger>
          <TabsTrigger value="license">Licenses ({byType.license.length})</TabsTrigger>
          <TabsTrigger value="trust">Trust ({byType.trust.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <RecommendationsList
            recommendations={recommendations}
            getTypeIcon={getTypeIcon}
            getTypeColor={getTypeColor}
          />
        </TabsContent>

        <TabsContent value="cme" className="space-y-4">
          <RecommendationsList
            recommendations={byType.cme}
            getTypeIcon={getTypeIcon}
            getTypeColor={getTypeColor}
          />
        </TabsContent>

        <TabsContent value="credential" className="space-y-4">
          <RecommendationsList
            recommendations={byType.credential}
            getTypeIcon={getTypeIcon}
            getTypeColor={getTypeColor}
          />
        </TabsContent>

        <TabsContent value="skill" className="space-y-4">
          <RecommendationsList
            recommendations={byType.skill}
            getTypeIcon={getTypeIcon}
            getTypeColor={getTypeColor}
          />
        </TabsContent>

        <TabsContent value="license" className="space-y-4">
          <RecommendationsList
            recommendations={byType.license}
            getTypeIcon={getTypeIcon}
            getTypeColor={getTypeColor}
          />
        </TabsContent>

        <TabsContent value="trust" className="space-y-4">
          <RecommendationsList
            recommendations={byType.trust}
            getTypeIcon={getTypeIcon}
            getTypeColor={getTypeColor}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface RecommendationsListProps {
  recommendations: Recommendation[];
  getTypeIcon: (type: Recommendation['type']) => typeof BookOpen;
  getTypeColor: (type: Recommendation['type']) => string;
}

function RecommendationsList({
  recommendations,
  getTypeIcon,
  getTypeColor,
}: RecommendationsListProps) {
  if (recommendations.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No recommendations in this category
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {recommendations.map((rec) => {
        const Icon = getTypeIcon(rec.type);
        const colorClass = getTypeColor(rec.type);

        return (
          <Card key={rec.id} className={`border-2 ${colorClass}`}>
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-lg bg-background">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-1">{rec.title}</h3>
                      <p className="text-sm text-muted-foreground">{rec.description}</p>
                    </div>
                    <Badge
                      variant={
                        rec.priority === 'high'
                          ? 'destructive'
                          : rec.priority === 'medium'
                          ? 'secondary'
                          : 'outline'
                      }
                    >
                      {rec.priority}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    {rec.estimatedTime && (
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        <span>{rec.estimatedTime}</span>
                      </div>
                    )}
                    {rec.cost !== undefined && (
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-4 w-4" />
                        <span>${rec.cost}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Target className="h-4 w-4" />
                      <span>Impact: {rec.impact}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Confidence:</span>
                      <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${rec.confidence * 100}%` }}
                        />
                      </div>
                      <span className="text-xs">{(rec.confidence * 100).toFixed(0)}%</span>
                    </div>
                    {rec.actionUrl && (
                      <Button size="sm" variant="default" asChild>
                        <a href={rec.actionUrl}>
                          Take Action
                          <ExternalLink className="h-3 w-3 ml-1" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

