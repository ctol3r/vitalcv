/**
 * B246C-DES-030: Design System Adoption Analytics
 *
 * Collects metrics on usage of design system components across apps.
 * Generates reports on adoption levels and integrates with ContentAnalytics service.
 */

import * as fs from 'fs'
import * as path from 'path'
// Note: Requires 'glob' package: npm install glob
// Alternative: Use Node.js built-in fs.readdirSync with recursion
import { glob } from 'glob'

export interface ComponentUsage {
  componentName: string
  importPath: string
  usageCount: number
  files: string[]
  variants?: Record<string, number>
}

export interface AdoptionMetrics {
  totalComponents: number
  componentsUsed: number
  adoptionRate: number
  mostUsedComponents: ComponentUsage[]
  leastUsedComponents: ComponentUsage[]
  unusedComponents: string[]
  usageByApp: Record<string, ComponentUsage[]>
}

export interface AdoptionReport {
  generatedAt: string
  metrics: AdoptionMetrics
  recommendations: string[]
}

/**
 * Scan codebase for component imports
 */
export function scanComponentImports(
  rootDir: string,
  componentPaths: string[]
): Map<string, ComponentUsage> {
  const usageMap = new Map<string, ComponentUsage>()

  // Find all TypeScript/JavaScript files
  const files = glob.sync('**/*.{ts,tsx,js,jsx}', {
    cwd: rootDir,
    ignore: ['**/node_modules/**', '**/dist/**', '**/.next/**'],
  })

  for (const file of files) {
    const filePath = path.join(rootDir, file)
    const content = fs.readFileSync(filePath, 'utf-8')

    // Check each component path
    for (const componentPath of componentPaths) {
      const componentName = path.basename(componentPath, path.extname(componentPath))

      // Match import statements
      const importRegex = new RegExp(
        `import\\s+(?:\\{[^}]*\\}|\\*\\s+as\\s+\\w+)\\s+from\\s+['"]${componentPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`,
        'g'
      )

      if (importRegex.test(content)) {
        if (!usageMap.has(componentName)) {
          usageMap.set(componentName, {
            componentName,
            importPath: componentPath,
            usageCount: 0,
            files: [],
            variants: {},
          })
        }

        const usage = usageMap.get(componentName)!
        usage.usageCount++
        usage.files.push(file)

        // Detect variant usage
        const variantRegex = new RegExp(
          `(?:variant|size|color)\\s*[:=]\\s*['"](\\w+)['"]`,
          'g'
        )
        let match
        while ((match = variantRegex.exec(content)) !== null) {
          const variant = match[1]
          if (!usage.variants) {
            usage.variants = {}
          }
          usage.variants[variant] = (usage.variants[variant] || 0) + 1
        }
      }
    }
  }

  return usageMap
}

/**
 * Get all available components from design system
 */
export function getAvailableComponents(componentsDir: string): string[] {
  const components: string[] = []

  if (!fs.existsSync(componentsDir)) {
    return components
  }

  const files = fs.readdirSync(componentsDir, { withFileTypes: true })

  for (const file of files) {
    if (file.isFile() && /\.(tsx|ts)$/.test(file.name)) {
      const componentName = path.basename(file.name, path.extname(file.name))
      // Skip index files and types
      if (componentName !== 'index' && !componentName.endsWith('.types')) {
        components.push(componentName)
      }
    }
  }

  return components
}

/**
 * Calculate adoption metrics
 */
export function calculateAdoptionMetrics(
  usageMap: Map<string, ComponentUsage>,
  availableComponents: string[],
  apps: string[] = []
): AdoptionMetrics {
  const componentsUsed = Array.from(usageMap.values())
  const unusedComponents = availableComponents.filter(
    (name) => !usageMap.has(name)
  )

  // Sort by usage count
  const sortedByUsage = [...componentsUsed].sort(
    (a, b) => b.usageCount - a.usageCount
  )

  const mostUsed = sortedByUsage.slice(0, 10)
  const leastUsed = sortedByUsage.slice(-10).reverse()

  // Group by app (if apps are specified)
  const usageByApp: Record<string, ComponentUsage[]> = {}
  if (apps.length > 0) {
    for (const app of apps) {
      usageByApp[app] = componentsUsed.filter((usage) =>
        usage.files.some((file) => file.includes(app))
      )
    }
  }

  const adoptionRate =
    availableComponents.length > 0
      ? (componentsUsed.length / availableComponents.length) * 100
      : 0

  return {
    totalComponents: availableComponents.length,
    componentsUsed: componentsUsed.length,
    adoptionRate: Math.round(adoptionRate * 100) / 100,
    mostUsedComponents: mostUsed,
    leastUsedComponents: leastUsed,
    unusedComponents,
    usageByApp,
  }
}

/**
 * Generate recommendations based on metrics
 */
