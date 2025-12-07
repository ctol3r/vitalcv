'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getAdminSession, clearAdminSession } from '@/lib/admin/auth';
import { AdminRole } from '@/lib/admin/types';
import {
  Users,
  Building2,
  Link2,
  Brain,
  BarChart3,
  Activity,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Dashboard', href: '/portal/dashboard', icon: BarChart3 },
  { name: 'Users', href: '/portal/users', icon: Users },
  { name: 'Facilities', href: '/portal/facilities', icon: Building2 },
  { name: 'Chain', href: '/portal/chain', icon: Link2 },
  { name: 'AI', href: '/portal/ai', icon: Brain },
  { name: 'Analytics', href: '/portal/analytics', icon: BarChart3 },
  { name: 'Activity', href: '/portal/activity', icon: Activity },
];

export default function AdminPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const adminSession = getAdminSession();
    if (!adminSession) {
      // Redirect to login if no session
      router.push('/portal/login');
      return;
    }
    setSession(adminSession);
  }, [router]);

  const handleLogout = () => {
    clearAdminSession();
    router.push('/portal/login');
  };

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">Loading admin session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar toggle */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-background border-b">
        <div className="flex items-center justify-between p-4">
          <h1 className="text-lg font-semibold">VitalCV Admin</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-40 h-screen w-64 bg-card border-r transition-transform lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo/Header */}
          <div className="p-6 border-b">
            <h1 className="text-xl font-bold">VitalCV Admin</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Staff & Admin Portal
            </p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* User Info & Logout */}
          <div className="p-4 border-t space-y-2">
            <div className="px-3 py-2">
              <p className="text-sm font-medium">{session.name || session.email}</p>
              <p className="text-xs text-muted-foreground">
                {session.roles.join(', ')}
              </p>
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="lg:pl-64 pt-16 lg:pt-0">
        {children}
      </main>
    </div>
  );
}

