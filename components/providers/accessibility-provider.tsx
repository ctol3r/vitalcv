/**
 * Accessibility Provider
 *
 * Runtime accessibility monitoring using @axe-core/react
 * Automatically detects and reports accessibility violations in development
 */

'use client'

import React, { useEffect } from 'react'

interface AccessibilityProviderProps {
  children: React.ReactNode
  /**
   * Enable/disable runtime accessibility monitoring
   * Default: enabled in development, disabled in production
   */
  enabled?: boolean
}

/**
 * Provider that enables runtime accessibility monitoring
 *
 * @example
 * // In app/layout.tsx
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         <AccessibilityProvider>
 *           {children}
 *         </AccessibilityProvider>
 *       </body>
 *     </html>
 *   )
 * }
 */
export function AccessibilityProvider({
  children,
  enabled = process.env.NODE_ENV === 'development',
}: AccessibilityProviderProps) {
  useEffect(() => {
    if (!enabled) return

    // Only load axe-core in development
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      import('@axe-core/react').then((axe) => {
        axe.default(React, React.createElement, 1000, {
          // axe-core configuration
          rules: [
            {
              // WCAG 2.1 AA compliance
              id: 'color-contrast',
              enabled: true,
            },
          ],
        })
      }).catch((error) => {
        console.error('Failed to load @axe-core/react:', error)
      })
    }
  }, [enabled])

  return <>{children}</>
}

/**
 * Hook to manually trigger accessibility audit
 *
 * @example
 * function MyComponent() {
 *   const { runAccessibilityAudit } = useAccessibilityAudit()
 *
 *   const handleClick = async () => {
 *     const results = await runAccessibilityAudit()
 *     console.log('Violations:', results.violations)
 *   }
 *
 *   return <button onClick={handleClick}>Run Audit</button>
 * }
 */
export function useAccessibilityAudit() {
  const runAccessibilityAudit = async () => {
    if (typeof window === 'undefined') {
      throw new Error('useAccessibilityAudit can only be used in the browser')
    }

    try {
      const axe = await import('axe-core')
      const results = await axe.default.run(document.body, {
        // WCAG 2.1 AA compliance
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
        },
      })
      return results
    } catch (error) {
      console.error('Failed to run accessibility audit:', error)
      throw error
    }
  }

  return { runAccessibilityAudit }
}

/**
 * Component for displaying accessibility violations in development
 */
export function AccessibilityMonitor() {
  const { runAccessibilityAudit } = useAccessibilityAudit()
  const [violations, setViolations] = React.useState<any[]>([])
  const [isOpen, setIsOpen] = React.useState(false)

  // Only render in development
  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  const handleRunAudit = async () => {
    const results = await runAccessibilityAudit()
    setViolations(results.violations)
    setIsOpen(true)
  }

  return (
    <>
      {/* Floating button to trigger audit */}
      <button
        onClick={handleRunAudit}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 9999,
          backgroundColor: '#6366f1',
          color: 'white',
          border: 'none',
          borderRadius: '50%',
          width: '60px',
          height: '60px',
          fontSize: '24px',
          cursor: 'pointer',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        }}
        title="Run Accessibility Audit"
        aria-label="Run accessibility audit"
      >
        ♿
      </button>

      {/* Results panel */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            top: '0',
            right: '0',
            width: '400px',
            height: '100vh',
            backgroundColor: 'white',
            boxShadow: '-2px 0 8px rgba(0, 0, 0, 0.1)',
            zIndex: 10000,
            overflowY: 'auto',
            padding: '20px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h2 style={{ margin: 0 }}>Accessibility Violations</h2>
            <button
              onClick={() => setIsOpen(false)}
              style={{ border: 'none', background: 'none', fontSize: '24px', cursor: 'pointer' }}
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {violations.length === 0 ? (
            <p style={{ color: '#10b981' }}>✓ No violations found!</p>
          ) : (
            <div>
              <p style={{ color: '#ef4444' }}>Found {violations.length} violations</p>
              {violations.map((violation, index) => (
                <div
                  key={index}
                  style={{
                    marginBottom: '20px',
                    padding: '15px',
                    border: '1px solid #ef4444',
                    borderRadius: '4px',
                  }}
                >
                  <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>
                    {violation.help}
                  </h3>
                  <p style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#666' }}>
                    {violation.description}
                  </p>
                  <p style={{ margin: 0, fontSize: '12px' }}>
                    <strong>Impact:</strong> {violation.impact}
                  </p>
                  <p style={{ margin: '5px 0', fontSize: '12px' }}>
                    <strong>Elements:</strong> {violation.nodes.length}
                  </p>
                  <details style={{ marginTop: '10px' }}>
                    <summary style={{ cursor: 'pointer', fontSize: '12px' }}>
                      Show details
                    </summary>
                    {violation.nodes.map((node: any, nodeIndex: number) => (
                      <div key={nodeIndex} style={{ marginTop: '10px', fontSize: '12px' }}>
                        <code style={{ display: 'block', padding: '5px', backgroundColor: '#f3f4f6' }}>
                          {node.html}
                        </code>
                      </div>
                    ))}
                  </details>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}
