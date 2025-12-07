"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FileCheck, History, User } from "lucide-react"
import { format } from "date-fns"

export interface AccessLogEntry {
  id: string
  timestamp: string
  credentialId: string
  verifier: string
  auditRef: string
  status: "valid" | "revoked" | "unknown"
}

interface AccessLogProps {
  entries: AccessLogEntry[]
  className?: string
}

export function AccessLog({ entries, className = "" }: AccessLogProps) {
  const sortedEntries = [...entries].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )

  const getStatusConfig = (status: AccessLogEntry["status"]) => {
    switch (status) {
      case "valid":
        return {
          variant: "default" as const,
          className: "bg-green-100 text-green-800",
          label: "Valid",
        }
      case "revoked":
        return {
          variant: "destructive" as const,
          className: "bg-red-100 text-red-800",
          label: "Revoked",
        }
      case "unknown":
        return {
          variant: "secondary" as const,
          className: "bg-gray-100 text-gray-800",
          label: "Unknown",
        }
    }
  }

  if (entries.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="h-5 w-5" />
            Access Log
          </CardTitle>
          <CardDescription>View verification history and access attempts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-gray-500">
            <FileCheck className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p className="text-sm">No verification history yet</p>
            <p className="text-xs mt-1">Verification events will appear here as they occur</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <History className="h-5 w-5" />
          Access Log
        </CardTitle>
        <CardDescription>
          {entries.length} verification{entries.length !== 1 ? "s" : ""} recorded
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Credential</TableHead>
                <TableHead>Verifier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Audit Reference</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedEntries.map((entry) => {
                const statusConfig = getStatusConfig(entry.status)
                return (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium whitespace-nowrap">
                      <time dateTime={entry.timestamp}>
                        {format(new Date(entry.timestamp), "MMM d, yyyy")}
                        <br />
                        <span className="text-xs text-gray-500">
                          {format(new Date(entry.timestamp), "h:mm a")}
                        </span>
                      </time>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">
                        {entry.credentialId}
                      </code>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-gray-400" />
                        <span className="text-sm">{entry.verifier}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusConfig.variant} className={statusConfig.className}>
                        {statusConfig.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs text-gray-600 font-mono">{entry.auditRef}</code>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
