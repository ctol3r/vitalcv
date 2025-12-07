"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, CreditCard, Users, Check } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

export default function BillingPage() {
  const [loading, setLoading] = useState(true)
  const [subscription, setSubscription] = useState<any>(null)
  const [orgId, setOrgId] = useState<string>("")
  const { toast } = useToast()

  useEffect(() => {
    // TODO: Get actual orgId from context/auth
    const storedOrgId = "org_default";
    setOrgId(storedOrgId);
    fetchSubscription(storedOrgId);
  }, [])

  const fetchSubscription = async (oid: string) => {
    try {
      setLoading(true)
      const res = await fetch(`/api/billing/subscription?orgId=${oid}`)
      if (res.ok) {
        const data = await res.json()
        setSubscription(data.subscription)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubscribe = async (planId: string) => {
    try {
      const res = await fetch('/api/billing/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, planId }),
      })
      if (!res.ok) throw new Error('Subscription failed')
      const data = await res.json()
      setSubscription(data)
      toast({ title: "Success", description: "Subscribed successfully" })
    } catch (error) {
      toast({ title: "Error", description: "Failed to subscribe", variant: "destructive" })
    }
  }

  const handleAddSeat = async () => {
    if (!subscription) return
    try {
      const res = await fetch('/api/billing/seat/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId: subscription.id }),
      })
      if (!res.ok) throw new Error('Failed to add seat')
      toast({ title: "Success", description: "Seat added" })
      // Refresh to get updated quantity
      fetchSubscription(orgId)
    } catch (error) {
      toast({ title: "Error", description: "Failed to add seat", variant: "destructive" })
    }
  }

  const handleRemoveSeat = async () => {
    if (!subscription) return
    try {
      const res = await fetch('/api/billing/seat/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId: subscription.id }),
      })
      if (!res.ok) throw new Error('Failed to remove seat')
      toast({ title: "Success", description: "Seat removed" })
      fetchSubscription(orgId)
    } catch (error) {
      toast({ title: "Error", description: "Failed to remove seat", variant: "destructive" })
    }
  }

  const handlePortal = async () => {
    try {
      const res = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, returnUrl: window.location.href }),
      })
      if (!res.ok) throw new Error('Failed to create portal session')
      const { url } = await res.json()
      window.location.href = url
    } catch (error) {
      toast({ title: "Error", description: "Failed to open portal", variant: "destructive" })
    }
  }

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Billing & Subscription</h1>

      {!subscription ? (
        <Card>
          <CardHeader>
            <CardTitle>Choose a Plan</CardTitle>
            <CardDescription>Select a plan to get started</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
             <div className="border p-4 rounded-lg cursor-pointer hover:border-primary transition-colors" onClick={() => handleSubscribe('price_basic')}>
                <h3 className="font-bold">Basic</h3>
                <p>$10/seat/mo</p>
                <ul className="text-sm mt-2 list-disc list-inside">
                   <li>Basic features</li>
                   <li>Email support</li>
                </ul>
                <Button className="w-full mt-4" onClick={(e) => { e.stopPropagation(); handleSubscribe('price_basic'); }}>Subscribe</Button>
             </div>
              <div className="border p-4 rounded-lg cursor-pointer hover:border-primary transition-colors" onClick={() => handleSubscribe('price_pro')}>
                <h3 className="font-bold">Pro</h3>
                <p>$20/seat/mo</p>
                <ul className="text-sm mt-2 list-disc list-inside">
                   <li>All features</li>
                   <li>Priority support</li>
                   <li>Advanced analytics</li>
                </ul>
                <Button className="w-full mt-4" onClick={(e) => { e.stopPropagation(); handleSubscribe('price_pro'); }}>Subscribe</Button>
             </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Current Plan</CardTitle>
            </CardHeader>
            <CardContent>
               <div className="text-2xl font-bold capitalize">{subscription.plan?.nickname || subscription.plan?.product || 'Standard Plan'}</div>
               <Badge className="mt-2 capitalize" variant={subscription.status === 'active' ? 'default' : 'destructive'}>
                 {subscription.status}
               </Badge>
               <div className="mt-4 text-sm text-gray-500">
                 Renews on {new Date(subscription.current_period_end * 1000).toLocaleDateString()}
               </div>
            </CardContent>
            <CardFooter>
               <Button variant="outline" onClick={handlePortal}>Manage in Stripe Portal</Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Seats</CardTitle>
              <CardDescription>Manage your team size</CardDescription>
            </CardHeader>
            <CardContent>
               <div className="flex items-center justify-between">
                  <div className="flex items-center">
                     <Users className="w-5 h-5 mr-2 text-gray-500"/>
                     <span className="text-xl font-bold">{subscription.items?.data[0]?.quantity || 1}</span>
                     <span className="ml-2 text-gray-500">active seats</span>
                  </div>
                  <div className="space-x-2">
                     <Button size="sm" variant="outline" onClick={handleRemoveSeat}>-</Button>
                     <Button size="sm" variant="outline" onClick={handleAddSeat}>+</Button>
                  </div>
               </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}















