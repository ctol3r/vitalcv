"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown, ChevronRight, CheckCircle, Clock, AlertTriangle } from "lucide-react"

interface Credential {
  id: string
  type: string
  issuer: string
  status?: string
  reason?: string
}

interface ReportSummaryProps {
  title: string
  type: "cleared" | "pending" | "flagged"
  credentials: Credential[]
}

export function ReportSummary({ title, type, credentials }: ReportSummaryProps) {
  const [isOpen, setIsOpen] = useState(true)

  const getTypeConfig = (type: string) => {
    switch (type) {
      case "cleared":
        return {
          icon: <CheckCircle className="h-5 w-5 text-green-600" />,
          badgeVariant: "default" as const,
          badgeColor: "bg-green-100 text-green-800",
          borderColor: "border-green-200",
        }
      case "pending":
        return {
          icon: <Clock className="h-5 w-5 text-yellow-600" />,
          badgeVariant: "secondary" as const,
          badgeColor: "bg-yellow-100 text-yellow-800",
          borderColor: "border-yellow-200",
        }
      case "flagged":
        return {
          icon: <AlertTriangle className="h-5 w-5 text-red-600" />,
          badgeVariant: "destructive" as const,
          badgeColor: "bg-red-100 text-red-800",
          borderColor: "border-red-200",
        }
      default:
        return {
          icon: <CheckCircle className="h-5 w-5 text-gray-600" />,
          badgeVariant: "secondary" as const,
          badgeColor: "bg-gray-100 text-gray-800",
          borderColor: "border-gray-200",
        }
    }
  }

  const config = getTypeConfig(type)

  return (
    <Card className={`bg-white/80 backdrop-blur-sm border-0 shadow-lg ${config.borderColor} border-l-4`}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-gray-50/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {config.icon}
                <div>
                  <CardTitle className="text-lg">{title}</CardTitle>
                  <CardDescription>
                    {credentials.length} credential{credentials.length !== 1 ? "s" : ""}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={config.badgeColor}>{credentials.length}</Badge>
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-500" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="space-y-3">
              {credentials.map((credential, index) => (
                <div
                  key={credential.id}
                  className="flex items-center justify-between p-3 bg-white/50 rounded-lg border"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{credential.type}</span>
                      <Badge variant="outline" className="text-xs">
                        {credential.id}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">{credential.issuer}</p>
                    {credential.reason && <p className="text-xs text-gray-500 mt-1">{credential.reason}</p>}
                  </div>

                  <div className="flex items-center gap-2">
                    {credential.status && (
                      <Badge variant={credential.status === "Valid" ? "default" : "secondary"} className="text-xs">
                        {credential.status}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}
