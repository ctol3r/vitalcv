"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { BookOpen, Loader2 } from "lucide-react";

interface ClaimPublicationDialogProps {
  onClaimed?: () => void;
}

export default function ClaimPublicationDialog({ onClaimed }: ClaimPublicationDialogProps) {
  const [open, setOpen] = useState(false);
  const [pmid, setPmid] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleClaim = async () => {
    if (!pmid || !authorName) {
      toast({
        title: "Missing Information",
        description: "Please provide both PMID and author name",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/publications/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pmid, authorName }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to claim publication");
      }

      toast({
        title: "Publication Claimed",
        description: `Provenance ID: ${data.provenanceId}`,
      });

      setPmid("");
      setAuthorName("");
      setOpen(false);
      onClaimed?.();
    } catch (err: any) {
      toast({
        title: "Claim Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <BookOpen className="h-4 w-4 mr-2" />
          Claim Publication
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Claim Publication</DialogTitle>
          <DialogDescription>
            Claim authorship of a publication via PubMed ID (PMID). Provenance will be verified and attached to
            your profile.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="pmid">PubMed ID (PMID)</Label>
            <Input
              id="pmid"
              placeholder="e.g. 12345678"
              value={pmid}
              onChange={(e) => setPmid(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="authorName">Your Name (as appears in publication)</Label>
            <Input
              id="authorName"
              placeholder="e.g. Johnson SL"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              disabled={loading}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" onClick={handleClaim} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Claim Publication
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

