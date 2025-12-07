'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Moon, Sun, Menu, X, Book, Palette, Code, Accessibility, Layout, Zap } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Design principles content
const designPrinciples = {
  overview: {
    title: 'Design Principles',
    content: `Our design system is built on core principles that ensure consistency, accessibility, and scalability across all applications.`,
  },
  principles: [
    {
      title: 'Accessibility First',
      description: 'Every component meets WCAG 2.1 AA standards, ensuring our platform is usable by everyone.',
      icon: Accessibility,
    },
    {
      title: 'Consistency',
      description: 'Unified design language across all applications creates a cohesive user experience.',
      icon: Layout,
    },
    {
      title: 'Performance',
      description: 'Optimized components with minimal bundle size and fast rendering.',
      icon: Zap,
    },
    {
      title: 'Developer Experience',
      description: 'Well-documented, type-safe components that are easy to use and extend.',
      icon: Code,
    },
  ],
}

// Design tokens content
const designTokens = {
  colors: {
    title: 'Color System',
    description: 'Our color system uses semantic tokens that adapt to light and dark themes.',
    tokens: [
      { name: 'Primary', value: 'hsl(var(--primary))', usage: 'Main actions, links' },
      { name: 'Secondary', value: 'hsl(var(--secondary))', usage: 'Secondary actions' },
      { name: 'Destructive', value: 'hsl(var(--destructive))', usage: 'Errors, deletions' },
      { name: 'Muted', value: 'hsl(var(--muted))', usage: 'Subtle backgrounds' },
      { name: 'Accent', value: 'hsl(var(--accent))', usage: 'Highlights, emphasis' },
    ],
  },
  typography: {
    title: 'Typography',
    description: 'Consistent typography scale ensures readable and hierarchical content.',
    scale: [
      { name: 'xs', size: '0.75rem', lineHeight: '1rem' },
      { name: 'sm', size: '0.875rem', lineHeight: '1.25rem' },
      { name: 'base', size: '1rem', lineHeight: '1.5rem' },
      { name: 'lg', size: '1.125rem', lineHeight: '1.75rem' },
      { name: 'xl', size: '1.25rem', lineHeight: '1.75rem' },
      { name: '2xl', size: '1.5rem', lineHeight: '2rem' },
      { name: '3xl', size: '1.875rem', lineHeight: '2.25rem' },
      { name: '4xl', size: '2.25rem', lineHeight: '2.5rem' },
    ],
  },
  spacing: {
    title: 'Spacing Scale',
    description: '8px base unit spacing system for consistent layouts.',
    scale: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64],
  },
}

// Navigation items
const navItems = [
  { href: '/design-system/docs', label: 'Overview', icon: Book },
  { href: '/design-system/docs/tokens', label: 'Design Tokens', icon: Palette },
  { href: '/design-system/docs/components', label: 'Components', icon: Code },
  { href: '/design-system/docs/accessibility', label: 'Accessibility', icon: Accessibility },
  { href: '/design-system/docs/layouts', label: 'Layouts', icon: Layout },
  { href: '/design-system/playground', label: 'Playground', icon: Zap },
]

