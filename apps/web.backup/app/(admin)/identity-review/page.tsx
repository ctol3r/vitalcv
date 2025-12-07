import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle, XCircle } from "lucide-react";

// Mock Data
const flaggedUsers = [
  {
    id: "1",
    name: "Dr. Strange",
    npi: "1234567890",
    riskScore: 0.85,
    riskReason: "High Artifact Score (Deepfake)",
    timestamp: "2023-10-27T10:00:00Z",
    status: "flagged",
  },
  {
    id: "2",
    name: "Dr. Who",
    npi: "0987654321",
    riskScore: 0.45,
    riskReason: "Low Liveness Score",
    timestamp: "2023-10-27T11:30:00Z",
    status: "flagged",
  }
];

export default function IdentityReviewPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Identity Review Queue</h1>
          <p className="text-muted-foreground">Review flagged identity verifications and potential deepfakes.</p>
        </div>
        <Button variant="outline">Export Log</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Flagged Verifications</CardTitle>
          <CardDescription>High risk attempts requiring manual review.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Clinician</TableHead>
                <TableHead>Risk Score</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Timestamp</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flaggedUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{user.name}</span>
                      <span className="text-xs text-muted-foreground">NPI: {user.npi}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.riskScore > 0.7 ? "destructive" : "secondary"}>
                      {(user.riskScore * 100).toFixed(0)}% Risk
                    </Badge>
                  </TableCell>
                  <TableCell>{user.riskReason}</TableCell>
                  <TableCell>{new Date(user.timestamp).toLocaleString()}</TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button size="sm" variant="default" className="bg-green-600 hover:bg-green-700">
                        <CheckCircle className="w-4 h-4 mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="destructive">
                        <XCircle className="w-4 h-4 mr-1" /> Reject
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}














