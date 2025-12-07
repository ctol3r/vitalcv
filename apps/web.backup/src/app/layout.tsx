import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { I18nProvider } from './i18n-provider'
import { ChatPanel } from '../components/assistant/ChatPanel'
import { OptimizationBanner } from '../components/autonomy/OptimizationBanner'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Chai VC Platform - Organization Settings',
  description: 'Healthcare credentialing and governance platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <I18nProvider>
          <OptimizationBanner />
          {children}
          <ChatPanel />
        </I18nProvider>
      </body>
    </html>
  )
}

