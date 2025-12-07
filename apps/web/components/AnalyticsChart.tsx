"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  ComposedChart,
} from "recharts"

interface ChartData {
  name: string
  value: number
  [key: string]: any // Allow additional properties for multi-series data
}

interface AnalyticsChartProps {
  title: string
  type: "line" | "pie" | "bar" | "composed"
  data: ChartData[]
  description?: string
  dataKeys?: string[] // For multi-series charts
  colors?: string[]
}

const DEFAULT_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4", "#84CC16"]

export function AnalyticsChart({
  title,
  type,
  data,
  description,
  dataKeys = ["value"],
  colors = DEFAULT_COLORS,
}: AnalyticsChartProps) {
  const renderChart = () => {
    switch (type) {
      case "line":
        return (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="name" className="text-xs" tick={{ fontSize: 12 }} />
            <YAxis className="text-xs" tick={{ fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(255, 255, 255, 0.95)",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                fontSize: "12px",
              }}
            />
            {dataKeys.map((key, index) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={colors[index % colors.length]}
                strokeWidth={2}
                dot={{ fill: colors[index % colors.length], strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: colors[index % colors.length], strokeWidth: 2 }}
              />
            ))}
          </LineChart>
        )

      case "bar":
        return (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="name" className="text-xs" tick={{ fontSize: 12 }} />
            <YAxis className="text-xs" tick={{ fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(255, 255, 255, 0.95)",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                fontSize: "12px",
              }}
            />
            {dataKeys.map((key, index) => (
              <Bar key={key} dataKey={key} fill={colors[index % colors.length]} radius={[2, 2, 0, 0]} />
            ))}
          </BarChart>
        )

      case "composed":
        return (
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="name" className="text-xs" tick={{ fontSize: 12 }} />
            <YAxis className="text-xs" tick={{ fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(255, 255, 255, 0.95)",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                fontSize: "12px",
              }}
            />
            {dataKeys.slice(0, 2).map((key, index) => (
              <Bar key={key} dataKey={key} fill={colors[index % colors.length]} radius={[2, 2, 0, 0]} />
            ))}
            {dataKeys.slice(2).map((key, index) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={colors[(index + 2) % colors.length]}
                strokeWidth={2}
                dot={{ fill: colors[(index + 2) % colors.length], strokeWidth: 2, r: 4 }}
              />
            ))}
          </ComposedChart>
        )

      case "pie":
        return (
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(255, 255, 255, 0.95)",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                fontSize: "12px",
              }}
            />
          </PieChart>
        )

      default:
        return null
    }
  }

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>
          {description || (type === "line" ? "Trend over time" : "Distribution breakdown")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
