"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { FileText, CheckCircle, XCircle, AlertTriangle, Calendar } from "lucide-react"

interface License {
  state: string
  number: string
  status: "active" | "expired" | "expiring_soon"
  expiration: string
  verified: boolean
}

interface LicensureCardProps {
  licenses: License[]
}

export function LicensureCard({ licenses }: LicensureCardProps) {
  const getLicenseStatusConfig = (status: string) => {
    switch (status) {
      case "active":
        return {
          variant: "default" as const,
          color: "text-green-700",
          bgColor: "bg-green-50 border-green-200",
          icon: <CheckCircle className="h-4 w-4 text-green-600" />,
        }
      case "expiring_soon":
        return {
          variant: "secondary" as const,
          color: "text-orange-700",
          bgColor: "bg-orange-50 border-orange-200",
          icon: <AlertTriangle className="h-4 w-4 text-orange-600" />,
        }
      case "expired":
        return {
          variant: "destructive" as const,
          color: "text-red-700",
          bgColor: "bg-red-50 border-red-200",
          icon: <XCircle className="h-4 w-4 text-red-600" />,
        }
      default:
        return {
          variant: "secondary" as const,
          color: "text-gray-700",
          bgColor: "bg-gray-50 border-gray-200",
          icon: <FileText className="h-4 w-4 text-gray-600" />,
        }
    }
  }

  const formatExpirationDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    if (diffInDays < 0) return `Expired ${Math.abs(diffInDays)} days ago`
    if (diffInDays <= 90) return `Expires in ${diffInDays} days`
    return `Expires ${date.toLocaleDateString()}`
  }

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-200">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <FileText className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <CardTitle className="text-lg font-semibold">State Licensure</CardTitle>
            <CardDescription className="text-sm">Professional licenses and certifications</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {licenses.map((license, index) => {
            const config = getLicenseStatusConfig(license.status)
            return (
              <div
                key={index}
                className={`p-4 border rounded-lg transition-all duration-200 hover:shadow-sm ${config.bgColor}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{license.state}</span>
                      <Badge variant={config.variant} className="text-xs">
                        {config.icon}
                        <span className="ml-1">{license.status.replace("_", " ")}</span>
                      </Badge>
                    </div>

                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2">
                        <FileText className="h-3 w-3 text-gray-500" />
                        <span className="text-gray-600">License #</span>
                        <span className="font-mono text-gray-900">{license.number}</span>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3 w-3 text-gray-500" />
                          <span className={`text-sm ${config.color}`}>{formatExpirationDate(license.expiration)}</span>
                        </div>

                        <div className="flex items-center gap-1">
                          {license.verified ? (
                            <CheckCircle className="h-3 w-3 text-green-600" />
                          ) : (
                            <XCircle className="h-3 w-3 text-red-600" />
                          )}
                          <span className={`text-xs ${license.verified ? "text-green-700" : "text-red-700"}`}>
                            {license.verified ? "Verified" : "Unverified"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
