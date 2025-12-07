import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import { getServiceLogger } from '../logging/serviceLogger';

type Finding = {
  file: string;
  line: number;
  original: string;
  fixed: string;
};

type Replacement = {
  start: number;
  end: number;
  value: string;
};

const repoRoot = path.resolve(__dirname, '..', '..');
const log = getServiceLogger('common/importFixer');

const defaultTargets = ['backend', 'services', 'apps', 'packages', 'scripts', 'src', 'jobs'];
const ignoredDirectories = new Set(['node_modules', 'dist', '.next', '.turbo', '.git', 'coverage']);

const args = process.argv.slice(2);
const shouldFix = args.includes('--fix') || args.includes('--write');
const explicitCheck = args.includes('--check');
const mode: 'fix' | 'check' = shouldFix ? 'fix' : 'check';

function collectTargetFiles(): string[] {
  const files: string[] = [];
  for (const relativeTarget of defaultTargets) {
    const absoluteTarget = path.join(repoRoot, relativeTarget);
    if (!fs.existsSync(absoluteTarget)) {
      continue;
    }
    walkDirectory(absoluteTarget, files);
  }
  return files;
}

function walkDirectory(directory: string, files: string[]) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (ignoredDirectories.has(entry.name)) {
        continue;
      }
      walkDirectory(absolutePath, files);
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    if (!/\.[cm]?tsx?$/.test(entry.name) || entry.name.endsWith('.d.ts')) {
      continue;
    }
    files.push(absolutePath);
  }
}

function needsFix(specifier: string) {
  if (specifier.endsWith('.d.ts')) {
    return false;
  }
  return specifier.endsWith('.ts') || specifier.endsWith('.tsx');
}

function trimExtension(specifier: string) {
  return specifier.replace(/\.(ts|tsx)$/i, '');
}

function inspectFile(filePath: string): { findings: Finding[]; updatedContent?: string } {
  const originalContent = fs.readFileSync(filePath, 'utf8');
  if (!originalContent.includes('.ts')) {
    return { findings: [] };
  }

  const source = ts.createSourceFile(filePath, originalContent, ts.ScriptTarget.Latest, true);
  const findings: Finding[] = [];
  const replacements: Replacement[] = [];

  const queueLiteral = (literal: ts.StringLiteral | ts.NoSubstitutionTemplateLiteral) => {
    const specifier = literal.text;
    if (!needsFix(specifier)) {
      return;
    }
    const corrected = trimExtension(specifier);
    if (corrected === specifier) {
      return;
    }
    const { line } = source.getLineAndCharacterOfPosition(literal.getStart(source));
    findings.push({
      file: path.relative(repoRoot, filePath),
      line: line + 1,
      original: specifier,
      fixed: corrected,
    });
    replacements.push({
      start: literal.getStart(source) + 1,
      end: literal.getEnd() - 1,
      value: corrected,
    });
  };

  const visitor = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      queueLiteral(node.moduleSpecifier);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      queueLiteral(node.moduleSpecifier);
    } else if (
      ts.isCallExpression(node) &&
      node.arguments.length > 0 &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'require'
    ) {
      const [firstArg] = node.arguments;
      if (firstArg && ts.isStringLiteral(firstArg)) {
        queueLiteral(firstArg);
      }
    }
    ts.forEachChild(node, visitor);
  };

  ts.forEachChild(source, visitor);

  if (!replacements.length) {
    return { findings: [] };
  }

  const sorted = replacements.sort((a, b) => b.start - a.start);
  let updatedContent = originalContent;
  for (const replacement of sorted) {
    updatedContent =
      updatedContent.slice(0, replacement.start) + replacement.value + updatedContent.slice(replacement.end);
  }

  return { findings, updatedContent };
}

function run() {
  const files = collectTargetFiles();
  const allFindings: Finding[] = [];
  let fixedFiles = 0;

  for (const filePath of files) {
    const { findings, updatedContent } = inspectFile(filePath);
    if (!findings.length) {
      continue;
    }
    allFindings.push(...findings);
    if (mode === 'fix' && updatedContent) {
      fs.writeFileSync(filePath, updatedContent, 'utf8');
      fixedFiles += 1;
    }
  }

  if (!allFindings.length) {
    if (!explicitCheck) {
      log.info('All imports already use extensionless specifiers');
    }
    return;
  }

  if (mode === 'fix') {
    log.info('Fixed import specifiers', {
      findings: allFindings.length,
      files: fixedFiles,
    });
    return;
  }

  log.error('Found import specifiers that still include .ts/.tsx extensions', {
    count: allFindings.length,
  });
  for (const finding of allFindings) {
    log.error('Non-extensionless import detected', finding);
  }
  log.error('Run `npm run imports:fix` to automatically remove the extensions.');
  process.exitCode = 1;
}

run();