export function generateRecommendations(metrics: AdoptionMetrics): string[] {
  const recommendations: string[] = []

  if (metrics.adoptionRate < 50) {
    recommendations.push(
      `Low adoption rate (${metrics.adoptionRate}%). Consider promoting design system usage through documentation and training.`
    )
  }

  if (metrics.unusedComponents.length > 0) {
    recommendations.push(
      `${metrics.unusedComponents.length} components are unused. Consider removing or documenting them.`
    )
  }

  if (metrics.mostUsedComponents.length > 0) {
    const topComponent = metrics.mostUsedComponents[0]
    recommendations.push(
      `Most used component: ${topComponent.componentName} (${topComponent.usageCount} usages). Consider optimizing or creating variants.`
    )
  }

  if (metrics.leastUsedComponents.length > 0) {
    const leastUsed = metrics.leastUsedComponents[0]
    if (leastUsed.usageCount === 1) {
      recommendations.push(
        `Component ${leastUsed.componentName} is only used once. Consider if it's needed or if it should be merged with another component.`
      )
    }
  }

  return recommendations
}

/**
 * Generate adoption report
 */
export function generateAdoptionReport(
  rootDir: string,
  componentsDir: string,
  componentPaths: string[],
  apps: string[] = []
): AdoptionReport {
  const usageMap = scanComponentImports(rootDir, componentPaths)
  const availableComponents = getAvailableComponents(componentsDir)
  const metrics = calculateAdoptionMetrics(usageMap, availableComponents, apps)
  const recommendations = generateRecommendations(metrics)

  return {
    generatedAt: new Date().toISOString(),
    metrics,
    recommendations,
  }
}

/**
 * Export report as JSON
 */
export function exportReportAsJson(
  report: AdoptionReport,
  outputPath: string
): void {
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2))
}

/**
 * Export report as Markdown
 */
export function exportReportAsMarkdown(
  report: AdoptionReport,
  outputPath: string
): void {
  const { metrics, recommendations } = report

  let markdown = `# Design System Adoption Report\n\n`
  markdown += `Generated at: ${report.generatedAt}\n\n`

  markdown += `## Overview\n\n`
  markdown += `- **Total Components**: ${metrics.totalComponents}\n`
  markdown += `- **Components Used**: ${metrics.componentsUsed}\n`
  markdown += `- **Adoption Rate**: ${metrics.adoptionRate}%\n\n`

  markdown += `## Most Used Components\n\n`
  for (const component of metrics.mostUsedComponents.slice(0, 10)) {
    markdown += `- **${component.componentName}**: ${component.usageCount} usages\n`
    if (component.variants) {
      const variantList = Object.entries(component.variants)
        .map(([name, count]) => `${name} (${count})`)
        .join(', ')
      markdown += `  - Variants: ${variantList}\n`
    }
  }

  markdown += `\n## Unused Components\n\n`
  if (metrics.unusedComponents.length > 0) {
    markdown += metrics.unusedComponents.map((c) => `- ${c}`).join('\n')
  } else {
    markdown += `All components are in use! 🎉\n`
  }

  if (Object.keys(metrics.usageByApp).length > 0) {
    markdown += `\n## Usage by App\n\n`
    for (const [app, components] of Object.entries(metrics.usageByApp)) {
      markdown += `### ${app}\n\n`
      markdown += `- Components used: ${components.length}\n`
      markdown += `- Total usages: ${components.reduce((sum, c) => sum + c.usageCount, 0)}\n\n`
    }
  }

  markdown += `\n## Recommendations\n\n`
  for (const recommendation of recommendations) {
    markdown += `- ${recommendation}\n`
  }

  fs.writeFileSync(outputPath, markdown)
}

/**
 * Integration with ContentAnalytics service
 */
export interface ContentAnalyticsIntegration {
  trackComponentUsage(componentName: string, context: Record<string, unknown>): void
  getUsageStats(componentName: string): Promise<Record<string, unknown>>
}

/**
 * Example integration function
 */
export function integrateWithContentAnalytics(
  analytics: ContentAnalyticsIntegration,
  usageMap: Map<string, ComponentUsage>
): void {
  for (const [componentName, usage] of usageMap.entries()) {
    analytics.trackComponentUsage(componentName, {
      usageCount: usage.usageCount,
      files: usage.files.length,
      variants: usage.variants,
    })
  }
}

/**
 * CLI usage example
 */
export function runAdoptionAnalytics(): void {
  const rootDir = process.cwd()
  const componentsDir = path.join(rootDir, 'apps/web/src/components/ui')
  const componentPaths = [
    '@/components/ui/button',
    '@/components/ui/card',
    '@/components/ui/input',
    // Add more component paths
  ]
  const apps = ['web', 'admin', 'mobile']

  const report = generateAdoptionReport(rootDir, componentsDir, componentPaths, apps)

  // Export reports
  exportReportAsJson(report, path.join(rootDir, 'adoption-report.json'))
  exportReportAsMarkdown(report, path.join(rootDir, 'adoption-report.md'))

  console.log('Adoption analytics report generated!')
  console.log(`Adoption rate: ${report.metrics.adoptionRate}%`)
  console.log(`Components used: ${report.metrics.componentsUsed}/${report.metrics.totalComponents}`)
}

// Export for testing
export const __testing__ = {
  scanComponentImports,
  getAvailableComponents,
  calculateAdoptionMetrics,
  generateRecommendations,
}

