export interface TenantMtlsConfig {
    enabled: boolean;
    allowed_for_confidential: boolean;
}
export declare function getTenantMtlsConfig(_tenantId?: string): TenantMtlsConfig;
export declare function isDpopRequired(): boolean;
export declare function getDpopAlgorithms(): string[];
