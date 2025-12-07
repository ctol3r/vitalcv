'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = true; // Replace with actual auth check

  if (!isAdmin) {
    return (
      <div className="p-8">
        <div className="max-w-md mx-auto mt-20 text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
          <p className="text-gray-600">You are not authorized to access this area.</p>
        </div>
      </div>
    );
  }

  const navItems = [
    { href: '/admin/security', label: 'Security' },
    { href: '/admin/auth', label: 'WebAuthn' },
    { href: '/admin/sla', label: 'SLA Reports' },
    { href: '/status', label: 'Status Page' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Admin Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">Admin Dashboard</h1>
            <Link href="/" className="text-sm text-blue-600 hover:underline">
              ← Back to Site
            </Link>
          </div>
        </div>
      </header>

      {/* Admin Navigation */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex space-x-8">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                  pathname === item.href
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </nav>

      {/* Admin Content */}
      <main>{children}</main>
    </div>
  );
}
