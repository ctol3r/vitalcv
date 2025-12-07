'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { Download, FileText, Search, Calendar } from 'lucide-react'

interface DataAccessLog {
  id: string
  recordId: string
  accessorId: string
  timestamp: Date
  reason: string
  metadata?: Record<string, unknown> | null
}

interface AccessLogsExplorerProps {
  className?: string
}

const MOCK_LOGS: DataAccessLog[] = [
  {
    id: 'log-1',
    recordId: 'cred-12345',
    accessorId: 'user-abc',
    timestamp: new Date('2025-01-15T10:30:00Z'),
    reason: 'Credential verification',
    metadata: { endpoint: '/api/verify', ip: '192.168.1.1' },
  },
  {
    id: 'log-2',
    recordId: 'cred-12345',
    accessorId: 'user-def',
    timestamp: new Date('2025-01-15T09:15:00Z'),
    reason: 'Privilege evaluation',
    metadata: { endpoint: '/api/privileges/check', orgId: 'org-123' },
  },
  {
    id: 'log-3',
    recordId: 'rep-67890',
    accessorId: 'user-ghi',
    timestamp: new Date('2025-01-14T14:20:00Z'),
    reason: 'Reputation score calculation',
    metadata: { endpoint: '/api/reputation/calculate', modelId: 'model-v2' },
  },
  {
    id: 'log-4',
    recordId: 'cred-12345',
    accessorId: 'user-jkl',
    timestamp: new Date('2025-01-14T11:45:00Z'),
    reason: 'Access audit',
    metadata: { endpoint: '/api/audit/access', auditorId: 'auditor-1' },
  },
]

export function AccessLogsExplorer({ className }: AccessLogsExplorerProps) {
  const [logs, setLogs] = useState<DataAccessLog[]>(MOCK_LOGS)
  const [filteredLogs, setFilteredLogs] = useState<DataAccessLog[]>(MOCK_LOGS)
  const [searchTerm, setSearchTerm] = useState('')
  const [recordFilter, setRecordFilter] = useState<string>('all')
  const [accessorFilter, setAccessorFilter] = useState<string>('all')
  const [reasonFilter, setReasonFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<string>('all')
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    // In production, fetch logs from API with filters
    let filtered = [...logs]

    if (searchTerm) {
      filtered = filtered.filter(
        (log) =>
          log.recordId.toLowerCase().includes(searchTerm.toLowerCase()) ||
          log.accessorId.toLowerCase().includes(searchTerm.toLowerCase()) ||
          log.reason.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (recordFilter !== 'all') {
      filtered = filtered.filter((log) => log.recordId === recordFilter)
    }

    if (accessorFilter !== 'all') {
      filtered = filtered.filter((log) => log.accessorId === accessorFilter)
    }

    if (reasonFilter !== 'all') {
      filtered = filtered.filter((log) => log.reason === reasonFilter)
    }

    if (dateFilter !== 'all') {
      const now = new Date()
      const filterDate = new Date()
      switch (dateFilter) {
        case 'today':
          filterDate.setHours(0, 0, 0, 0)
          filtered = filtered.filter((log) => log.timestamp >= filterDate)
          break
        case '7d':
          filterDate.setDate(filterDate.getDate() - 7)
          filtered = filtered.filter((log) => log.timestamp >= filterDate)
          break
        case '30d':
          filterDate.setDate(filterDate.getDate() - 30)
          filtered = filtered.filter((log) => log.timestamp >= filterDate)
          break
      }
    }

    setFilteredLogs(filtered)
  }, [logs, searchTerm, recordFilter, accessorFilter, reasonFilter, dateFilter])

  const exportToCSV = async () => {
    setIsExporting(true)
    try {
      const headers = ['ID', 'Record ID', 'Accessor ID', 'Timestamp', 'Reason', 'Metadata']
      const rows = filteredLogs.map((log) => [
        log.id,
        log.recordId,
        log.accessorId,
        log.timestamp.toISOString(),
        log.reason,
        JSON.stringify(log.metadata || {}),
      ])

      const csvContent = [headers, ...rows]
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `access-logs-${new Date().toISOString().split('T')[0]}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error('Failed to export CSV:', error)
    } finally {
      setIsExporting(false)
    }
  }

  const exportToPDF = async () => {
    setIsExporting(true)
    try {
      // In production, this would call an API endpoint to generate PDF
      // For now, we'll create a simple HTML representation that can be printed
      const printWindow = window.open('', '_blank')
      if (!printWindow) return

      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Access Logs Export</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              h1 { color: #333; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; }
            </style>
          </head>
          <body>
            <h1>Data Access Logs</h1>
            <p>Generated: ${new Date().toLocaleString()}</p>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Record ID</th>
                  <th>Accessor ID</th>
                  <th>Timestamp</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                ${filteredLogs
                  .map(
                    (log) => `
                  <tr>
                    <td>${log.id}</td>
                    <td>${log.recordId}</td>
                    <td>${log.accessorId}</td>
                    <td>${log.timestamp.toLocaleString()}</td>
                    <td>${log.reason}</td>
                  </tr>
                `
                  )
                  .join('')}
              </tbody>
            </table>
          </body>
        </html>
      `

      printWindow.document.write(htmlContent)
      printWindow.document.close()
      printWindow.print()
    } catch (error) {
      console.error('Failed to export PDF:', error)
    } finally {
      setIsExporting(false)
    }
  }

  const uniqueRecords = Array.from(new Set(logs.map((log) => log.recordId)))
  const uniqueAccessors = Array.from(new Set(logs.map((log) => log.accessorId)))
  const uniqueReasons = Array.from(new Set(logs.map((log) => log.reason)))

  return (
    <div className={cn('space-y-4', className)}>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
        <Select value={recordFilter} onValueChange={setRecordFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Record" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Records</SelectItem>
            {uniqueRecords.map((record) => (
              <SelectItem key={record} value={record}>
                {record}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={accessorFilter} onValueChange={setAccessorFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Accessor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Accessors</SelectItem>
            {uniqueAccessors.map((accessor) => (
              <SelectItem key={accessor} value={accessor}>
                {accessor}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={reasonFilter} onValueChange={setReasonFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Reason" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Reasons</SelectItem>
            {uniqueReasons.map((reason) => (
              <SelectItem key={reason} value={reason}>
                {reason}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={dateFilter} onValueChange={setDateFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Date" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Dates</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Export Buttons */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {filteredLogs.length} of {logs.length} logs
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToCSV} disabled={isExporting}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={exportToPDF} disabled={isExporting}>
            <FileText className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Record ID</TableHead>
              <TableHead>Accessor ID</TableHead>
              <TableHead>Timestamp</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Metadata</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No logs found matching your filters
                </TableCell>
              </TableRow>
            ) : (
              filteredLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-medium">{log.recordId}</TableCell>
                  <TableCell>{log.accessorId}</TableCell>
                  <TableCell>{log.timestamp.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{log.reason}</Badge>
                  </TableCell>
                  <TableCell>
                    {log.metadata ? (
                      <details className="cursor-pointer">
                        <summary className="text-sm text-muted-foreground">View metadata</summary>
                        <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      </details>
                    ) : (
                      <span className="text-muted-foreground text-sm">None</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

