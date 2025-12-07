'use client'

import React from 'react'
import { Card } from '@/components/design/Card'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Globe, ShieldCheck, ShieldAlert, Link, Map } from 'lucide-react'

// Mock data
const regionData = [
  { name: 'US', issuance: 1250, verification: 4500, rejected: 120 },
  { name: 'Canada', issuance: 320, verification: 890, rejected: 45 },
  { name: 'India', issuance: 850, verification: 2100, rejected: 85 },
  { name: 'Australia', issuance: 210, verification: 560, rejected: 15 },
  { name: 'EU', issuance: 540, verification: 1200, rejected: 60 },
]

const anchors = [
  { region: 'North America (US-East)', chain: 'Ethereum Mainnet', block: 18923456, timestamp: '2 mins ago', status: 'Finalized' },
  { region: 'Europe (Frankfurt)', chain: 'Polygon PoS', block: 56789012, timestamp: '15 secs ago', status: 'Finalized' },
  { region: 'Asia Pacific (Mumbai)', chain: 'Polkadot', block: 23456789, timestamp: '5 mins ago', status: 'Finalized' },
  { region: 'Oceania (Sydney)', chain: 'Solana', block: 234112345, timestamp: '30 secs ago', status: 'Finalized' },
]

export default function GlobalAuditPage() {
  return (
    <div className="space-y-8 p-8 bg-gray-50/50 min-h-screen">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Globe className="h-8 w-8 text-primary" />
            Global Audit Maps
          </h1>
          <p className="text-muted-foreground">
            Real-time visualization of global credential issuance, verification, and chain anchoring.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card padding="md" className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <ShieldCheck className="h-4 w-4" /> Total Issuance
          </div>
          <div className="text-2xl font-bold">3,170</div>
          <p className="text-xs text-green-600">+12% from last month</p>
        </Card>
        <Card padding="md" className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <ShieldCheck className="h-4 w-4" /> Total Verifications
          </div>
          <div className="text-2xl font-bold">9,250</div>
          <p className="text-xs text-green-600">+24% from last month</p>
        </Card>
        <Card padding="md" className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <ShieldAlert className="h-4 w-4" /> Rejected Attempts
          </div>
          <div className="text-2xl font-bold">325</div>
          <p className="text-xs text-red-600">-5% from last month</p>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-6" header={<h3 className="font-semibold">Activity by Region</h3>}>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={regionData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend />
                <Bar dataKey="issuance" name="Issuance" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="verification" name="Verifications" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="rejected" name="Rejected" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6" header={<h3 className="font-semibold">Geographic Chain Anchors</h3>}>
          <div className="space-y-6">
            <div className="relative h-[150px] w-full rounded-lg bg-indigo-50 flex items-center justify-center border border-indigo-100">
              <Map className="h-16 w-16 text-indigo-200" />
              <span className="absolute text-xs text-indigo-400 font-medium bottom-2">Live Network Topology</span>
            </div>

            <div className="space-y-4">
              {anchors.map((anchor, i) => (
                <div key={i} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                  <div className="flex items-start gap-3">
                    <div className="rounded-full bg-muted p-2">
                      <Link className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-medium">{anchor.region}</div>
                      <div className="text-sm text-muted-foreground">{anchor.chain}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1.5 text-sm font-medium text-green-600">
                      <div className="h-1.5 w-1.5 rounded-full bg-green-600 animate-pulse" />
                      {anchor.status}
                    </div>
                    <div className="text-xs text-muted-foreground">Block: {anchor.block.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">{anchor.timestamp}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}














