/**
 * B246C-DES-028: Design System Versioning Pipeline
 *
 * Automates versioning and changelog generation for design system releases.
 * Detects breaking changes, bumps versions (semver), generates release notes.
 *
 * Usage:
 *   import { runVersioningPipeline } from './versioningPipeline'
 *   runVersioningPipeline({ packagePath: '.', changelogPath: './CHANGELOG.md' })
 */

import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

export interface VersionBump {
  type: 'major' | 'minor' | 'patch'
  reason: string
  breaking?: boolean
}

export interface ChangelogEntry {
  version: string
  date: string
  changes: {
    added?: string[]
    changed?: string[]
    deprecated?: string[]
    removed?: string[]
    fixed?: string[]
    security?: string[]
  }
  breaking?: string[]
}

export interface ReleaseConfig {
  packagePath: string
  changelogPath: string
  versionPrefix?: string
  dryRun?: boolean
}

/**
 * Get current version from package.json
 */
export function getCurrentVersion(config: ReleaseConfig): string {
  const packageJsonPath = path.join(config.packagePath, 'package.json')
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
  return packageJson.version
}

/**
 * Parse version string to semver parts
 */
export function parseVersion(version: string): { major: number; minor: number; patch: number } {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)/)
  if (!match) {
    throw new Error(`Invalid version format: ${version}`)
  }
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  }
}

/**
 * Bump version based on type
 */
export function bumpVersion(
  currentVersion: string,
  bumpType: 'major' | 'minor' | 'patch'
): string {
  const { major, minor, patch } = parseVersion(currentVersion)

  switch (bumpType) {
    case 'major':
      return `${major + 1}.0.0`
    case 'minor':
      return `${major}.${minor + 1}.0`
    case 'patch':
      return `${major}.${patch + 1}`
    default:
      throw new Error(`Invalid bump type: ${bumpType}`)
  }
}

/**
 * Detect breaking changes from git commits
 */
export function detectBreakingChanges(sinceVersion: string): string[] {
  try {
    const commits = execSync(
      `git log --pretty=format:"%s" v${sinceVersion}..HEAD`,
      { encoding: 'utf-8' }
    )
      .split('\n')
      .filter((line) => line.trim())

    const breaking = commits.filter((commit) =>
      commit.toLowerCase().includes('breaking') ||
      commit.toLowerCase().includes('!') ||
      commit.match(/^BREAKING:/i)
    )

    return breaking
  } catch (error) {
    console.warn('Could not detect breaking changes from git:', error)
    return []
  }
}

/**
 * Parse conventional commits to determine version bump
 */
export function determineVersionBump(sinceVersion: string): VersionBump {
  try {
    const commits = execSync(
      `git log --pretty=format:"%s" v${sinceVersion}..HEAD`,
      { encoding: 'utf-8' }
    )
      .split('\n')
      .filter((line) => line.trim())

    let hasBreaking = false
    let hasFeature = false
    let hasFix = false

    for (const commit of commits) {
      const lowerCommit = commit.toLowerCase()

      if (
        lowerCommit.includes('breaking') ||
        lowerCommit.includes('!') ||
        lowerCommit.match(/^BREAKING:/i)
      ) {
        hasBreaking = true
      } else if (lowerCommit.match(/^(feat|feature):/i)) {
        hasFeature = true
      } else if (lowerCommit.match(/^(fix|bugfix):/i)) {
        hasFix = true
      }
    }

    if (hasBreaking) {
      return {
        type: 'major',
        reason: 'Breaking changes detected',
        breaking: true,
      }
    }

    if (hasFeature) {
      return {
        type: 'minor',
        reason: 'New features added',
      }
    }

    if (hasFix) {
      return {
        type: 'patch',
        reason: 'Bug fixes included',
      }
    }

    return {
      type: 'patch',
      reason: 'No significant changes detected',
    }
  } catch (error) {
    console.warn('Could not determine version bump from commits:', error)
    return {
      type: 'patch',
      reason: 'Default patch bump',
    }
  }
}

/**
 * Generate changelog entry from git commits
 */
export function generateChangelogEntry(
  version: string,
  sinceVersion: string
): ChangelogEntry {
  try {
    const commits = execSync(
      `git log --pretty=format:"%s" v${sinceVersion}..HEAD`,
      { encoding: 'utf-8' }
    )
      .split('\n')
      .filter((line) => line.trim())

    const changes: ChangelogEntry['changes'] = {
      added: [],
      changed: [],
      deprecated: [],
      removed: [],
      fixed: [],
      security: [],
    }
    const breaking: string[] = []

    for (const commit of commits) {
      const lowerCommit = commit.toLowerCase()

      if (
        lowerCommit.includes('breaking') ||
        lowerCommit.includes('!') ||
        lowerCommit.match(/^BREAKING:/i)
      ) {
        breaking.push(commit)
      } else if (lowerCommit.match(/^(feat|feature):/i)) {
        changes.added?.push(commit)
      } else if (lowerCommit.match(/^(fix|bugfix):/i)) {
        changes.fixed?.push(commit)
      } else if (lowerCommit.match(/^(refactor|chore):/i)) {
        changes.changed?.push(commit)
      } else if (lowerCommit.match(/^(deprecate):/i)) {
        changes.deprecated?.push(commit)
      } else if (lowerCommit.match(/^(remove|delete):/i)) {
        changes.removed?.push(commit)
      } else if (lowerCommit.match(/^(security):/i)) {
        changes.security?.push(commit)
      } else {
        changes.changed?.push(commit)
      }
    }

    // Clean up empty arrays
    Object.keys(changes).forEach((key) => {
      const arr = changes[key as keyof typeof changes]
      if (Array.isArray(arr) && arr.length === 0) {
        delete changes[key as keyof typeof changes]
      }
    })

    return {
      version,
      date: new Date().toISOString().split('T')[0],
      changes,
      breaking: breaking.length > 0 ? breaking : undefined,
    }
  } catch (error) {
    console.warn('Could not generate changelog from git:', error)
    return {
      version,
      date: new Date().toISOString().split('T')[0],
      changes: {},
    }
  }
}

