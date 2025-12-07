"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Download, Share2, QrCode, Copy, ExternalLink } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface QuickActionsCardProps {
  npi: string
  onDownloadPDF: () => Promise<void>
  onShareProfile: () => Promise<void>
}

export function QuickActionsCard({ npi, onDownloadPDF, onShareProfile }: QuickActionsCardProps) {
  const [qrDialogOpen, setQrDialogOpen] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const { toast } = useToast()

  const handleAction = async (action: string, callback: () => Promise<void>) => {
    setLoading(action)
    try {
      await callback()
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to ${action.toLowerCase()}`,
        variant: "destructive",
      })
    } finally {
      setLoading(null)
    }
  }

  const handleCopyProfileLink = async () => {
    try {
      const shareUrl = `${window.location.origin}/profile/${npi}`
      await navigator.clipboard.writeText(shareUrl)
      toast({
        title: "Link Copied",
        description: "Profile link copied to clipboard",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy profile link",
        variant: "destructive",
      })
    }
  }

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-200">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <Button
            onClick={() => handleAction("download", onDownloadPDF)}
            disabled={loading === "download"}
            variant="outline"
            className="w-full justify-start bg-white/80 hover:bg-white border-gray-200 hover:border-gray-300 transition-all duration-200"
          >
            <Download className={`h-4 w-4 mr-3 ${loading === "download" ? "animate-pulse" : ""}`} />
            {loading === "download" ? "Generating PDF..." : "Download PDF Report"}
          </Button>

          <Button
            onClick={() => handleAction("share", onShareProfile)}
            disabled={loading === "share"}
            variant="outline"
            className="w-full justify-start bg-white/80 hover:bg-white border-gray-200 hover:border-gray-300 transition-all duration-200"
          >
            <Share2 className={`h-4 w-4 mr-3 ${loading === "share" ? "animate-pulse" : ""}`} />
            {loading === "share" ? "Copying Link..." : "Share Profile Link"}
          </Button>

          <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start bg-white/80 hover:bg-white border-gray-200 hover:border-gray-300 transition-all duration-200"
              >
                <QrCode className="h-4 w-4 mr-3" />
                Generate QR Code
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <QrCode className="h-5 w-5 text-blue-600" />
                  Profile QR Code
                </DialogTitle>
                <DialogDescription>Share your verified profile with this QR code</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col items-center space-y-4">
                <div className="h-48 w-48 bg-white border-2 border-gray-200 rounded-lg flex items-center justify-center shadow-sm">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                      `${window.location.origin}/profile/${npi}`,
                    )}`}
                    alt="Profile QR Code"
                    className="h-44 w-44 rounded"
                  />
                </div>
                <div className="flex gap-2 w-full">
                  <Button onClick={handleCopyProfileLink} className="flex-1 bg-blue-600 hover:bg-blue-700">
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Link
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => window.open(`${window.location.origin}/profile/${npi}`, "_blank")}
                    className="flex-1"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Profile
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  )
}
