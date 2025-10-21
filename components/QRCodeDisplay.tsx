"use client"

import { useEffect, useState, useMemo } from "react"
import { Skeleton } from "@/components/ui/skeleton"

interface QRCodeDisplayProps {
  data: string
  size?: number
  className?: string
  alt?: string
}

export function QRCodeDisplay({ data, size = 200, className = "", alt = "QR Code" }: QRCodeDisplayProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const qrUrl = useMemo(() => {
    if (!data) return null
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`
  }, [data, size])

  useEffect(() => {
    if (!qrUrl) return

    let cancelled = false

    const loadQRCode = async () => {
      try {
        const response = await fetch(qrUrl)
        if (cancelled) return

        if (!response.ok) {
          throw new Error("Failed to generate QR code")
        }

        const blob = await response.blob()
        if (cancelled) return

        const reader = new FileReader()
        reader.onloadend = () => {
          if (cancelled) return
          setQrDataUrl(reader.result as string)
          setError(null)
        }
        reader.onerror = () => {
          if (cancelled) return
          setError("Failed to load QR code")
        }
        reader.readAsDataURL(blob)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : "Failed to generate QR code")
      }
    }

    loadQRCode()

    return () => {
      cancelled = true
    }
  }, [qrUrl])

  if (error) {
    return (
      <div
        className={`flex items-center justify-center bg-red-50 border-2 border-red-200 rounded-lg ${className}`}
        style={{ width: size, height: size }}
      >
        <div className="text-center p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </div>
    )
  }

  if (!qrDataUrl) {
    return (
      <Skeleton
        className={`rounded-lg ${className}`}
        style={{ width: size, height: size }}
      />
    )
  }

  return (
    <div className={`${className}`} style={{ width: size, height: size }}>
      <img
        src={qrDataUrl}
        alt={alt}
        width={size}
        height={size}
        className="w-full h-full object-contain"
        style={{ imageRendering: "pixelated" }}
      />
    </div>
  )
}
