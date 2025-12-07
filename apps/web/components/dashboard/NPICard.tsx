"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Shield, CheckCircle, RefreshCw, User, FileText, Clock } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface NPICardProps {
  npi: string
  name: string
  credentials: string
  status: string
  lastSynced?: string
  verified: boolean
  onSync: () => Promise<void>
}

export function NPICard({ npi, name, credentials, status, lastSynced, verified, onSync }: NPICardProps) {
  const [syncing, setSyncing] = useState(false)
  const { toast } = useToast()

  const handleSync = async () => {
    setSyncing(true)
    try {
      await onSync()
      toast({
        title: "Sync Complete",
        description: "NPI data has been updated successfully",
      })
    } catch (error) {
      toast({
        title: "Sync Failed",
        description: "Unable to sync NPI data. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSyncing(false)
    }
  }

  const formatLastSynced = (dateString?: string) => {
    if (!dateString) return "Never"
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))

    if (diffInHours < 1) return "Just now"
    if (diffInHours < 24) return `${diffInHours} hours ago`
    return date.toLocaleDateString()
  }

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-200">
      <CardHeader className="pb-4">
        <div className="flex flex-col space-y-3 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Shield className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">NPI Information</CardTitle>
              <CardDescription className="text-sm">National Provider Identifier</CardDescription>
            </div>
          </div>
          <Badge
            variant={verified ? "default" : "secondary"}
            className={`${verified ? "bg-green-100 text-green-800 border-green-200" : "bg-gray-100 text-gray-800 border-gray-200"} whitespace-nowrap self-start lg:self-auto`}
          >
            <CheckCircle className="h-3 w-3 mr-1" />
            {verified ? "Verified via NPPES" : "Unverified"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-gray-500 flex-shrink-0" />
            <span className="font-medium text-gray-700">NPI:</span>
            <span className="font-mono bg-gray-100 px-2 py-1 rounded text-xs font-medium">{npi}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4 text-gray-500 flex-shrink-0" />
            <span className="font-medium text-gray-700">Status:</span>
            <span className="text-gray-900">{status}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-gray-500 flex-shrink-0" />
            <span className="font-medium text-gray-700">Name:</span>
            <span className="text-gray-900 truncate">{name}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4 text-gray-500 flex-shrink-0" />
            <span className="font-medium text-gray-700">Credentials:</span>
            <span className="text-gray-900">{credentials}</span>
          </div>
        </div>

        <div className="flex flex-col space-y-3 lg:flex-row lg:items-center lg:justify-between lg:space-y-0 pt-4 border-t border-gray-100">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Clock className="h-4 w-4 flex-shrink-0" />
            <span>Last synced: {formatLastSynced(lastSynced)}</span>
          </div>
          <Button
            onClick={handleSync}
            disabled={syncing}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white self-start lg:self-auto"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing..." : "Sync Now"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
