"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity } from "lucide-react";

export default function SloMini() {
  const [data, setData] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/metrics");
        const t = await r.text();
        setData(t);
      } catch {
        setData("Error loading metrics");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <Card className="mt-6 bg-gray-50">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4" />
          <CardTitle className="text-sm">SLO Metrics</CardTitle>
        </div>
        <CardDescription className="text-xs">Observability snapshot (raw Prometheus)</CardDescription>
      </CardHeader>
      <CardContent>
        <pre className="text-[9px] bg-white p-3 rounded border overflow-auto max-h-60 font-mono">
          {loading ? "Loading..." : data || "No metrics available"}
        </pre>
      </CardContent>
    </Card>
  );
}

