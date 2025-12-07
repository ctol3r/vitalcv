/**
 * B246C-DES-027: Component Playground with Live Editing
 *
 * Interactive playground allowing users to edit component props and see changes live.
 * Supports theme toggling and code snippet capture.
 */

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Moon, Sun, Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

// Component configurations
const componentConfigs = {
  Button: {
    props: {
      variant: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
      size: ['default', 'sm', 'lg', 'icon'],
      disabled: [true, false],
    },
    defaultProps: {
      variant: 'default',
      size: 'default',
      disabled: false,
      children: 'Button',
    },
  },
  Badge: {
    props: {
      variant: ['default', 'secondary', 'destructive', 'outline'],
    },
    defaultProps: {
      variant: 'default',
      children: 'Badge',
    },
  },
}

export default function ComponentPlaygroundPage() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [selectedComponent, setSelectedComponent] = useState<'Button' | 'Badge'>('Button')
  const [componentProps, setComponentProps] = useState<Record<string, unknown>>(
    componentConfigs[selectedComponent].defaultProps
  )
  const [copied, setCopied] = useState(false)

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    document.documentElement.classList.toggle('dark', newTheme === 'dark')
  }

  const handlePropChange = (prop: string, value: unknown) => {
    setComponentProps((prev) => ({
      ...prev,
      [prop]: value,
    }))
  }

  const generateCode = () => {
    const propsString = Object.entries(componentProps)
      .filter(([key, value]) => {
        const defaultProps = componentConfigs[selectedComponent].defaultProps
        return value !== defaultProps[key]
      })
      .map(([key, value]) => {
        if (typeof value === 'string') {
          return `${key}="${value}"`
        }
        if (typeof value === 'boolean') {
          return value ? key : `${key}={false}`
        }
        return `${key}={${value}}`
      })
      .join(' ')

    const children =
      typeof componentProps.children === 'string'
        ? componentProps.children
        : componentProps.children

    return `<${selectedComponent}${propsString ? ` ${propsString}` : ''}>${children || ''}</${selectedComponent}>`
  }

  const copyToClipboard = async () => {
    const code = generateCode()
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const config = componentConfigs[selectedComponent]

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <h1 className="text-xl font-bold">Component Playground</h1>
          <Button variant="ghost" size="icon" onClick={toggleTheme}>
            {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          </Button>
        </div>
      </header>

      <div className="container mx-auto p-6">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Controls Panel */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Component</CardTitle>
                <CardDescription>Select a component to customize</CardDescription>
              </CardHeader>
              <CardContent>
                <Select
                  value={selectedComponent}
                  onValueChange={(value) => {
                    setSelectedComponent(value as 'Button' | 'Badge')
                    setComponentProps(
                      componentConfigs[value as 'Button' | 'Badge'].defaultProps
                    )
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Button">Button</SelectItem>
                    <SelectItem value="Badge">Badge</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Props</CardTitle>
                <CardDescription>Customize component properties</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(config.props).map(([prop, options]) => {
                  if (Array.isArray(options) && options.length === 2 && options.every((v) => typeof v === 'boolean')) {
                    // Boolean prop
                    return (
                      <div key={prop} className="flex items-center justify-between">
                        <Label htmlFor={prop} className="capitalize">
                          {prop}
                        </Label>
                        <Switch
                          id={prop}
                          checked={componentProps[prop] as boolean}
                          onCheckedChange={(checked) => handlePropChange(prop, checked)}
                        />
                      </div>
                    )
                  }

                  if (Array.isArray(options)) {
                    // Select prop
                    return (
                      <div key={prop} className="space-y-2">
                        <Label htmlFor={prop} className="capitalize">
                          {prop}
                        </Label>
                        <Select
                          value={String(componentProps[prop] || '')}
                          onValueChange={(value) => handlePropChange(prop, value)}
                        >
                          <SelectTrigger id={prop}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {options.map((option) => (
                              <SelectItem key={String(option)} value={String(option)}>
                                {String(option)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )
                  }

                  return null
                })}

                {/* Children prop for text content */}
                {selectedComponent !== 'Badge' && (
                  <div className="space-y-2">
                    <Label htmlFor="children">Text</Label>
                    <Input
                      id="children"
                      value={String(componentProps.children || '')}
                      onChange={(e) => handlePropChange('children', e.target.value)}
                      placeholder="Button text"
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Generated Code</CardTitle>
                <CardDescription>Copy the code snippet to use in your project</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm">
                    <code>{generateCode()}</code>
                  </pre>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-2"
                    onClick={copyToClipboard}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Preview Panel */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Preview</CardTitle>
                <CardDescription>See your changes in real-time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex min-h-[200px] items-center justify-center rounded-lg border-2 border-dashed bg-muted/50 p-8">
                  {selectedComponent === 'Button' && (
                    <Button
                      variant={componentProps.variant as any}
                      size={componentProps.size as any}
                      disabled={componentProps.disabled as boolean}
                    >
                      {componentProps.children as string}
                    </Button>
                  )}
                  {selectedComponent === 'Badge' && (
                    <Badge variant={componentProps.variant as any}>
                      {componentProps.children as string}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Props Summary</CardTitle>
                <CardDescription>Current component configuration</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(componentProps).map(([key, value]) => (
                    <div key={key} className="flex justify-between text-sm">
                      <span className="font-medium capitalize">{key}:</span>
                      <span className="text-muted-foreground">
                        {typeof value === 'boolean' ? String(value) : String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

