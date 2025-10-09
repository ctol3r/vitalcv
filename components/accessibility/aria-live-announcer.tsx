/**
 * ARIA Live Announcer
 *
 * Screen reader announcements for dynamic content changes
 * Uses aria-live regions to announce messages without visual changes
 */

'use client'

import { useEffect, useState } from 'react'

/**
 * ARIA Live Announcer Component
 *
 * Add this to your root layout to enable screen reader announcements
 *
 * @example
 * // app/layout.tsx
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         {children}
 *         <AriaLiveAnnouncer />
 *       </body>
 *     </html>
 *   )
 * }
 */
export function AriaLiveAnnouncer() {
  return (
    <>
      {/* Polite announcer - announces when user is idle */}
      <div
        id="aria-live-announcer-polite"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />

      {/* Assertive announcer - announces immediately */}
      <div
        id="aria-live-announcer-assertive"
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      />
    </>
  )
}

/**
 * Hook to announce messages to screen readers
 *
 * @example
 * function SaveButton() {
 *   const announce = useAnnounce()
 *
 *   const handleSave = async () => {
 *     await saveData()
 *     announce('Changes saved successfully')
 *   }
 *
 *   return <button onClick={handleSave}>Save</button>
 * }
 */
export function useAnnounce() {
  return (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (typeof window === 'undefined') return

    const announcerId =
      priority === 'assertive'
        ? 'aria-live-announcer-assertive'
        : 'aria-live-announcer-polite'

    const announcer = document.getElementById(announcerId)
    if (announcer) {
      // Clear previous message
      announcer.textContent = ''

      // Set new message after a brief delay to ensure it's announced
      setTimeout(() => {
        announcer.textContent = message
      }, 100)
    }
  }
}

/**
 * Component for displaying and announcing messages
 *
 * @example
 * <AnnouncementRegion
 *   message="Form submitted successfully"
 *   type="success"
 *   visible={showMessage}
 * />
 */
export function AnnouncementRegion({
  message,
  type = 'polite',
  visible = true,
  className,
}: {
  message: string
  type?: 'polite' | 'assertive'
  visible?: boolean
  className?: string
}) {
  const [announcement, setAnnouncement] = useState('')

  useEffect(() => {
    if (message && visible) {
      setAnnouncement(message)
    }
  }, [message, visible])

  if (!visible) return null

  return (
    <div
      role={type === 'assertive' ? 'alert' : 'status'}
      aria-live={type}
      aria-atomic="true"
      className={className}
    >
      {announcement}
    </div>
  )
}
