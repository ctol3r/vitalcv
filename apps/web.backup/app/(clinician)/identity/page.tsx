import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ShieldCheck, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ClinicianIdentityPage() {
  // Mock Status
  const identityStatus = {
    status: "verified", // verified, failed, pending
    livenessScore: 0.92,
    deepfakeRisk: 0.05,
    faceMatchScore: 0.98,
    documentAuthenticity: "Verified",
    lastChecked: "2023-10-25"
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Identity Proof</h1>
        <p className="text-muted-foreground">Manage your identity verification status and proofs.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Verification Status</CardTitle>
            <CardDescription>Current status of your identity proof.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-4">
              {identityStatus.status === "verified" ? (
                <ShieldCheck className="w-12 h-12 text-green-500" />
              ) : (
                <AlertTriangle className="w-12 h-12 text-yellow-500" />
              )}
              <div>
                <h3 className="text-xl font-bold capitalize">{identityStatus.status}</h3>
                <p className="text-sm text-muted-foreground">Last verified: {identityStatus.lastChecked}</p>
              </div>
            </div>

            {identityStatus.status !== "verified" && (
                 <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-md">
                    <p className="text-sm text-yellow-800">Your identity verification needs attention. Please re-verify to continue issuing credentials.</p>
                    <Button className="mt-2" size="sm">Start Verification</Button>
                 </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Security Metrics</CardTitle>
            <CardDescription>Detailed analysis of your identity proof.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Face Match Confidence</span>
                <span className="font-medium">{(identityStatus.faceMatchScore * 100).toFixed(0)}%</span>
              </div>
              <Progress value={identityStatus.faceMatchScore * 100} />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Liveness Score</span>
                <span className="font-medium">{(identityStatus.livenessScore * 100).toFixed(0)}%</span>
              </div>
              <Progress value={identityStatus.livenessScore * 100} />
            </div>

             <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Deepfake Risk</span>
                <span className="font-medium">{(identityStatus.deepfakeRisk * 100).toFixed(0)}%</span>
              </div>
              <Progress value={identityStatus.deepfakeRisk * 100} className="bg-slate-100 [&>div]:bg-red-500" />
              <p className="text-xs text-muted-foreground">Lower is better</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}














