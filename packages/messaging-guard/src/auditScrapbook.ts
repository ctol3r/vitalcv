export interface AuditScrapbook {
  recordEvent?(event: unknown): Promise<void>;
  recordIdentityAction?(userId: string, action: string): Promise<void>;
}
