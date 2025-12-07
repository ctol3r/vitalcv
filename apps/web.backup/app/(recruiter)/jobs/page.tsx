import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

const jobs = [
  {
    id: "1",
    title: "Senior Cardiologist",
    datePosted: "2023-10-25",
    status: "Active",
    matches: 12,
  },
  {
    id: "2",
    title: "Pediatric Nurse",
    datePosted: "2023-10-20",
    status: "Active",
    matches: 5,
  },
  {
    id: "3",
    title: "Anesthesiologist",
    datePosted: "2023-10-15",
    status: "Closed",
    matches: 8,
  },
]

export default function JobsPage() {
  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Job Postings</h1>
            <p className="text-muted-foreground">Manage your job listings and view matches.</p>
        </div>
        <Button asChild>
            <Link href="/jobs/new">Post New Job</Link>
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Job Title</TableHead>
              <TableHead>Date Posted</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Matches</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((job) => (
              <TableRow key={job.id}>
                <TableCell className="font-medium">{job.title}</TableCell>
                <TableCell>{job.datePosted}</TableCell>
                <TableCell>
                    <Badge variant={job.status === 'Active' ? 'default' : 'secondary'}>
                        {job.status}
                    </Badge>
                </TableCell>
                <TableCell>{job.matches} Candidates</TableCell>
                <TableCell className="text-right">
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/jobs/${job.id}/matches`}>View Matches</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

