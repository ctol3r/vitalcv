"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, ExternalLink, RefreshCw } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

interface AuditRecord {
  eventId: string
  timestamp: string
  issuerId: string // Actor
  action: string
  eventType: string
  hash: string
  txId?: string
  payload?: any
}

export default function AuditLogViewer() {
  const [logs, setLogs] = useState<AuditRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    fetchLogs()
  }, [])

  const fetchLogs = async () => {
    try {
      setIsLoading(true)
      const res = await fetch('/api/audit')
      if (!res.ok) throw new Error('Failed to fetch audit logs')
      const data = await res.json()
      setLogs(data)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load audit logs",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Platform Audit Log</h1>
        <Button onClick={fetchLogs} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Immutable Audit Trail</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Immutable ID / Hash</TableHead>
                  <TableHead>Chain TX</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={6} className="text-center">No audit records found</TableCell>
                    </TableRow>
                ) : (
                    logs.map((log) => (
                      <TableRow key={log.eventId}>
                        <TableCell className="whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{log.issuerId}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{log.action}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground capitalize">
                          {log.eventType.replace(/_/g, ' ')}
                        </TableCell>
                        <TableCell className="font-mono text-xs truncate max-w-[150px]" title={log.hash}>
                          {log.eventId}
                          <div className="text-[10px] text-muted-foreground truncate">{log.hash}</div>
                        </TableCell>
                        <TableCell>
                          {log.txId ? (
                            <a href={`#chain/${log.txId}`} className="flex items-center text-blue-600 hover:underline text-xs">
                              View <ExternalLink className="ml-1 h-3 w-3" />
                            </a>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

