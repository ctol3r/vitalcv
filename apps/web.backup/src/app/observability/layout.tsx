import { ReactNode } from 'react'
import Link from 'next/link'
import { Activity, AlertTriangle, BarChart3, FileText, Gauge, Settings } from 'lucide-react'

import { cn } from '@/lib/utils'

const navigation = [
  { name: 'Dashboard', href: '/observability/dashboard', icon: BarChart3 },
  { name: 'Metrics', href: '/observability/metrics', icon: Gauge },
  { name: 'Logs', href: '/observability/logs', icon: FileText },
  { name: 'Traces', href: '/observability/traces', icon: Activity },
  { name: 'Alerts', href: '/observability/alerts', icon: AlertTriangle },
  { name: 'Incidents', href: '/observability/incidents', icon: AlertTriangle },
  { name: 'Settings', href: '/observability/settings', icon: Settings },
]

export default function ObservabilityLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <aside className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col border-r bg-background">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto px-6 py-6">
          <div className="flex h-16 shrink-0 items-center">
            <h2 className="text-lg font-semibold">Observability</h2>
          </div>
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-1">
              {navigation.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={cn(
                      'group flex gap-x-3 rounded-md p-3 text-sm leading-6 font-medium transition-colors',
                      'text-muted-foreground hover:text-foreground hover:bg-muted',
                      'data-[active=true]:bg-primary/10 data-[active=true]:text-primary'
                    )}
                  >
                    <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </aside>
      <main className="lg:pl-64">{children}</main>
    </div>
  )
}

