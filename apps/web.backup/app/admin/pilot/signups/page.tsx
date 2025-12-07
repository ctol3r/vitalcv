"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { formatDistanceToNow } from "date-fns"
import {
  BadgeCheck,
  Ban,
  Building2,
  ClipboardList,
  Loader2,
  Mail,
  NotebookPen,
  UserRound,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"

type PilotSignupStatus = "NEW" | "REVIEWING" | "APPROVED" | "REJECTED"
type FilterOption = "ALL" | PilotSignupStatus

interface PilotSignup {
  id: string
  orgName: string
  contactName: string
  email: string
  notes?: string
  status: PilotSignupStatus
  statusChangedAt?: string
  createdAt: string
  convertedOrgId?: string
  convertedUserId?: string
}

interface AdminPilotResponse {
  signups: PilotSignup[]
}

const STATUS_LABELS: Record<FilterOption, string> = {
  ALL: "All",
  NEW: "New",
  REVIEWING: "Reviewing",
  APPROVED: "Approved",
  REJECTED: "Rejected",
}

const STATUS_STYLES: Record<PilotSignupStatus, string> = {
  NEW: "bg-amber-50 text-amber-800 border-amber-200",
  REVIEWING: "bg-blue-50 text-blue-800 border-blue-200",
  APPROVED: "bg-emerald-50 text-emerald-800 border-emerald-200",
  REJECTED: "bg-rose-50 text-rose-800 border-rose-200",
}

export default function AdminPilotSignupsPage() {
  const [signups, setSignups] = useState<PilotSignup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterOption>("ALL")
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<PilotSignup | null>(null)
  const { toast } = useToast()

  const fetchSignups = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams()
      if (filter !== "ALL") {
        params.set("status", filter)
      }
      const response = await fetch(`/admin/pilot/signups${params.toString() ? `?${params}` : ""}`)
      if (!response.ok) {
        throw new Error("Failed to load pilot signups")
      }
      const data: AdminPilotResponse = await response.json()
      setSignups(data.signups ?? [])
    } catch (err) {
      console.error("Failed to fetch pilot signups", err)
      setError("Could not load pilot signups. Please retry.")
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    fetchSignups()
  }, [fetchSignups])

  const filteredSignups = useMemo(() => {
    if (!search.trim()) return signups
    return signups.filter((signup) => {
      const query = search.toLowerCase()
      return (
        signup.orgName.toLowerCase().includes(query) ||
        signup.contactName.toLowerCase().includes(query) ||
        signup.email.toLowerCase().includes(query)
      )
    })
  }, [signups, search])

  const handleStatusChange = async (signup: PilotSignup, status: PilotSignupStatus) => {
    try {
      const response = await fetch(`/admin/pilot/signups/${signup.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data?.message || "Unable to update signup")
      }

      setSignups((prev) =>
        prev.map((item) => (item.id === signup.id ? (data.signup as PilotSignup) : item)),
      )
      setSelected(data.signup)
      toast({
        title: `Signup ${status === "APPROVED" ? "approved" : status === "REJECTED" ? "rejected" : "updated"}`,
        description:
          data.conversion && status === "APPROVED"
            ? `Org ${data.conversion.orgName} and admin ${data.conversion.adminEmail} provisioned.`
            : `${signup.orgName} marked as ${status.toLowerCase()}.`,
      })
    } catch (err) {
      console.error("Failed to update signup status", err)
      toast({
        title: "Update failed",
        description: "Please try again or refresh the page.",
        variant: "destructive",
      })
    }
  }

  const selectedSubtitle = selected
    ? `Submitted ${formatDistanceToNow(new Date(selected.createdAt), { addSuffix: true })}`
    : ""

  return (
    <div className="container mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-semibold">
            <ClipboardList className="h-8 w-8 text-primary" />
            Pilot Leads
          </h1>
          <p className="text-muted-foreground">
            Track every inbound pilot request and convert qualified orgs in a single view.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            placeholder="Search org, contact, or email"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full sm:w-72"
          />
          <Button variant="outline" onClick={fetchSignups} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Refresh
          </Button>
        </div>
      </header>

      <Tabs value={filter} onValueChange={(value) => setFilter(value as FilterOption)} className="mb-6">
        <TabsList className="w-full justify-start overflow-x-auto">
          {(Object.keys(STATUS_LABELS) as FilterOption[]).map((status) => (
            <TabsTrigger key={status} value={status} className="gap-2">
              {STATUS_LABELS[status]}
              <Badge variant="secondary" className="rounded-full bg-muted px-2 text-xs">
                {status === "ALL"
                  ? signups.length
                  : signups.filter((signup) => signup.status === status).length}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Inbound requests</CardTitle>
          <CardDescription>
            {loading
              ? "Loading pilot requests..."
              : filteredSignups.length
                ? `${filteredSignups.length} lead${filteredSignups.length === 1 ? "" : "s"}`
                : "No leads match this filter"}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {error ? (
            <div className="p-6">
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organization</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading pilot signups…
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredSignups.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                        No leads found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSignups.map((signup) => (
                      <TableRow
                        key={signup.id}
                        className="cursor-pointer hover:bg-muted/40"
                        onClick={() => setSelected(signup)}
                      >
                        <TableCell className="font-medium">{signup.orgName}</TableCell>
                        <TableCell>{signup.contactName}</TableCell>
                        <TableCell className="text-muted-foreground">{signup.email}</TableCell>
                        <TableCell>
                          <Badge className={`border ${STATUS_STYLES[signup.status]}`} variant="outline">
                            {signup.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDistanceToNow(new Date(signup.createdAt), { addSuffix: true })}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-xl">
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-col gap-1">
                  <span>{selected.orgName}</span>
                  <Badge className={`w-fit border ${STATUS_STYLES[selected.status]}`} variant="outline">
                    {selected.status}
                  </Badge>
                </DialogTitle>
                <DialogDescription>{selectedSubtitle}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="rounded-lg border bg-muted/40 p-4">
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <UserRound className="h-4 w-4 text-primary" />
                    {selected.contactName}
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={`mailto:${selected.email}`}
                      className="text-primary underline-offset-2 hover:underline"
                    >
                      {selected.email}
                    </a>
                  </div>
                </div>

                <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    {selected.orgName}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <NotebookPen className="h-4 w-4" />
                    <span>
                      Status updated{" "}
                      {selected.statusChangedAt
                        ? formatDistanceToNow(new Date(selected.statusChangedAt), { addSuffix: true })
                        : "N/A"}
                    </span>
                  </div>
                  {selected.convertedOrgId ? (
                    <div className="mt-2 flex items-center gap-2 text-emerald-600">
                      <BadgeCheck className="h-4 w-4" />
                      <span>Converted org #{selected.convertedOrgId}</span>
                    </div>
                  ) : null}
                </div>

                <div>
                  <h4 className="mb-2 text-sm font-semibold">Pilot context</h4>
                  <p className="min-h-[80px] whitespace-pre-line rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                    {selected.notes && selected.notes.trim().length > 0
                      ? selected.notes
                      : "No additional notes provided."}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  <Button
                    onClick={() => handleStatusChange(selected, "REVIEWING")}
                    disabled={selected.status === "REVIEWING" || loading}
                    variant="outline"
                  >
                    <NotebookPen className="mr-2 h-4 w-4" />
                    Mark reviewing
                  </Button>
                  <Button
                    onClick={() => handleStatusChange(selected, "APPROVED")}
                    disabled={selected.status === "APPROVED" || loading}
                  >
                    <BadgeCheck className="mr-2 h-4 w-4" />
                    Approve & convert
                  </Button>
                  <Button
                    onClick={() => handleStatusChange(selected, "REJECTED")}
                    disabled={selected.status === "REJECTED" || loading}
                    variant="destructive"
                  >
                    <Ban className="mr-2 h-4 w-4" />
                    Reject
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
