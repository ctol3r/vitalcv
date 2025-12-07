"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, ExternalLink, RefreshCw, Receipt } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

interface BillingAuditRecord {
  eventId: string
  timestamp: string
  eventType: string
  action: string
  hash: string
  anchoredHash: string
  chainTxId?: string
  units?: number
  orgId?: string
}

export default function BillingAuditPage() {
  const [logs, setLogs] = useState<BillingAuditRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    fetchLogs()
  }, [])

  const fetchLogs = async () => {
    try {
      setIsLoading(true)
      // Fetch from the new billing audit endpoint
      const res = await fetch('/api/billing/audit')
      if (!res.ok) throw new Error('Failed to fetch billing audit logs')
      const data = await res.json()
      setLogs(data)
    } catch (error) {
      console.error(error)
      toast({
        title: "Error",
        description: "Failed to load billing audit logs",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
                <Receipt className="h-8 w-8" />
                Revenue & Billing Audit
            </h1>
            <p className="text-muted-foreground mt-1">Immutable record of all revenue-generating events anchored on-chain.</p>
        </div>
        <Button onClick={fetchLogs} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Anchored Billing Events</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Units</TableHead>
                  <TableHead>Proof Hash (SHA-256)</TableHead>
                  <TableHead>Substrate TX</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No billing records found</TableCell>
                    </TableRow>
                ) : (
                    logs.map((log) => (
                      <TableRow key={log.eventId}>
                        <TableCell className="whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </TableCell>
                        <TableCell className="font-medium">
                            {log.orgId ? (
                                <Badge variant="secondary">{log.orgId}</Badge>
                            ) : (
                                <span className="text-muted-foreground text-xs">-</span>
                            )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                              <span className="font-medium">{log.action}</span>
                              <span className="text-xs text-muted-foreground">{log.eventType}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                            <Badge variant="outline" className="font-mono">
                                {log.units ?? 0}
                            </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs max-w-[200px]">
                          <div className="truncate" title={log.anchoredHash}>{log.anchoredHash}</div>
                        </TableCell>
                        <TableCell>
                          {log.chainTxId ? (
                            <a
                                href={`https://polkadot.js.org/apps/?rpc=ws%3A%2F%2F127.0.0.1%3A9944#/explorer/query/${log.chainTxId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center text-blue-600 hover:underline text-xs"
                            >
                              {log.chainTxId.substring(0, 10)}... <ExternalLink className="ml-1 h-3 w-3" />
                            </a>
                          ) : (
                            <span className="text-muted-foreground text-xs">Pending</span>
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














