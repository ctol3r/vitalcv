"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Loader2 } from "lucide-react"

interface BotEvent {
  id: string
  ip: string
  fpHash: string | null
  reason: string | null
  score: number
  createdAt: string
}

export default function BotDashboard() {
  const [events, setEvents] = useState<BotEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    fetchEvents()
  }, [])

  const fetchEvents = async () => {
    try {
        const res = await fetch('/api/admin/bots');
        if (res.ok) {
            const data = await res.json();
            setEvents(data);
        } else {
            setError("Failed to load bot events");
        }
    } catch (err) {
        setError("Network error");
    } finally {
        setIsLoading(false);
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Bot Activity Dashboard</h1>

      {error && <div className="text-red-500 mb-4">{error}</div>}

      <Card>
        <CardHeader>
          <CardTitle>Recent Suspicious Activities</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
             <div className="flex justify-center p-4"><Loader2 className="animate-spin" /></div>
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>IP Address</TableHead>
                <TableHead>Risk Score</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Fingerprint Hash</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.length === 0 ? (
                  <TableRow>
                      <TableCell colSpan={5} className="text-center">No events found</TableCell>
                  </TableRow>
              ) : (
                  events.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>{new Date(event.createdAt).toLocaleString()}</TableCell>
                      <TableCell>{event.ip}</TableCell>
                      <TableCell>
                        <Badge variant={event.score > 50 ? "destructive" : "secondary"}>
                          {event.score}
                        </Badge>
                      </TableCell>
                      <TableCell>{event.reason || "-"}</TableCell>
                      <TableCell className="font-mono text-xs truncate max-w-[200px]">
                        {event.fpHash || "-"}
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

