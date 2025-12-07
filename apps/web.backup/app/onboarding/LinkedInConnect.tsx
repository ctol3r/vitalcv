"use client";

import { Button } from "@/components/ui/button";
import { Linkedin } from "lucide-react";

export default function LinkedInConnect() {
  const handleConnect = () => {
    // Redirect to backend OAuth endpoint
    window.location.href = "/auth/linkedin";
  };

  return (
    <Button onClick={handleConnect} className="px-4 py-2 rounded bg-[#0A66C2] text-white hover:bg-[#004182]">
      <Linkedin className="h-4 w-4 mr-2" />
      Connect LinkedIn
    </Button>
  );
}

