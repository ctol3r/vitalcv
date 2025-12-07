'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useRealtime } from "@/hooks/useRealtime"
import { useEffect, useState } from "react"
import { Users } from "lucide-react"

export default function RecruiterDashboard() {
  const { onUserPresence, isConnected } = useRealtime();
  const [onlineUsers, setOnlineUsers] = useState<{userId: string, role: string}[]>([]);

  useEffect(() => {
    const cleanup = onUserPresence((event, data) => {
      if (event === 'online') {
        setOnlineUsers(prev => {
            if (prev.some(u => u.userId === data.userId)) return prev;
            return [...prev, data];
        });
      } else {
        setOnlineUsers(prev => prev.filter(u => u.userId !== data.userId));
      }
    });
    return cleanup;
  }, [onUserPresence]);

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Recruiter Dashboard</h1>
            <p className="text-muted-foreground">Manage job postings and verify candidates.</p>
        </div>
        <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm text-muted-foreground">{isConnected ? 'Live' : 'Connecting...'}</span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Active Job Postings</CardTitle>
            <CardDescription>Manage your current open positions.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground">+2 from last week</p>
            <Button asChild className="mt-4 w-full">
                <Link href="/jobs">View Jobs</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Candidate Matches</CardTitle>
            <CardDescription>Potential candidates for your jobs.</CardDescription>
          </CardHeader>
           <CardContent>
            <div className="text-2xl font-bold">24</div>
            <p className="text-xs text-muted-foreground">5 new matches today</p>
             <Button asChild variant="outline" className="mt-4 w-full">
                <Link href="/jobs">Review Matches</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Verification Requests</CardTitle>
            <CardDescription>Pending credential verifications.</CardDescription>
          </CardHeader>
           <CardContent>
            <div className="text-2xl font-bold">3</div>
            <p className="text-xs text-muted-foreground">Action required</p>
             <Button asChild variant="secondary" className="mt-4 w-full">
                <Link href="/requests">View Requests</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Live Presence
                </CardTitle>
                <CardDescription>Active users on platform</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{onlineUsers.length}</div>
                <p className="text-xs text-muted-foreground mb-4">Real-time updates</p>
                <div className="space-y-2 max-h-[100px] overflow-y-auto">
                    {onlineUsers.length === 0 && <p className="text-xs text-muted-foreground">No recently active users.</p>}
                    {onlineUsers.map(user => (
                        <div key={user.userId} className="flex items-center justify-between text-sm">
                            <span className="truncate w-20" title={user.userId}>{user.userId}</span>
                            <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded capitalize">{user.role}</span>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
          <Card className="col-span-1">
              <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <p className="text-sm font-medium leading-none">New Match Found</p>
                            <p className="text-xs text-muted-foreground">Dr. Smith matched for "Cardiologist"</p>
                        </div>
                        <div className="text-xs text-muted-foreground">2h ago</div>
                    </div>
                     <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <p className="text-sm font-medium leading-none">Verification Request</p>
                            <p className="text-xs text-muted-foreground">Jane Doe requested verification</p>
                        </div>
                        <div className="text-xs text-muted-foreground">5h ago</div>
                    </div>
                  </div>
              </CardContent>
          </Card>
           <Card className="col-span-1">
              <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                  <Button asChild variant="outline" className="justify-start">
                      <Link href="/jobs/new">+ Post New Job</Link>
                  </Button>
                  <Button variant="outline" className="justify-start">
                      Search Candidates
                  </Button>
              </CardContent>
          </Card>
      </div>
    </div>
  )
}
