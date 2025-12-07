import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { TrustBadge } from "@/components/trust/TrustBadge"
import JobSuggestions from "./suggestions"

const candidates = [
  {
    id: "1",
    name: "Dr. Sarah Smith",
    specialty: "Cardiology",
    matchScore: 95,
    credentials: "Verified",
    image: "/avatars/01.png",
    riskScore: 0.1,
    trustScore: 0.92,
    reputationScore: 95,
  },
  {
    id: "2",
    name: "Dr. John Doe",
    specialty: "Cardiology",
    matchScore: 88,
    credentials: "Pending",
    image: "/avatars/02.png",
    riskScore: 0.4,
    trustScore: 0.65,
    reputationScore: 70,
  },
  {
    id: "3",
    name: "Dr. Emily Johnson",
    specialty: "Internal Medicine",
    matchScore: 75,
    credentials: "Verified",
    image: "/avatars/03.png",
    riskScore: 0.8,
    trustScore: 0.35,
    reputationScore: 40,
  },
]

export default function JobMatchesPage({ params }: { params: { id: string } }) {
  // Sort candidates by: 1. trustScore, 2. reputationScore, 3. matchScore
  const sortedCandidates = [...candidates].sort((a, b) => {
    if (b.trustScore !== a.trustScore) return b.trustScore - a.trustScore;
    if (b.reputationScore !== a.reputationScore) return b.reputationScore - a.reputationScore;
    return b.matchScore - a.matchScore;
  });

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Candidate Matches</h1>
        <p className="text-muted-foreground">Candidates matching job ID: {params.id}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {sortedCandidates.map((candidate) => (
          <Card key={candidate.id}>
            <CardHeader className="flex flex-row items-center gap-4">
              <Avatar className="h-12 w-12">
                <AvatarImage src={candidate.image} alt={candidate.name} />
                <AvatarFallback>{candidate.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
              </Avatar>
              <div>
                <CardTitle>{candidate.name}</CardTitle>
                <CardDescription>{candidate.specialty}</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4">
                <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Match Score</span>
                    <Badge variant={candidate.matchScore > 90 ? 'default' : 'secondary'}>
                        {candidate.matchScore}%
                    </Badge>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Credentials</span>
                    <Badge variant={candidate.credentials === 'Verified' ? 'outline' : 'destructive'}>
                        {candidate.credentials}
                    </Badge>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Social Trust</span>
                    <TrustBadge score={candidate.trustScore} />
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Reputation</span>
                    <Badge variant="outline">
                        {candidate.reputationScore}/100
                    </Badge>
                </div>
                 <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Risk Level</span>
                    <Badge variant={candidate.riskScore > 0.7 ? 'destructive' : candidate.riskScore > 0.3 ? 'secondary' : 'outline'}
                           className={candidate.riskScore > 0.3 && candidate.riskScore <= 0.7 ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-200" : ""}>
                        {candidate.riskScore > 0.7 ? 'High' : candidate.riskScore > 0.3 ? 'Medium' : 'Low'}
                    </Badge>
                </div>
                {candidate.reputationScore > 80 && (
                   <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded-md text-xs font-medium border border-blue-100">
                     Fast-lane Qualified
                   </div>
                )}
                <Button className="w-full">Request Verification</Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Auto-suggested candidates</h2>
          <p className="text-muted-foreground text-sm">
            Live recommendations from the matching engine for this requisition.
          </p>
        </div>
        <JobSuggestions jobId={params.id} />
      </section>
    </div>
  )
}
