import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, AlertTriangle, XCircle, Calendar, User, FileText } from "lucide-react"

interface VerificationResult {
  status: "valid" | "revoked" | "unknown"
  credentialId: string
  details?: {
    issuer?: string
    issuedDate?: string
    expiryDate?: string
    reason?: string
    disclosureType?: string
  }
}

interface CredentialStatusCardProps {
  result: VerificationResult
}

export function CredentialStatusCard({ result }: CredentialStatusCardProps) {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case "valid":
        return {
          icon: <CheckCircle className="h-6 w-6" />,
          color: "text-green-600",
          bgColor: "bg-green-50 border-green-200",
          badgeVariant: "default" as const,
          title: "Credential Valid",
          description: "This credential has been successfully verified and is currently active.",
        }
      case "revoked":
        return {
          icon: <AlertTriangle className="h-6 w-6" />,
          color: "text-yellow-600",
          bgColor: "bg-yellow-50 border-yellow-200",
          badgeVariant: "secondary" as const,
          title: "Credential Revoked",
          description: "This credential has been revoked and is no longer valid.",
        }
      case "unknown":
        return {
          icon: <XCircle className="h-6 w-6" />,
          color: "text-red-600",
          bgColor: "bg-red-50 border-red-200",
          badgeVariant: "destructive" as const,
          title: "Credential Unknown",
          description: "This credential could not be found in our verification system.",
        }
      default:
        return {
          icon: <XCircle className="h-6 w-6" />,
          color: "text-gray-600",
          bgColor: "bg-gray-50 border-gray-200",
          badgeVariant: "secondary" as const,
          title: "Unknown Status",
          description: "Unable to determine credential status.",
        }
    }
  }

  const config = getStatusConfig(result.status)

  return (
    <Card className={`${config.bgColor} border-2 shadow-lg`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={config.color}>{config.icon}</div>
            <div>
              <CardTitle className="text-lg">{config.title}</CardTitle>
              <CardDescription className="text-sm">{config.description}</CardDescription>
            </div>
          </div>
          <Badge variant={config.badgeVariant} className="capitalize">
            {result.status}
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-gray-500" />
              <span className="font-medium">Credential ID:</span>
              <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{result.credentialId}</span>
            </div>

            {result.details?.issuer && (
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-gray-500" />
                <span className="font-medium">Issuer:</span>
                <span>{result.details.issuer}</span>
              </div>
            )}
          </div>

          {result.details && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {result.details.issuedDate && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <span className="font-medium">Issued:</span>
                  <span>{new Date(result.details.issuedDate).toLocaleDateString()}</span>
                </div>
              )}

              {result.details.expiryDate && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <span className="font-medium">Expires:</span>
                  <span>{new Date(result.details.expiryDate).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          )}

          {result.details?.reason && (
            <div className="mt-4 p-3 bg-white/50 rounded-lg border">
              <p className="text-sm">
                <span className="font-medium">Reason:</span> {result.details.reason}
              </p>
            </div>
          )}

          {result.details?.disclosureType && (
            <div className="mt-2">
              <Badge variant="outline" className="text-xs">
                {result.details.disclosureType}
              </Badge>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
