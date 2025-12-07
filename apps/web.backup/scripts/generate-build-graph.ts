import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "fs";
import path from "path";

type TsConfigReference = { path: string };

type BuildGraphNode = {
  path: string;
  tsconfig: string;
  references: string[];
};

export type BuildGraphManifest = {
  generatedAt: string;
  rootConfig: string;
  projects: BuildGraphNode[];
};

type GenerateBuildGraphOptions = {
  rootConfigPath?: string;
  manifestPath?: string;
  writeManifest?: boolean;
  silent?: boolean;
};

const repoRoot = path.resolve(__dirname, "..");

const normalizeRelative = (targetPath: string) => {
  const relative = path.relative(repoRoot, targetPath);
  return relative ? relative.split(path.sep).join("/") : ".";
};

const resolveReferenceConfig = (referencePath: string, baseDir: string) => {
  const resolved = path.resolve(baseDir, referencePath);

  if (resolved.endsWith(".json")) {
    if (!existsSync(resolved)) {
      throw new Error(`Referenced tsconfig "${normalizeRelative(resolved)}" does not exist.`);
    }
    return resolved;
  }

  if (existsSync(resolved) && statSync(resolved).isFile()) {
    return resolved;
  }

  const candidate = path.join(resolved, "tsconfig.json");
  if (!existsSync(candidate)) {
    throw new Error(
      `No tsconfig.json found for reference "${referencePath}" resolved to "${normalizeRelative(candidate)}".`
    );
  }
  return candidate;
};

const ensureComposite = (
  tsconfigPath: string,
  compilerOptions: Record<string, unknown> | undefined,
  enforce: boolean
) => {
  if (!enforce) {
    return;
  }
  if (!compilerOptions || compilerOptions.composite !== true) {
    throw new Error(
      `Project "${normalizeRelative(path.dirname(tsconfigPath))}" must set compilerOptions.composite = true.`
    );
  }
};

const readTsconfig = (configPath: string) => {
  try {
    return JSON.parse(readFileSync(configPath, "utf8"));
  } catch (error) {
    throw new Error(`Unable to parse ${normalizeRelative(configPath)}: ${(error as Error).message}`);
  }
};

export const generateBuildGraph = (options?: GenerateBuildGraphOptions): BuildGraphManifest => {
  const rootConfigPath = options?.rootConfigPath
    ? path.resolve(repoRoot, options.rootConfigPath)
    : path.join(repoRoot, "tsconfig.json");
  const manifestPath = options?.manifestPath
    ? path.resolve(repoRoot, options.manifestPath)
    : path.join(repoRoot, "artifacts", "build-graph.json");
  const writeManifest = options?.writeManifest !== false;

  const visited = new Map<string, BuildGraphNode>();

  const traverse = (configPath: string, stack: string[], enforceComposite: boolean): BuildGraphNode => {
    const absoluteConfig = path.resolve(configPath);

    if (stack.includes(absoluteConfig)) {
      const cycle = [...stack, absoluteConfig]
        .map((entry) => normalizeRelative(path.dirname(entry)))
        .join(" -> ");
      throw new Error(`Detected circular project reference: ${cycle}`);
    }

    if (visited.has(absoluteConfig)) {
      return visited.get(absoluteConfig)!;
    }

    const json = readTsconfig(absoluteConfig);
    ensureComposite(absoluteConfig, json.compilerOptions, enforceComposite);

    const projectDir = path.dirname(absoluteConfig);
    const node: BuildGraphNode = {
      path: normalizeRelative(projectDir),
      tsconfig: normalizeRelative(absoluteConfig),
      references: [],
    };

    visited.set(absoluteConfig, node);

    const references: TsConfigReference[] = Array.isArray(json.references) ? json.references : [];
    const nextStack = [...stack, absoluteConfig];
    const childPaths: string[] = [];

    for (const reference of references) {
      if (!reference || typeof reference.path !== "string" || reference.path.trim() === "") {
        throw new Error(
          `Invalid reference entry in ${node.tsconfig}. Each reference must be an object with a non-empty "path".`
        );
      }
      const childConfigPath = resolveReferenceConfig(reference.path, projectDir);
      const childNode = traverse(childConfigPath, nextStack, true);
      childPaths.push(childNode.path);
    }

    node.references = Array.from(new Set(childPaths)).sort();
    return node;
  };

  const rootNode = traverse(rootConfigPath, [], false);
  const projects = Array.from(visited.values())
    .filter((node) => node.tsconfig !== rootNode.tsconfig)
    .sort((a, b) => a.path.localeCompare(b.path));

  const manifest: BuildGraphManifest = {
    generatedAt: new Date().toISOString(),
    rootConfig: rootNode.tsconfig,
    projects,
  };

  if (writeManifest) {
    mkdirSync(path.dirname(manifestPath), { recursive: true });
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
    if (!options?.silent) {
      console.log(`Wrote build graph manifest to ${normalizeRelative(manifestPath)}`);
    }
  }

  return manifest;
};

const parseCliOptions = (argv: string[]) => {
  const cliOptions: {
    project?: string;
    output?: string;
    noWrite?: boolean;
    quiet?: boolean;
  } = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "--project":
      case "-p":
        cliOptions.project = argv[++i];
        break;
      case "--output":
      case "-o":
        cliOptions.output = argv[++i];
        break;
      case "--no-write":
        cliOptions.noWrite = true;
        break;
      case "--quiet":
      case "-q":
        cliOptions.quiet = true;
        break;
      default:
        break;
    }
  }

  return cliOptions;
};

if (require.main === module) {
  const cli = parseCliOptions(process.argv.slice(2));
  try {
    const manifest = generateBuildGraph({
      rootConfigPath: cli.project,
      manifestPath: cli.output,
      writeManifest: !cli.noWrite,
      silent: cli.quiet,
    });
    if (!cli.quiet) {
      console.log(
        `Discovered ${manifest.projects.length} project${manifest.projects.length === 1 ? "" : "s"} referenced by ${manifest.rootConfig}.`
      );
    }
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
  }
}


