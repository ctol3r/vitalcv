'use client'

/**
 * QR Code Block Component
 *
 * Displays a QR code for credential offers with accessibility support.
 */

import { QRCodeSVG } from 'qrcode.react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface QrBlockProps {
  data: string
  title?: string
  description?: string
  size?: number
  loading?: boolean
  onDownload?: () => void
  ariaLabel?: string
}

export function QrBlock({
  data,
  title = 'Scan QR Code',
  description = 'Scan this code with your wallet app to receive the credential',
  size = 256,
  loading = false,
  onDownload,
  ariaLabel = 'QR code for credential offer',
}: QrBlockProps) {
  const handleDownload = () => {
    if (onDownload) {
      onDownload()
      return
    }

    // Default download implementation
    const svg = document.querySelector('#qr-code-svg') as SVGElement
    if (!svg) return

    const svgData = new XMLSerializer().serializeToString(svg)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()

    canvas.width = size
    canvas.height = size

    img.onload = () => {
      ctx?.drawImage(img, 0, 0)
      const pngFile = canvas.toDataURL('image/png')

      const downloadLink = document.createElement('a')
      downloadLink.download = 'vitalcv-credential-offer.png'
      downloadLink.href = pngFile
      downloadLink.click()
    }

    img.src = `data:image/svg+xml;base64,${btoa(svgData)}`
  }

  if (loading) {
    return (
      <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
        <CardHeader className="text-center">
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-4">
          <Skeleton className="w-64 h-64 rounded-lg" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
      <CardHeader className="text-center">
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-col items-center space-y-4">
        <div
          className="p-4 bg-white rounded-lg border-2 border-gray-200"
          role="img"
          aria-label={ariaLabel}
        >
          <QRCodeSVG
            id="qr-code-svg"
            value={data}
            size={size}
            level="M"
            includeMargin={false}
            aria-hidden="true"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownload}
          className="gap-2"
          aria-label="Download QR code as image"
        >
          <Download className="h-4 w-4" />
          Download QR Code
        </Button>
        <p className="text-xs text-muted-foreground text-center max-w-xs">
          Keep this QR code secure. Anyone with access can claim the credential.
        </p>
      </CardContent>
    </Card>
  )
}