export default function DesignSystemDocsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const pathname = usePathname()

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    document.documentElement.classList.toggle('dark', newTheme === 'dark')
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <Link href="/design-system/docs" className="flex items-center gap-2">
              <Book className="h-5 w-5" />
              <span className="font-semibold">Design System</span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggleTheme}>
              {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </header>

      <div className="container flex">
        {/* Sidebar Navigation */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-64 border-r bg-background pt-16 transition-transform lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <nav className="h-full overflow-y-auto p-4">
            <ul className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                        isActive
                          ? 'bg-accent text-accent-foreground'
                          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                      }`}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 lg:ml-64">
          <div className="mx-auto max-w-4xl p-6 lg:p-8">
            {/* Overview Section */}
            <section className="mb-12">
              <h1 className="mb-4 text-4xl font-bold">Design System</h1>
              <p className="mb-8 text-lg text-muted-foreground">
                {designPrinciples.overview.content}
              </p>

              <div className="grid gap-6 md:grid-cols-2">
                {designPrinciples.principles.map((principle) => {
                  const Icon = principle.icon
                  return (
                    <Card key={principle.title}>
                      <CardHeader>
                        <div className="flex items-center gap-3">
                          <Icon className="h-5 w-5 text-primary" />
                          <CardTitle>{principle.title}</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <CardDescription>{principle.description}</CardDescription>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </section>

            {/* Design Tokens Section */}
            <section className="mb-12">
              <h2 className="mb-6 text-3xl font-bold">Design Tokens</h2>

              <Tabs defaultValue="colors" className="w-full">
                <TabsList>
                  <TabsTrigger value="colors">Colors</TabsTrigger>
                  <TabsTrigger value="typography">Typography</TabsTrigger>
                  <TabsTrigger value="spacing">Spacing</TabsTrigger>
                </TabsList>

                <TabsContent value="colors" className="mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>{designTokens.colors.title}</CardTitle>
                      <CardDescription>{designTokens.colors.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {designTokens.colors.tokens.map((token) => (
                          <div key={token.name} className="flex items-center justify-between">
                            <div>
                              <div className="font-medium">{token.name}</div>
                              <div className="text-sm text-muted-foreground">{token.usage}</div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div
                                className="h-10 w-20 rounded border"
                                style={{
                                  backgroundColor: token.value.includes('primary')
                                    ? 'hsl(var(--primary))'
                                    : token.value.includes('secondary')
                                      ? 'hsl(var(--secondary))'
                                      : token.value.includes('destructive')
                                        ? 'hsl(var(--destructive))'
                                        : token.value.includes('muted')
                                          ? 'hsl(var(--muted))'
                                          : 'hsl(var(--accent))',
                                }}
                              />
                              <code className="text-sm">{token.value}</code>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="typography" className="mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>{designTokens.typography.title}</CardTitle>
                      <CardDescription>{designTokens.typography.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {designTokens.typography.scale.map((scale) => (
                          <div key={scale.name} className="flex items-center justify-between">
                            <div>
                              <div className="font-medium">text-{scale.name}</div>
                              <div
                                className={`text-${scale.name}`}
                                style={{
                                  fontSize: scale.size,
                                  lineHeight: scale.lineHeight,
                                }}
                              >
                                The quick brown fox jumps over the lazy dog
                              </div>
                            </div>
                            <code className="text-sm text-muted-foreground">
                              {scale.size} / {scale.lineHeight}
                            </code>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="spacing" className="mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>{designTokens.spacing.title}</CardTitle>
                      <CardDescription>{designTokens.spacing.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {designTokens.spacing.scale.map((unit) => (
                          <div key={unit} className="flex items-center gap-4">
                            <div className="w-20 text-sm font-medium">spacing-{unit}</div>
                            <div
                              className="h-4 bg-primary"
                              style={{ width: `${unit * 8}px` }}
                            />
                            <code className="text-sm text-muted-foreground">
                              {unit * 8}px
                            </code>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </section>

            {/* Component Usage Section */}
            <section className="mb-12">
              <h2 className="mb-6 text-3xl font-bold">Component Usage</h2>
              <Card>
                <CardHeader>
                  <CardTitle>Getting Started</CardTitle>
                  <CardDescription>
                    All components are located in <code>@/components/ui</code> and follow a
                    consistent API pattern.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg bg-muted p-4">
                    <pre className="text-sm">
                      <code>{`import { Button } from '@/components/ui/button'

<Button variant="default" size="default">
  Click me
</Button>`}</code>
                    </pre>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* Storybook Integration */}
            <section className="mb-12">
              <h2 className="mb-6 text-3xl font-bold">Live Examples</h2>
              <Card>
                <CardHeader>
                  <CardTitle>Storybook Integration</CardTitle>
                  <CardDescription>
                    View interactive component examples in Storybook. If Storybook is running, the
                    iframe below will display the component library.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="aspect-video w-full overflow-hidden rounded-lg border">
                    <iframe
                      src="http://localhost:6006"
                      className="h-full w-full"
                      title="Storybook Component Library"
                      style={{ minHeight: '400px' }}
                    />
                  </div>
                  <p className="mt-4 text-sm text-muted-foreground">
                    Note: Start Storybook with <code>npm run storybook</code> to view live examples.
                  </p>
                </CardContent>
              </Card>
            </section>
          </div>
        </main>
      </div>
    </div>
  )
}

