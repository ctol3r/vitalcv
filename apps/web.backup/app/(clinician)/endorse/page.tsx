"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Search, Star, User } from "lucide-react"

export default function EndorsePage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [selectedClinician, setSelectedClinician] = useState<any>(null)
  const [endorsementType, setEndorsementType] = useState("skill")
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()

  const handleSearch = async () => {
    if (!searchQuery) return
    try {
       // Mock search or real API
       // Using /directory or /api/npi/lookup if available
       // For now, mock a result to allow UI testing
       // In production, replace with: const res = await fetch(`/api/npi/lookup?npi=${searchQuery}`)

       // Simulating API call
       await new Promise(resolve => setTimeout(resolve, 500));

       // Simple mock logic
       if (searchQuery.length >= 3) {
            setSearchResults([{
                npi: searchQuery,
                name: "Dr. Mock Clinician",
                specialty: "General Practice"
            }])
       } else {
            setSearchResults([])
            toast({ title: "No clinician found", description: "Try searching for a longer NPI or name", variant: "destructive" })
       }

    } catch (error) {
        console.error(error)
        toast({ title: "Search failed", variant: "destructive" })
    }
  }

  const handleSubmit = async () => {
    if (!selectedClinician) return
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/peer/attest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectId: selectedClinician.npi, // Using NPI as ID for now
          attesterId: "current-user-id", // Should get from session/context
          endorsement: endorsementType,
          rating,
          comment
        })
      })

      if (!res.ok) throw new Error('Failed to submit')

      toast({
        title: "Endorsement Submitted",
        description: "Your peer attestation has been recorded on chain."
      })

      // Reset form
      setSelectedClinician(null)
      setComment("")
      setRating(5)
      setSearchResults([])
      setSearchQuery("")
    } catch (error) {
      console.error(error)
      toast({
        title: "Error",
        description: "Failed to submit endorsement",
        variant: "destructive"
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="container mx-auto py-10 px-4 max-w-3xl">
      <h1 className="text-3xl font-bold mb-8">Peer Endorsement</h1>

      <Card className="mb-8">
        <CardHeader>
            <CardTitle>Find a Clinician</CardTitle>
            <CardDescription>Search by NPI to endorse a colleague</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="flex gap-4">
                <Input
                    placeholder="Enter NPI number..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button onClick={handleSearch}>
                    <Search className="w-4 h-4 mr-2" />
                    Search
                </Button>
            </div>

            {searchResults.length > 0 && (
                <div className="mt-4 space-y-2">
                    {searchResults.map(clinician => (
                        <div
                            key={clinician.npi}
                            className={`p-4 border rounded-lg cursor-pointer hover:bg-slate-50 transition-colors ${selectedClinician?.npi === clinician.npi ? 'border-blue-500 bg-blue-50' : ''}`}
                            onClick={() => setSelectedClinician(clinician)}
                        >
                            <div className="font-semibold">{clinician.name}</div>
                            <div className="text-sm text-slate-500">{clinician.specialty} • NPI: {clinician.npi}</div>
                        </div>
                    ))}
                </div>
            )}
        </CardContent>
      </Card>

      {selectedClinician && (
        <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CardHeader>
                <CardTitle>Give Endorsement</CardTitle>
                <CardDescription>Endorsing {selectedClinician.name}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <Label>Endorsement Type</Label>
                    <Select value={endorsementType} onValueChange={setEndorsementType}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="skill">Clinical Skill</SelectItem>
                            <SelectItem value="experience">Experience</SelectItem>
                            <SelectItem value="professionalism">Professionalism</SelectItem>
                            <SelectItem value="mentorship">Mentorship</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label>Rating</Label>
                    <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <button
                                key={star}
                                onClick={() => setRating(star)}
                                className={`p-1 hover:scale-110 transition-transform ${star <= rating ? 'text-yellow-500' : 'text-slate-300'}`}
                                type="button"
                            >
                                <Star className="w-8 h-8 fill-current" />
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-2">
                    <Label>Comment (Optional)</Label>
                    <Textarea
                        placeholder="Share your experience working with this clinician..."
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                    />
                </div>

                <Button className="w-full" onClick={handleSubmit} disabled={isSubmitting}>
                    {isSubmitting ? 'Submitting...' : 'Submit Endorsement'}
                </Button>
            </CardContent>
        </Card>
      )}
    </div>
  )
}














