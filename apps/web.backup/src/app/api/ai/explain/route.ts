import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { subjectType, subjectId, context } = body

    // TODO: In production, proxy to backend AI service
    // const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001'
    // const response = await fetch(`${backendUrl}/api/ai/explain`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ subjectType, subjectId, context }),
    // })
    // if (!response.ok) throw new Error('Backend error')
    // const data = await response.json()
    // return NextResponse.json(data)

    // Mock explanation for demo
    const explanation = generateMockExplanation(context)

    return NextResponse.json({
      ok: true,
      model: 'local-stub-v0',
      explanation,
    })
  } catch (error) {
    console.warn('[API] ai explain falling back to mock data', error)
    return NextResponse.json(
      {
        ok: true,
        model: 'local-stub-v0',
        explanation: 'Explanation generation failed. Please try again later.',
      },
      { headers: { 'x-demo-data': 'true' } },
    )
  }
}

function generateMockExplanation(context: any): string {
  if (!context || !context.features) {
    return 'Explanation is being generated based on the provided context.'
  }

  const { predictedRisk, horizon, features, privilegeName } = context

  const horizonLabel = horizon === '7d' ? '7 days' : horizon === '14d' ? '14 days' : horizon === '30d' ? '30 days' : '60 days'

  // Sort features by absolute contribution
  const sortedFeatures = [...features].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))

  const increasing = sortedFeatures.filter((f) => f.contribution > 0)
  const decreasing = sortedFeatures.filter((f) => f.contribution < 0)

  let text = `The predicted risk of ${Math.round(predictedRisk)}% for ${privilegeName || 'this privilege'} over the next ${horizonLabel} is primarily driven by the following factors:\n\n`

  if (increasing.length > 0) {
    text += `**Factors increasing risk:**\n`
    increasing.slice(0, 3).forEach((feature, idx) => {
      const percentage = Math.round(Math.abs(feature.contribution) * 100)
      const featureName = (feature as any).name || (feature as any).feature || 'Unknown feature'
      text += `${idx + 1}. **${featureName}** (contributes +${percentage}%): This feature significantly increases the predicted risk.`
      if ((feature as any).evidence && (feature as any).evidence.length > 0) {
        text += ` Evidence includes: ${(feature as any).evidence.slice(0, 2).join(', ')}.`
      }
      text += `\n`
    })
    text += `\n`
  }

  if (decreasing.length > 0) {
    text += `**Factors reducing risk:**\n`
    decreasing.slice(0, 2).forEach((feature, idx) => {
      const percentage = Math.round(Math.abs(feature.contribution) * 100)
      const featureName = (feature as any).name || (feature as any).feature || 'Unknown feature'
      text += `${idx + 1}. **${featureName}** (contributes -${percentage}%): This feature helps mitigate risk.`
      if ((feature as any).evidence && (feature as any).evidence.length > 0) {
        text += ` Evidence includes: ${(feature as any).evidence.slice(0, 2).join(', ')}.`
      }
      text += `\n`
    })
  }

  const topIncreasingName = (increasing[0] as any)?.name || (increasing[0] as any)?.feature || 'the primary drivers'
  text += `\n**Recommendation:** Monitor the key risk-increasing factors closely, particularly ${topIncreasingName}. Consider taking proactive remediation steps to address these factors before the predicted risk threshold is crossed.`

  return text
}

