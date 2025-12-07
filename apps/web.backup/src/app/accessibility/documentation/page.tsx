'use client'

import * as React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { HighContrastToggle } from '@/components/accessibility/HighContrastToggle'
import { TextSizeAdjuster } from '@/components/accessibility/TextSizeAdjuster'
import { AccessibleAccordion } from '@/components/accessibility/AccessibleAccordion'
import { AccessibleDataTable } from '@/components/accessibility/AccessibleDataTable'
import { AccessibleModal } from '@/components/accessibility/AccessibleModal'
import { AccessibleTooltip } from '@/components/accessibility/AccessibleTooltip'
import { AccessibleDropdown } from '@/components/accessibility/AccessibleDropdown'
import { SkipToContentLink } from '@/components/accessibility/SkipToContentLink'
import { Button } from '@/components/ui/button'
import { BookOpen, Keyboard, Eye, Users, CheckCircle2, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default function AccessibilityDocumentationPage() {
  const [modalOpen, setModalOpen] = React.useState(false)
  const [selectedOption, setSelectedOption] = React.useState<string>('')

  const dropdownOptions = [
    { value: 'option1', label: 'Option 1' },
    { value: 'option2', label: 'Option 2' },
    { value: 'option3', label: 'Option 3', disabled: true },
    { value: 'option4', label: 'Option 4' },
  ]

  const accordionItems = [
    {
      id: 'preferences',
      header: 'Accessibility Preferences',
      content: (
        <div className="space-y-4">
          <HighContrastToggle />
          <TextSizeAdjuster />
        </div>
      ),
    },
    {
      id: 'keyboard',
      header: 'Keyboard Navigation',
      content: (
        <div className="space-y-2">
          <p>Use the following keyboard shortcuts:</p>
          <ul className="list-disc list-inside space-y-1">
            <li><kbd className="px-2 py-1 bg-muted rounded">Tab</kbd> - Navigate between elements</li>
            <li><kbd className="px-2 py-1 bg-muted rounded">Enter</kbd> - Activate buttons and links</li>
            <li><kbd className="px-2 py-1 bg-muted rounded">Esc</kbd> - Close modals and dialogs</li>
            <li><kbd className="px-2 py-1 bg-muted rounded">Arrow Keys</kbd> - Navigate within components</li>
          </ul>
        </div>
      ),
    },
    {
      id: 'screen-readers',
      header: 'Screen Reader Support',
      content: (
        <div className="space-y-2">
          <p>VitalCV is fully compatible with screen readers including:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>NVDA (Windows)</li>
            <li>JAWS (Windows)</li>
            <li>VoiceOver (macOS/iOS)</li>
            <li>TalkBack (Android)</li>
          </ul>
        </div>
      ),
    },
  ]

  const tableData = [
    { id: '1', name: 'John Doe', role: 'Clinician', status: 'Active' },
    { id: '2', name: 'Jane Smith', role: 'Administrator', status: 'Active' },
    { id: '3', name: 'Bob Johnson', role: 'Clinician', status: 'Inactive' },
  ]

  const tableColumns = [
    {
      id: 'name',
      header: 'Name',
      accessor: (row: typeof tableData[0]) => row.name,
      sortable: true,
    },
    {
      id: 'role',
      header: 'Role',
      accessor: (row: typeof tableData[0]) => row.role,
      sortable: true,
    },
    {
      id: 'status',
      header: 'Status',
      accessor: (row: typeof tableData[0]) => row.status,
      sortable: true,
    },
  ]

  return (
    <div className="container mx-auto px-6 py-12 max-w-5xl">
      <SkipToContentLink targetId="main-content" />

      <main id="main-content">
        <div className="space-y-8">
          {/* Header */}
          <div className="space-y-4">
            <h1 className="text-4xl font-bold">Accessibility Documentation</h1>
            <p className="text-lg text-muted-foreground">
              Comprehensive guide to using accessibility features in VitalCV. Learn about preference
              settings, guidelines for authors, inclusive language, and available components.
            </p>
          </div>

          {/* Quick Access */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Keyboard className="h-5 w-5 text-primary" />
                  <CardTitle>Keyboard Navigation</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  All features are fully keyboard accessible
                </p>
                <Button variant="outline" size="sm" asChild>
                  <Link href="#keyboard-shortcuts">Learn More</Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Eye className="h-5 w-5 text-primary" />
                  <CardTitle>Visual Preferences</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Customize contrast and text size
                </p>
                <Button variant="outline" size="sm" asChild>
                  <Link href="#preferences">Learn More</Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  <CardTitle>Screen Readers</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Full support for assistive technologies
                </p>
                <Button variant="outline" size="sm" asChild>
                  <Link href="#screen-readers">Learn More</Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Preference Settings */}
          <section id="preferences" className="space-y-4">
            <h2 className="text-2xl font-semibold">Preference Settings</h2>
            <Card>
              <CardHeader>
                <CardTitle>Accessibility Preferences</CardTitle>
                <CardDescription>
                  Customize your experience to match your needs
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-2">High Contrast Mode</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Enable high contrast mode to increase the contrast between text and backgrounds
                    for better visibility.
                  </p>
                  <HighContrastToggle />
                </div>
                <div>
                  <h3 className="text-lg font-medium mb-2">Text Size</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Adjust the text size to make content more readable. Changes apply to the entire
                    application.
                  </p>
                  <TextSizeAdjuster />
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Guidelines for Authors */}
          <section id="guidelines" className="space-y-4">
            <h2 className="text-2xl font-semibold">Guidelines for Authors</h2>
            <Card>
              <CardHeader>
                <CardTitle>Creating Accessible Content</CardTitle>
                <CardDescription>
                  Best practices for creating inclusive content in VitalCV
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-medium mb-2">Inclusive Language</h3>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    <li>Use person-first language (e.g., "person with a disability" not "disabled person")</li>
                    <li>Avoid ableist language and assumptions</li>
                    <li>Use clear, simple language when possible</li>
                    <li>Provide alternative text for images and graphics</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-medium mb-2">Content Structure</h3>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    <li>Use proper heading hierarchy (h1, h2, h3, etc.)</li>
                    <li>Provide descriptive link text (avoid "click here")</li>
                    <li>Use lists for related items</li>
                    <li>Break up long paragraphs</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Available Components */}
          <section id="components" className="space-y-4">
            <h2 className="text-2xl font-semibold">Available Components</h2>

            {/* Accordion Example */}
            <Card>
              <CardHeader>
                <CardTitle>Accessible Accordion</CardTitle>
                <CardDescription>
                  Collapsible content sections with keyboard navigation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AccessibleAccordion items={accordionItems} />
              </CardContent>
            </Card>

            {/* Data Table Example */}
            <Card>
              <CardHeader>
                <CardTitle>Accessible Data Table</CardTitle>
                <CardDescription>
                  Sortable table with keyboard navigation and screen reader support
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AccessibleDataTable
                  data={tableData}
                  columns={tableColumns}
                  caption="Example user data table"
                  filterable
                />
              </CardContent>
            </Card>

            {/* Modal Example */}
            <Card>
              <CardHeader>
                <CardTitle>Accessible Modal</CardTitle>
                <CardDescription>
                  Dialog with focus trap and keyboard support
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button onClick={() => setModalOpen(true)}>
                  Open Accessible Modal
                </Button>
                <AccessibleModal
                  open={modalOpen}
                  onOpenChange={setModalOpen}
                  title="Example Modal"
                  description="This is an example of an accessible modal dialog."
                >
                  <p>Modal content goes here. Press ESC to close or click outside.</p>
                </AccessibleModal>
              </CardContent>
            </Card>

            {/* Tooltip Example */}
            <Card>
              <CardHeader>
                <CardTitle>Accessible Tooltip</CardTitle>
                <CardDescription>
                  Contextual information on hover and focus
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <AccessibleTooltip content="This is an accessible tooltip">
                    <Button variant="outline">Hover or Focus Me</Button>
                  </AccessibleTooltip>
                </div>
              </CardContent>
            </Card>

            {/* Dropdown Example */}
            <Card>
              <CardHeader>
                <CardTitle>Accessible Dropdown</CardTitle>
                <CardDescription>
                  Custom dropdown with keyboard navigation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AccessibleDropdown
                  options={dropdownOptions}
                  value={selectedOption}
                  onChange={setSelectedOption}
                  label="Select an option"
                  placeholder="Choose..."
                />
              </CardContent>
            </Card>
          </section>

          {/* Keyboard Shortcuts */}
          <section id="keyboard-shortcuts" className="space-y-4">
            <h2 className="text-2xl font-semibold">Keyboard Shortcuts</h2>
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-medium mb-2">Navigation</h3>
                    <ul className="space-y-1 text-sm">
                      <li className="flex justify-between">
                        <span>Navigate forward</span>
                        <kbd className="px-2 py-1 bg-muted rounded">Tab</kbd>
                      </li>
                      <li className="flex justify-between">
                        <span>Navigate backward</span>
                        <kbd className="px-2 py-1 bg-muted rounded">Shift + Tab</kbd>
                      </li>
                      <li className="flex justify-between">
                        <span>Activate</span>
                        <kbd className="px-2 py-1 bg-muted rounded">Enter</kbd>
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">Modals & Dialogs</h3>
                    <ul className="space-y-1 text-sm">
                      <li className="flex justify-between">
                        <span>Close modal</span>
                        <kbd className="px-2 py-1 bg-muted rounded">Esc</kbd>
                      </li>
                      <li className="flex justify-between">
                        <span>Navigate options</span>
                        <kbd className="px-2 py-1 bg-muted rounded">Arrow Keys</kbd>
                      </li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Training Resources */}
          <section id="training" className="space-y-4">
            <h2 className="text-2xl font-semibold">Training Resources</h2>
            <Card>
              <CardHeader>
                <CardTitle>Learn More</CardTitle>
                <CardDescription>
                  Additional resources for accessibility best practices
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  <li>
                    <Link
                      href="https://www.w3.org/WAI/WCAG21/quickref/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-primary hover:underline"
                    >
                      <BookOpen className="h-4 w-4" />
                      WCAG 2.1 Guidelines
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="https://www.w3.org/WAI/ARIA/apg/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-primary hover:underline"
                    >
                      <BookOpen className="h-4 w-4" />
                      ARIA Authoring Practices Guide
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </section>
        </div>
      </main>
    </div>
  )
}

