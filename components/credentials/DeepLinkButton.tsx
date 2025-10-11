'use client'

/**
 * Deep Link Button Component
 *
 * Button for opening credential offers in mobile wallet apps
 * with copy-to-clipboard functionality.
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Copy, Check, ExternalLink, Smartphone } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'

export interface DeepLinkButtonProps {
  deepLink: string
  offerUrl: string
  label?: string
  description?: string
}

export function DeepLinkButton({
  deepLink,
  offerUrl,
  label = 'Open in Wallet',
  description = 'Use these links to open the offer in your mobile wallet or copy for later',
}: DeepLinkButtonProps) {
  const [copiedDeep, setCopiedDeep] = useState(false)
  const [copiedOffer, setCopiedOffer] = useState(false)
  const { toast } = useToast()

  const handleCopy = async (text: string, type: 'deep' | 'offer') => {
    try {
      await navigator.clipboard.writeText(text)

      if (type === 'deep') {
        setCopiedDeep(true)
        setTimeout(() => setCopiedDeep(false), 2000)
      } else {
        setCopiedOffer(true)
        setTimeout(() => setCopiedOffer(false), 2000)
      }

      toast({
        title: 'Copied!',
        description: `${type === 'deep' ? 'Deep link' : 'Offer URL'} copied to clipboard`,
      })
    } catch (err) {
      toast({
        title: 'Copy Failed',
        description: 'Failed to copy to clipboard. Please copy manually.',
        variant: 'destructive',
      })
    }
  }

  const handleOpenInWallet = () => {
    // Try to open the deep link
    window.location.href = deepLink

    // Show instructions toast
    toast({
      title: 'Opening Wallet...',
      description: 'If your wallet app doesn\'t open automatically, please copy the link and paste it manually.',
    })
  }

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5" />
          Mobile Wallet Link
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Primary action: Open in wallet */}
        <Button
          onClick={handleOpenInWallet}
          className="w-full gap-2"
          size="lg"
          aria-label="Open credential offer in mobile wallet"
        >
          <ExternalLink className="h-4 w-4" />
          {label}
        </Button>

        {/* Deep link with copy */}
        <div className="space-y-2">
          <Label htmlFor="deep-link" className="text-sm font-medium">
            Deep Link (Mobile Wallet)
          </Label>
          <div className="flex gap-2">
            <Input
              id="deep-link"
              type="text"
              value={deepLink}
              readOnly
              className="font-mono text-xs"
              aria-label="Deep link URL for mobile wallet"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleCopy(deepLink, 'deep')}
              aria-label="Copy deep link to clipboard"
            >
              {copiedDeep ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Offer URL with copy */}
        <div className="space-y-2">
          <Label htmlFor="offer-url" className="text-sm font-medium">
            Offer URL (Standard)
          </Label>
          <div className="flex gap-2">
            <Input
              id="offer-url"
              type="text"
              value={offerUrl}
              readOnly
              className="font-mono text-xs"
              aria-label="Standard credential offer URL"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleCopy(offerUrl, 'offer')}
              aria-label="Copy offer URL to clipboard"
            >
              {copiedOffer ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="pt-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-xs text-blue-900">
            <strong>Tip:</strong> Share this link securely with the credential holder via email or secure messaging.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
