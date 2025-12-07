/**
 * Core types for state-agent system
 */

export interface StateReport {
  generatedAt: string;
  waveNumber?: number;
  commitHash?: string;
  timestamp: string;
  metadata: SystemMetadata;
  compliance: ComplianceMetadata;
  architecture: ArchitectureSummary;
  narrative?: string;
  version: string;
}

export interface SystemMetadata {
  monorepo: MonorepoMetadata;
  api: ApiMetadata;
  blockchain: BlockchainMetadata;
  services: ServiceMetadata[];
  packages: PackageMetadata[];
}

export interface MonorepoMetadata {
  workspaces: string[];
  rootPackage: {
    name: string;
    version: string;
  };
  totalPackages: number;
  totalApps: number;
}

export interface ApiMetadata {
  routes: RouteMetadata[];
  totalRoutes: number;
  middleware: string[];
  services: string[];
}

export interface RouteMetadata {
  path: string;
  method: string;
  handler?: string;
}

export interface BlockchainMetadata {
  pallets: string[];
  runtime: string;
  validators: number;
  chainId?: string;
}

export interface ServiceMetadata {
  name: string;
  type: 'api' | 'worker' | 'service' | 'package';
  path: string;
  dependencies: string[];
}

export interface PackageMetadata {
  name: string;
  version: string;
  path: string;
  dependencies: string[];
}

export interface ComplianceMetadata {
  redactionApplied: boolean;
  piiDetected: boolean;
  phiDetected: boolean;
  gdprCompliant: boolean;
  hipaaCompliant: boolean;
  pouConstraints: string[];
}

export interface ArchitectureSummary {
  subsystems: SubsystemDescription[];
  pipelines: PipelineDescription[];
  endpoints: EndpointDescription[];
  flows: FlowDescription[];
  compliancePosture: string;
}

export interface SubsystemDescription {
  name: string;
  purpose: string;
  components: string[];
  status: 'active' | 'deprecated' | 'in-development';
}

export interface PipelineDescription {
  name: string;
  type: string;
  stages: string[];
  status: 'active' | 'paused' | 'error';
}

export interface EndpointDescription {
  path: string;
  method: string;
  description: string;
  authRequired: boolean;
}

export interface FlowDescription {
  name: string;
  type: 'VC' | 'SD-JWT' | 'OIDC' | 'FHIR' | 'other';
  steps: string[];
}

export interface StateReportOptions {
  includeNarrative?: boolean;
  complianceLevel?: 'strict' | 'standard' | 'minimal';
  pouRole?: string;
  waveNumber?: number;
  commitHash?: string;
}

