"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { CheckCircle2, XCircle, Clock, Search, Eye, Download } from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"

interface ReviewItem {
  id: string
  npi: string
  providerName: string
  confidence: number
  decision: "approve" | "reject" | "pending"
  reason?: string
  submittedAt: string
  reviewedAt?: string
  reviewedBy?: string
}

export default function ReviewerQueue() {
  const [items, setItems] = useState<ReviewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  useEffect(() => {
    // Mock data - replace with actual API call
    const fetchQueue = async () => {
      try {
        // const response = await fetch(`/api/reviewer/queue?confidence_lt=0.90&page=${currentPage}`);
        // const data = await response.json();
        // setItems(data.items);

        // Mock data
        setTimeout(() => {
          setItems([
            {
              id: "rev-1",
              npi: "1234567890",
              providerName: "Dr. Jane Smith",
              confidence: 0.85,
              decision: "pending",
              reason: "Low confidence in license verification",
              submittedAt: "2025-01-09T08:00:00Z",
            },
            {
              id: "rev-2",
              npi: "0987654321",
              providerName: "Dr. John Doe",
              confidence: 0.78,
              decision: "pending",
              reason: "Missing required documentation",
              submittedAt: "2025-01-09T07:30:00Z",
            },
            {
              id: "rev-3",
              npi: "1122334455",
              providerName: "Dr. Sarah Johnson",
              confidence: 0.82,
              decision: "pending",
              reason: "Ambiguous specialty classification",
              submittedAt: "2025-01-09T07:00:00Z",
            },
            {
              id: "rev-4",
              npi: "5566778899",
              providerName: "Dr. Michael Brown",
              confidence: 0.88,
              decision: "approve",
              reason: "Manually reviewed and approved",
              submittedAt: "2025-01-09T06:00:00Z",
              reviewedAt: "2025-01-09T08:15:00Z",
              reviewedBy: "admin@example.com",
            },
            {
              id: "rev-5",
              npi: "9988776655",
              providerName: "Dr. Emily Davis",
              confidence: 0.75,
              decision: "reject",
              reason: "Failed verification checks",
              submittedAt: "2025-01-09T05:30:00Z",
              reviewedAt: "2025-01-09T07:45:00Z",
              reviewedBy: "admin@example.com",
            },
          ])
          setLoading(false)
        }, 500)
      } catch (error) {
        console.error("Failed to fetch reviewer queue:", error)
        setLoading(false)
      }
    }

    fetchQueue()
  }, [currentPage])

  const filteredItems = items.filter(
    (item) =>
      item.providerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.npi.includes(searchQuery),
  )

  const pendingItems = filteredItems.filter((item) => item.decision === "pending")
  const paginatedItems = pendingItems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  )

  const handleApprove = async (id: string) => {
    // API call to approve
    try {
      // await fetch(`/api/reviewer/approve/${id}`, { method: 'POST' });
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                decision: "approve" as const,
                reviewedAt: new Date().toISOString(),
                reviewedBy: "current-user@example.com",
              }
            : item,
        ),
      )
    } catch (error) {
      console.error("Failed to approve:", error)
    }
  }

  const handleReject = async (id: string) => {
    // API call to reject
    try {
      // await fetch(`/api/reviewer/reject/${id}`, { method: 'POST' });
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                decision: "reject" as const,
                reviewedAt: new Date().toISOString(),
                reviewedBy: "current-user@example.com",
              }
            : item,
        ),
      )
    } catch (error) {
      console.error("Failed to reject:", error)
    }
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.85) return "text-green-600 dark:text-green-400"
    if (confidence >= 0.75) return "text-amber-600 dark:text-amber-400"
    return "text-red-600 dark:text-red-400"
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Clock className="h-8 w-8" />
          Reviewer Queue (HITL)
        </h1>
        <p className="text-muted-foreground">
          Human-in-the-loop review queue for items with confidence &lt; 0.90
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Review</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{pendingItems.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Approved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">
              {filteredItems.filter((item) => item.decision === "approve").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Rejected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600 dark:text-red-400">
              {filteredItems.filter((item) => item.decision === "reject").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by provider name or NPI..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Queue Table */}
      <Card>
        <CardHeader>
          <CardTitle>Review Queue</CardTitle>
          <CardDescription>
            Items requiring human review (confidence &lt; 0.90). Approve/Return actions write to audit trail.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Loading queue...</div>
          ) : paginatedItems.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No pending items in queue</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead>NPI</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.providerName}</TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">{item.npi}</code>
                      </TableCell>
                      <TableCell>
                        <span className={cn("font-semibold", getConfidenceColor(item.confidence))}>
                          {(item.confidence * 100).toFixed(1)}%
                        </span>
                      </TableCell>
                      <TableCell className="max-w-md">
                        <p className="text-sm text-muted-foreground truncate">{item.reason}</p>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(item.submittedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleApprove(item.id)}
                            className="gap-1"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReject(item.id)}
                            className="gap-1"
                          >
                            <XCircle className="h-4 w-4" />
                            Return
                          </Button>
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/reviewer/${item.id}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(`http://localhost:4000/api/compliance/export/ncqa/${item.id}`, '_blank')}
                            title="Download Verification Evidence (NCQA)"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {pendingItems.length > itemsPerPage && (
                <div className="mt-6 flex justify-center">
                  <Pagination>
                    <PaginationContent>
                      {currentPage > 1 && (
                        <PaginationItem>
                          <PaginationPrevious
                            href="#"
                            onClick={(e) => {
                              e.preventDefault()
                              setCurrentPage(currentPage - 1)
                            }}
                          />
                        </PaginationItem>
                      )}
                      {Array.from({ length: Math.ceil(pendingItems.length / itemsPerPage) }, (_, i) => i + 1).map(
                        (page) => (
                          <PaginationItem key={page}>
                            <PaginationLink
                              href="#"
                              isActive={page === currentPage}
                              onClick={(e) => {
                                e.preventDefault()
                                setCurrentPage(page)
                              }}
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        ),
                      )}
                      {currentPage < Math.ceil(pendingItems.length / itemsPerPage) && (
                        <PaginationItem>
                          <PaginationNext
                            href="#"
                            onClick={(e) => {
                              e.preventDefault()
                              setCurrentPage(currentPage + 1)
                            }}
                          />
                        </PaginationItem>
                      )}
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