/**
 * Format changelog entry as markdown
 */
export function formatChangelogEntry(entry: ChangelogEntry): string {
  let markdown = `## [${entry.version}] - ${entry.date}\n\n`

  if (entry.breaking && entry.breaking.length > 0) {
    markdown += '### ⚠️ Breaking Changes\n\n'
    entry.breaking.forEach((change) => {
      markdown += `- ${change}\n`
    })
    markdown += '\n'
  }

  if (entry.changes.added && entry.changes.added.length > 0) {
    markdown += '### Added\n\n'
    entry.changes.added.forEach((change) => {
      markdown += `- ${change}\n`
    })
    markdown += '\n'
  }

  if (entry.changes.changed && entry.changes.changed.length > 0) {
    markdown += '### Changed\n\n'
    entry.changes.changed.forEach((change) => {
      markdown += `- ${change}\n`
    })
    markdown += '\n'
  }

  if (entry.changes.fixed && entry.changes.fixed.length > 0) {
    markdown += '### Fixed\n\n'
    entry.changes.fixed.forEach((change) => {
      markdown += `- ${change}\n`
    })
    markdown += '\n'
  }

  if (entry.changes.deprecated && entry.changes.deprecated.length > 0) {
    markdown += '### Deprecated\n\n'
    entry.changes.deprecated.forEach((change) => {
      markdown += `- ${change}\n`
    })
    markdown += '\n'
  }

  if (entry.changes.removed && entry.changes.removed.length > 0) {
    markdown += '### Removed\n\n'
    entry.changes.removed.forEach((change) => {
      markdown += `- ${change}\n`
    })
    markdown += '\n'
  }

  if (entry.changes.security && entry.changes.security.length > 0) {
    markdown += '### Security\n\n'
    entry.changes.security.forEach((change) => {
      markdown += `- ${change}\n`
    })
    markdown += '\n'
  }

  return markdown
}

/**
 * Update changelog file
 */
export function updateChangelog(
  config: ReleaseConfig,
  entry: ChangelogEntry
): void {
  const changelogPath = config.changelogPath
  let changelogContent = ''

  if (fs.existsSync(changelogPath)) {
    changelogContent = fs.readFileSync(changelogPath, 'utf-8')
  } else {
    changelogContent = '# Changelog\n\nAll notable changes to this project will be documented in this file.\n\n'
  }

  const entryMarkdown = formatChangelogEntry(entry)
  const newChangelog = changelogContent.replace(
    '# Changelog',
    `# Changelog\n\n${entryMarkdown}`
  )

  if (!config.dryRun) {
    fs.writeFileSync(changelogPath, newChangelog)
  } else {
    console.log('DRY RUN: Would write changelog:')
    console.log(entryMarkdown)
  }
}

/**
 * Update package.json version
 */
export function updatePackageVersion(
  config: ReleaseConfig,
  newVersion: string
): void {
  const packageJsonPath = path.join(config.packagePath, 'package.json')
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))

  packageJson.version = newVersion

  if (!config.dryRun) {
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n')
  } else {
    console.log(`DRY RUN: Would update version to ${newVersion}`)
  }
}

/**
 * Main versioning pipeline
 */
export function runVersioningPipeline(config: ReleaseConfig): {
  currentVersion: string
  newVersion: string
  bump: VersionBump
  changelog: ChangelogEntry
} {
  const currentVersion = getCurrentVersion(config)
  const bump = determineVersionBump(currentVersion)
  const newVersion = bumpVersion(currentVersion, bump.type)
  const changelog = generateChangelogEntry(newVersion, currentVersion)

  console.log(`Current version: ${currentVersion}`)
  console.log(`New version: ${newVersion} (${bump.type}: ${bump.reason})`)

  if (bump.breaking) {
    console.warn('⚠️  Breaking changes detected!')
  }

  updateChangelog(config, changelog)
  updatePackageVersion(config, newVersion)

  return {
    currentVersion,
    newVersion,
    bump,
    changelog,
  }
}

/**
 * CI/CD integration example
 */
export function ciVersioningPipeline(): void {
  const config: ReleaseConfig = {
    packagePath: process.cwd(),
    changelogPath: path.join(process.cwd(), 'CHANGELOG.md'),
    dryRun: process.env.CI !== 'true',
  }

  try {
    const result = runVersioningPipeline(config)
    console.log('✅ Versioning pipeline completed successfully')
    console.log(JSON.stringify(result, null, 2))
  } catch (error) {
    console.error('❌ Versioning pipeline failed:', error)
    process.exit(1)
  }
}

// Export for testing
export const __testing__ = {
  parseVersion,
  bumpVersion,
  formatChangelogEntry,
}

