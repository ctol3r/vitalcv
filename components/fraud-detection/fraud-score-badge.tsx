/**
 * Fraud Score Badge Component
 *
 * Visual indicator for fraud detection score
 */

import { cn } from '@/lib/utils'
import { AlertTriangle, Shield, ShieldAlert, ShieldX } from 'lucide-react'

interface FraudScoreBadgeProps {
  score: number // 0-1
  risk: 'low' | 'medium' | 'high' | 'critical'
  className?: string
  showScore?: boolean
  showIcon?: boolean
}

export function FraudScoreBadge({
  score,
  risk,
  className,
  showScore = true,
  showIcon = true,
}: FraudScoreBadgeProps) {
  // Get color and icon based on risk level
  const config = {
    low: {
      color: 'bg-green-100 text-green-800 border-green-200',
      icon: Shield,
      label: 'Low Risk',
    },
    medium: {
      color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      icon: AlertTriangle,
      label: 'Medium Risk',
    },
    high: {
      color: 'bg-orange-100 text-orange-800 border-orange-200',
      icon: ShieldAlert,
      label: 'High Risk',
    },
    critical: {
      color: 'bg-red-100 text-red-800 border-red-200',
      icon: ShieldX,
      label: 'Critical Risk',
    },
  }

  const { color, icon: Icon, label } = config[risk]

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium',
        color,
        className
      )}
    >
      {showIcon && <Icon className="w-4 h-4" />}
      <span>{label}</span>
      {showScore && (
        <span className="ml-1 opacity-70">
          ({Math.round(score * 100)}%)
        </span>
      )}
    </div>
  )
}
