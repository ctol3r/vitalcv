import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { BookOpen, Home } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Knowledge Base - Chai VC Platform',
  description: 'Knowledge base, documentation, and help articles',
};

export default function KnowledgeBaseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Bar */}
      <nav className="border-b bg-card">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/knowledge" className="flex items-center gap-2 font-semibold">
                <BookOpen className="h-5 w-5" />
                Knowledge Base
              </Link>
              <div className="hidden md:flex items-center gap-1">
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/knowledge">Home</Link>
                </Button>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/knowledge/analytics">Analytics</Link>
                </Button>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/knowledge/author/dashboard">My Articles</Link>
                </Button>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/knowledge/editorial-queue">Editorial Queue</Link>
                </Button>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/knowledge/tags">Tags</Link>
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/">
                  <Home className="h-4 w-4 mr-2" />
                  Home
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </nav>
      {children}
    </div>
  );
}

