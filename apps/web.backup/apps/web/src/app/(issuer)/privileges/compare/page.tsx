'use client'

import { useMemo, useState } from 'react'
import { ArrowDownToLine, ArrowSwitch, ClipboardList, RefreshCw, ShieldCheck } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const PRIVILEGE_PACKS = [
  {
    id: 'pack-core',
    name: 'Hybrid Cath Core Pack',
    version: 'v4.2',
    org: 'Northlake Heart Institute',
    riskTier: 'moderate',
    privileges: ['CORE-100', 'CARD-220', 'CARD-320', 'STRUCT-410'],
    controls: ['BoardCert', 'ACLS', 'Experience>5', 'ProcedureVolume:CARD-320>=50'],
  },
  {
    id: 'pack-specialty',
    name: 'Robotics + Structural Bundle',
    version: 'v3.8',
    org: 'Metro Surgical Alliance',
    riskTier: 'high',
    privileges: ['CORE-100', 'CARD-320', 'STRUCT-410', 'ROBOT-500', 'HYBRID-720'],
    controls: ['BoardCert', 'ACLS', 'RoboticsProctor', 'ProcedureVolume:ROBOT-500>=20'],
  },
  {
    id: 'pack-telemed',
    name: 'Telehealth PCI Pilot Pack',
    version: 'v2.1',
    org: 'Virtual Cardio Collaborative',
    riskTier: 'low',
    privileges: ['CORE-100', 'CARD-220'],
    controls: ['BoardCert', 'TelehealthOrientation'],
  },
] as const

const CLINICIAN_PROFILE = {
  id: 'cln_42',
  name: 'Dr. Amara Chen',
  grantedPrivileges: ['CORE-100', 'CARD-220', 'CARD-320'],
  outstandingNeeds: ['STRUCT-410'],
}

