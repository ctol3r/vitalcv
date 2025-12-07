import { SpeedInsights } from "@vercel/speed-insights/next"

export default function SpeedInsightsPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Speed Insights</h1>
      <p className="mb-4">Real User Monitoring (RUM) is active.</p>
      <SpeedInsights />
    </div>
  )
}