export default function PrivilegePackComparisonPage() {
  const [leftPackId, setLeftPackId] = useState<string>(PRIVILEGE_PACKS[0].id)
  const [rightPackId, setRightPackId] = useState<string>(PRIVILEGE_PACKS[1].id)

  const leftPack = PRIVILEGE_PACKS.find((pack) => pack.id === leftPackId) ?? PRIVILEGE_PACKS[0]
  const rightPack = PRIVILEGE_PACKS.find((pack) => pack.id === rightPackId) ?? PRIVILEGE_PACKS[1]

  const comparison = useMemo(() => buildComparison(leftPack, rightPack), [leftPack, rightPack])
  const clinicianGaps = useMemo(() => buildClinicianGaps(leftPack, rightPack), [leftPack, rightPack])

  const handleDownload = () => {
    const payload = {
      generatedAt: new Date().toISOString(),
      packs: {
        left: leftPack,
        right: rightPack,
      },
      comparison,
      clinicianGaps,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `privilege-compare-${leftPack.id}-${rightPack.id}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6 p-8">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">Issuer &raquo; Privileges &raquo; Compare</p>
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="text-3xl font-bold tracking-tight">Privilege pack comparison</h1>
          <Badge variant="outline" className="gap-1">
            <ShieldCheck className="h-3.5 w-3.5" />
            Automated committees ready
          </Badge>
        </div>
        <p className="text-muted-foreground max-w-2xl">
          Compare machine-readable privileging packs, highlight deltas, and surface clinician-specific remediation steps.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowSwitch className="h-4 w-4 text-primary" />
            Select packs to compare
          </CardTitle>
          <CardDescription>Differences are recalculated on the fly.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-[3fr_3fr_auto]">
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">Reference pack</div>
            <Select value={leftPackId} onValueChange={setLeftPackId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select pack" />
              </SelectTrigger>
              <SelectContent>
                {PRIVILEGE_PACKS.map((pack) => (
                  <SelectItem key={pack.id} value={pack.id}>
                    {pack.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">Comparison pack</div>
            <Select value={rightPackId} onValueChange={setRightPackId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select pack" />
              </SelectTrigger>
              <SelectContent>
                {PRIVILEGE_PACKS.filter((pack) => pack.id !== leftPackId).map((pack) => (
                  <SelectItem key={pack.id} value={pack.id}>
                    {pack.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={() => {
                setLeftPackId(PRIVILEGE_PACKS[0].id)
                setRightPackId(PRIVILEGE_PACKS[1].id)
              }}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Reset selection
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Shared privileges" value={comparison.shared.length} tone="success" detail={comparison.shared.join(', ') || 'None'} />
        <SummaryCard
          label={`${leftPack.name} only`}
          value={comparison.leftOnly.length}
          tone="default"
          detail={comparison.leftOnly.join(', ') || 'No unique privileges'}
        />
        <SummaryCard
          label={`${rightPack.name} only`}
          value={comparison.rightOnly.length}
          tone="warning"
          detail={comparison.rightOnly.join(', ') || 'No unique privileges'}
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Privilege matrix deltas</CardTitle>
              <CardDescription>Tracks code-level changes and risk tiers.</CardDescription>
            </div>
            <Button variant="outline" onClick={handleDownload}>
              <ArrowDownToLine className="mr-2 h-4 w-4" />
              Download JSON summary
            </Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Privilege code</TableHead>
                <TableHead>{leftPack.name}</TableHead>
                <TableHead>{rightPack.name}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {comparison.union.map((code) => (
                <TableRow key={code}>
                  <TableCell className="font-medium">{code}</TableCell>
                  <TableCell>{renderPresence(code, comparison.leftSet)}</TableCell>
                  <TableCell>{renderPresence(code, comparison.rightSet)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Clinician-specific gaps</CardTitle>
            <CardDescription>Mapped against {CLINICIAN_PROFILE.name}'s wallet.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {clinicianGaps.map((gap) => (
              <div key={gap.packId} className="rounded-md border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{gap.packName}</p>
                    <p className="text-sm text-muted-foreground">{gap.org}</p>
                  </div>
                  <Badge variant={gap.missing.length ? 'destructive' : 'secondary'}>
                    {gap.missing.length ? `${gap.missing.length} gaps` : 'All satisfied'}
                  </Badge>
                </div>
                <div className="mt-3 space-y-2 text-sm">
                  <p className="text-muted-foreground">Missing privileges:</p>
                  {gap.missing.length ? (
                    <ul className="list-disc pl-5 text-foreground">
                      {gap.missing.map((code) => (
                        <li key={code}>{code}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>None</p>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Control plane comparison</CardTitle>
            <CardDescription>Shows rule tokens and automation considerations.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {[leftPack, rightPack].map((pack) => (
              <div key={pack.id} className="rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-sm">{pack.name}</p>
                  <Badge variant="outline" className="uppercase text-xs">
                    {pack.riskTier}
                  </Badge>
                </div>
                <ul className="mt-3 space-y-1 text-sm">
                  {pack.controls.map((control) => (
                    <li key={control} className="flex items-center gap-2">
                      <ClipboardList className="h-4 w-4 text-muted-foreground" />
                      {control}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function buildComparison(
  left: (typeof PRIVILEGE_PACKS)[number],
  right: (typeof PRIVILEGE_PACKS)[number],
) {
  const leftSet = new Set(left.privileges)
  const rightSet = new Set(right.privileges)
  const shared = left.privileges.filter((code) => rightSet.has(code))
  const leftOnly = left.privileges.filter((code) => !rightSet.has(code))
  const rightOnly = right.privileges.filter((code) => !leftSet.has(code))
  const union = Array.from(new Set([...left.privileges, ...right.privileges]))

  return {
    shared,
    leftOnly,
    rightOnly,
    union,
    leftSet,
    rightSet,
  }
}

function buildClinicianGaps(
  left: (typeof PRIVILEGE_PACKS)[number],
  right: (typeof PRIVILEGE_PACKS)[number],
) {
  const granted = new Set(CLINICIAN_PROFILE.grantedPrivileges)
  return [left, right].map((pack) => ({
    packId: pack.id,
    packName: pack.name,
    org: pack.org,
    missing: pack.privileges.filter((code) => !granted.has(code)),
  }))
}

function renderPresence(code: string, set: Set<string>) {
  if (set.has(code)) {
    return (
      <Badge variant="outline" className="gap-1 border-emerald-200 text-emerald-700">
        <ShieldCheck className="h-3.5 w-3.5" />
        Included
      </Badge>
    )
  }
  return (
    <Badge variant="destructive" className="gap-1">
      Missing
    </Badge>
  )
}

interface SummaryCardProps {
  label: string
  value: number
  detail: string
  tone: 'success' | 'warning' | 'default'
}

function SummaryCard({ label, value, detail, tone }: SummaryCardProps) {
  const toneClasses =
    tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : tone === 'warning'
        ? 'border-amber-200 bg-amber-50 text-amber-900'
        : 'border-muted bg-muted/30'
  return (
    <Card className={toneClasses}>
      <CardHeader className="pb-2">
        <CardDescription className="text-xs uppercase tracking-wide">{label}</CardDescription>
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm">{detail}</p>
      </CardContent>
    </Card>
  )
}

